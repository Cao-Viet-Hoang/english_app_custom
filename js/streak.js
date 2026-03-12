/* ============================================================
   STREAK MODULE
   Firestore streak tracking for daily engagement.
   Path: users/{username}/streak/main (document)
         users/{username}/streak/main/dailyActivity/{dateString}
   ============================================================ */

import { getDb } from './firebase.js';
import { getUsername } from './router.js';

// In-memory cache to avoid redundant reads within same page session
let _cachedStreak = null;

// ---- Firestore refs ----

function streakRef() {
  const db = getDb();
  const username = getUsername();
  return db.collection('users').doc(username).collection('streak').doc('main');
}

function dailyActivityRef() {
  return streakRef().collection('dailyActivity');
}

// ---- Date helpers ----

function getTodayDateString() {
  return new Date().toLocaleDateString('en-CA'); // "YYYY-MM-DD"
}

function getYesterdayDateString() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toLocaleDateString('en-CA');
}

function getDateStringDaysAgo(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toLocaleDateString('en-CA');
}

// ---- Milestones ----

const MILESTONES = [3, 7, 14, 30, 60, 100, 365];

export function checkMilestone(streak) {
  return MILESTONES.includes(streak) ? streak : null;
}

export function getMilestoneMessage(milestone) {
  const messages = {
    3:   { title: '3-Day Streak!',   message: "You're building a habit. Keep going!" },
    7:   { title: '1-Week Streak!',  message: "A whole week of learning. Amazing dedication!" },
    14:  { title: '2-Week Streak!',  message: "Two weeks strong! You're on fire!" },
    30:  { title: '30-Day Streak!',  message: "One month of daily learning. Incredible!" },
    60:  { title: '60-Day Streak!',  message: "Two months! Your consistency is inspiring." },
    100: { title: '100-Day Streak!', message: "Triple digits! You're a true learner." },
    365: { title: '1-Year Streak!',  message: "365 days of learning. Absolutely legendary!" },
  };
  return messages[milestone] || { title: `${milestone}-Day Streak!`, message: 'Amazing progress!' };
}

// ---- Default streak data ----

function defaultStreakData() {
  return {
    currentStreak: 0,
    longestStreak: 0,
    lastActiveDate: '',
    totalActiveDays: 0,
  };
}

// ---- Core functions ----

/**
 * Load the current streak data from Firestore.
 * Creates default document if it does not exist.
 * Checks if streak is broken and resets if needed.
 * @param {boolean} [forceRefresh=false]  Skip cache
 * @returns {Promise<Object>}  StreakData with computed flags
 */
export async function loadStreak(forceRefresh = false) {
  if (_cachedStreak && !forceRefresh) return _cachedStreak;

  const doc = await streakRef().get();
  let data;

  if (!doc.exists) {
    // First time — create defaults
    const defaults = defaultStreakData();
    await streakRef().set({
      ...defaults,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    data = { ...defaults };
  } else {
    data = doc.data();
  }

  const today = getTodayDateString();
  const yesterday = getYesterdayDateString();

  // Compute flags
  data.isActiveToday = data.lastActiveDate === today;
  data.isStreakAtRisk = data.lastActiveDate === yesterday && !data.isActiveToday;

  // Check if streak is broken (last active is older than yesterday)
  const justBroke = data.currentStreak > 0
    && data.lastActiveDate !== ''
    && data.lastActiveDate !== today
    && data.lastActiveDate !== yesterday;

  if (justBroke) {
    data.previousStreak = data.currentStreak;
    data.currentStreak = 0;
    // Persist the reset
    await streakRef().update({ currentStreak: 0 });
  }
  data.justBroke = justBroke;

  _cachedStreak = data;
  return data;
}

/**
 * Record a daily activity event (word marked as learned).
 * @returns {Promise<{ streakData: Object, isNewDay: boolean, milestone: number|null }>}
 */
export async function recordActivity() {
  const today = getTodayDateString();
  const yesterday = getYesterdayDateString();

  // Force-read fresh data
  const doc = await streakRef().get();
  let data = doc.exists ? doc.data() : defaultStreakData();

  const isNewDay = data.lastActiveDate !== today;
  const batch = getDb().batch();

  if (isNewDay) {
    // Determine new streak value
    let newStreak;
    if (data.lastActiveDate === yesterday) {
      newStreak = (data.currentStreak || 0) + 1;
    } else {
      newStreak = 1;
    }

    const newLongest = Math.max(data.longestStreak || 0, newStreak);
    const newTotalActive = (data.totalActiveDays || 0) + 1;

    const streakUpdate = {
      currentStreak: newStreak,
      longestStreak: newLongest,
      lastActiveDate: today,
      totalActiveDays: newTotalActive,
    };

    if (!doc.exists) {
      streakUpdate.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      batch.set(streakRef(), streakUpdate);
    } else {
      batch.update(streakRef(), streakUpdate);
    }

    // Create/update daily activity doc
    batch.set(dailyActivityRef().doc(today), {
      date: today,
      wordsLearned: 1,
      firstActionAt: firebase.firestore.FieldValue.serverTimestamp(),
      lastActionAt: firebase.firestore.FieldValue.serverTimestamp(),
    });

    await batch.commit();

    // Update cached data
    data = {
      ...data,
      ...streakUpdate,
      isActiveToday: true,
      isStreakAtRisk: false,
      justBroke: false,
    };
    _cachedStreak = data;

    const milestone = checkMilestone(newStreak);
    return { streakData: data, isNewDay: true, milestone };
  } else {
    // Same day — just increment daily counter
    batch.update(dailyActivityRef().doc(today), {
      wordsLearned: firebase.firestore.FieldValue.increment(1),
      lastActionAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    await batch.commit();

    // Update cache
    data.isActiveToday = true;
    data.isStreakAtRisk = false;
    data.justBroke = false;
    _cachedStreak = data;

    return { streakData: data, isNewDay: false, milestone: null };
  }
}

/**
 * Decrement wordsLearned for today when a word is un-marked as learned.
 * Only affects today's daily activity counter — does NOT roll back streak days.
 * @returns {Promise<void>}
 */
export async function removeActivity() {
  const today = getTodayDateString();
  const docRef = dailyActivityRef().doc(today);
  const doc = await docRef.get();
  if (!doc.exists) return;

  const current = doc.data().wordsLearned || 0;
  if (current <= 1) {
    await docRef.update({ wordsLearned: 0, lastActionAt: firebase.firestore.FieldValue.serverTimestamp() });
  } else {
    await docRef.update({
      wordsLearned: firebase.firestore.FieldValue.increment(-1),
      lastActionAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  }
}

/**
 * Load activity history for the calendar/heatmap view.
 * @param {number} [days=90]  How many days to look back
 * @returns {Promise<Array<Object>>}
 */
export async function loadActivityHistory(days = 90) {
  const startDate = getDateStringDaysAgo(days);
  const snapshot = await dailyActivityRef()
    .where('date', '>=', startDate)
    .orderBy('date', 'asc')
    .get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}
