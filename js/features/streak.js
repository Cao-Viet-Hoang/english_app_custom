/* ============================================================
   STREAK MODULE
   Firestore streak tracking for daily engagement.
   Path: users/{username}/streak/main (document)
         users/{username}/streak/main/dailyActivity/{dateString}
   ============================================================ */

import { getDb } from '../core/firebase.js';
import { getUsername } from '../core/router.js';
import {
  FREEZE_EARN_THRESHOLD,
  MAX_STREAK_FREEZES,
  NEW_USER_FREEZES,
  reconcileStreak,
  earnFreezeOnActiveDay,
} from './streak-logic.js';

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

const ACTIVITY_FIELD_MAP = {
  vocabulary: {
    learn: 'wordsLearned',
    practice: 'practiceCount',
  },
  irregularVerb: {
    learn: 'irregularVerbsLearned',
    practice: 'irregularVerbPracticeCount',
  },
  wordForm: {
    learn: 'wordFormsLearned',
    practice: 'wordFormPracticeCount',
  },
};

const KNOWN_SOURCES = new Set(['vocabulary', 'irregularVerb', 'wordForm']);

function normalizeActivityOptions(activity = 'learn') {
  if (typeof activity === 'string') {
    return {
      type: activity === 'practice' ? 'practice' : 'learn',
      source: 'vocabulary',
    };
  }

  const source = KNOWN_SOURCES.has(activity?.source) ? activity.source : 'vocabulary';
  return {
    type: activity?.type === 'practice' ? 'practice' : 'learn',
    source,
  };
}

function getActivityField(activity = 'learn') {
  const { type, source } = normalizeActivityOptions(activity);
  return ACTIVITY_FIELD_MAP[source][type];
}

export function summarizeActivityEntry(entry = {}) {
  const vocabularyLearned = entry.wordsLearned || 0;
  const irregularVerbsLearned = entry.irregularVerbsLearned || 0;
  const wordFormsLearned = entry.wordFormsLearned || 0;
  const vocabularyPractice = entry.practiceCount || 0;
  const irregularVerbPractice = entry.irregularVerbPracticeCount || 0;
  const wordFormPractice = entry.wordFormPracticeCount || 0;
  const learned = vocabularyLearned + irregularVerbsLearned + wordFormsLearned;
  const practiced = vocabularyPractice + irregularVerbPractice + wordFormPractice;

  return {
    vocabularyLearned,
    irregularVerbsLearned,
    wordFormsLearned,
    vocabularyPractice,
    irregularVerbPractice,
    wordFormPractice,
    learned,
    practiced,
    total: learned + practiced,
  };
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

// ---- Daily encouragement ----

const DAILY_MESSAGES = [
  'Keep it up!',
  'You got this!',
  'Nice progress!',
  'Stay curious!',
  'One step closer!',
  'Doing great!',
  'Well done today!',
  'Consistency wins!',
  "You're on track!",
  'Keep learning!',
  'Small steps, big gains!',
  'Stay sharp!',
  'Great effort!',
  'Keep pushing!',
  'Never stop growing!',
];

/**
 * Get a daily encouragement message based on streak count.
 * Uses streak number to pick a message deterministically so it
 * stays consistent for the same day but varies across days.
 * Returns null for milestone days (those have their own celebration).
 */
export function getDailyEncouragement(streak) {
  if (streak <= 0) return null;
  if (MILESTONES.includes(streak)) return null;
  return `Day ${streak} — ${DAILY_MESSAGES[streak % DAILY_MESSAGES.length]}`;
}

// ---- Default streak data ----

function defaultStreakData() {
  return {
    currentStreak: 0,
    longestStreak: 0,
    lastActiveDate: '',
    totalActiveDays: 0,
    streakFreezes: NEW_USER_FREEZES,
    maxStreakFreezes: MAX_STREAK_FREEZES,
    activeDaysToNextFreeze: 0,
  };
}

// ---- Core functions ----

/**
 * Load the current streak data from Firestore.
 * Creates a default document if it does not exist, lazily migrates missing
 * freeze fields, and reconciles the streak — consuming freezes to bridge
 * missed days or breaking the streak when freezes run out.
 * @param {boolean} [forceRefresh=false]  Skip cache
 * @returns {Promise<Object>}  StreakData with computed flags. When freezes are
 *   consumed on this load, `freezesConsumed > 0` and `frozenDates` list the days.
 */
export async function loadStreak(forceRefresh = false) {
  if (_cachedStreak && !forceRefresh) return _cachedStreak;

  const ref = streakRef();
  const doc = await ref.get();
  let data;

  if (!doc.exists) {
    // First time — create defaults (already includes freeze fields, no gap).
    const defaults = defaultStreakData();
    await ref.set({
      ...defaults,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    data = { ...defaults };
    data.isActiveToday = false;
    data.isStreakAtRisk = false;
    data.justBroke = false;
    data.freezesConsumed = 0;
    data.frozenDates = [];
    _cachedStreak = data;
    return data;
  }

  data = doc.data();
  const today = getTodayDateString();
  const yesterday = getYesterdayDateString();

  // ---- Migration: existing users without freeze fields get NEW_USER_FREEZES ----
  const migration = {};
  if (typeof data.streakFreezes !== 'number') {
    data.streakFreezes = NEW_USER_FREEZES;
    migration.streakFreezes = NEW_USER_FREEZES;
  }
  if (typeof data.maxStreakFreezes !== 'number') {
    data.maxStreakFreezes = MAX_STREAK_FREEZES;
    migration.maxStreakFreezes = MAX_STREAK_FREEZES;
  }
  if (typeof data.activeDaysToNextFreeze !== 'number') {
    data.activeDaysToNextFreeze = 0;
    migration.activeDaysToNextFreeze = 0;
  }

  // ---- Reconcile: bridge missed days with freezes, or break the streak ----
  const rec = reconcileStreak({
    lastActiveDate: data.lastActiveDate || '',
    today,
    yesterday,
    currentStreak: data.currentStreak || 0,
    streakFreezes: data.streakFreezes,
  });

  data.currentStreak = rec.currentStreak;
  data.streakFreezes = rec.streakFreezes;
  data.lastActiveDate = rec.lastActiveDate;
  data.isActiveToday = rec.isActiveToday;
  data.isStreakAtRisk = rec.isStreakAtRisk;
  data.justBroke = rec.justBroke;
  data.freezesConsumed = rec.freezesConsumed;
  data.frozenDates = rec.frozenDates;
  if (rec.justBroke) data.previousStreak = rec.previousStreak;

  // ---- Persist migration + reconciliation changes in one batch ----
  if (Object.keys(migration).length > 0 || rec.changed) {
    const batch = getDb().batch();
    const update = { ...migration };
    if (rec.changed) {
      update.currentStreak = rec.currentStreak;
      update.streakFreezes = rec.streakFreezes;
      update.lastActiveDate = rec.lastActiveDate;
    }
    batch.update(ref, update);
    // Mark each bridged day so the calendar/heatmap can show it as frozen.
    rec.frozenDates.forEach((dateStr) => {
      batch.set(dailyActivityRef().doc(dateStr), { date: dateStr, frozen: true }, { merge: true });
    });
    await batch.commit();
  }

  _cachedStreak = data;
  return data;
}

/**
 * Record a daily activity event.
 * @param {'learn'|'practice'|{type?: 'learn'|'practice', source?: 'vocabulary'|'irregularVerb'}} [activity='learn']
 * @returns {Promise<{ streakData: Object, isNewDay: boolean, milestone: number|null }>}
 */
export async function recordActivity(activity = 'learn') {
  const incrementField = getActivityField(activity);
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

    // Freeze earning — one real study day accrues toward the next freeze.
    const earn = earnFreezeOnActiveDay({
      streakFreezes: typeof data.streakFreezes === 'number' ? data.streakFreezes : NEW_USER_FREEZES,
      activeDaysToNextFreeze: data.activeDaysToNextFreeze || 0,
      maxStreakFreezes: typeof data.maxStreakFreezes === 'number' ? data.maxStreakFreezes : MAX_STREAK_FREEZES,
    });

    const streakUpdate = {
      currentStreak: newStreak,
      longestStreak: newLongest,
      lastActiveDate: today,
      totalActiveDays: newTotalActive,
      streakFreezes: earn.streakFreezes,
      maxStreakFreezes: typeof data.maxStreakFreezes === 'number' ? data.maxStreakFreezes : MAX_STREAK_FREEZES,
      activeDaysToNextFreeze: earn.activeDaysToNextFreeze,
    };

    if (!doc.exists) {
      streakUpdate.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      batch.set(streakRef(), streakUpdate);
    } else {
      batch.update(streakRef(), streakUpdate);
    }

    // Create/update daily activity doc
    const dailyData = {
      date: today,
      firstActionAt: firebase.firestore.FieldValue.serverTimestamp(),
      lastActionAt: firebase.firestore.FieldValue.serverTimestamp(),
    };
    dailyData[incrementField] = 1;
    batch.set(dailyActivityRef().doc(today), dailyData, { merge: true });

    await batch.commit();

    // Update cached data
    data = {
      ...data,
      ...streakUpdate,
      isActiveToday: true,
      isStreakAtRisk: false,
      justBroke: false,
      freezesConsumed: 0,
      frozenDates: [],
    };
    _cachedStreak = data;

    const milestone = checkMilestone(newStreak);
    return { streakData: data, isNewDay: true, milestone, freezeEarned: earn.earned };
  } else {
    // Same day — just increment the appropriate counter
    batch.set(dailyActivityRef().doc(today), {
      date: today,
      [incrementField]: firebase.firestore.FieldValue.increment(1),
      lastActionAt: firebase.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    await batch.commit();

    // Update cache
    data.isActiveToday = true;
    data.isStreakAtRisk = false;
    data.justBroke = false;
    _cachedStreak = data;

    return { streakData: data, isNewDay: false, milestone: null, freezeEarned: false };
  }
}

/**
 * Decrement a daily activity counter for today.
 * If all activity drops to 0, rolls back streak data so the day no longer counts.
 * @returns {Promise<void>}
 */
export async function removeActivity(activity = 'learn') {
  const decrementField = getActivityField(activity);
  const today = getTodayDateString();
  const yesterday = getYesterdayDateString();
  const docRef = dailyActivityRef().doc(today);
  const doc = await docRef.get();
  if (!doc.exists) return;

  const docData = doc.data();
  const currentCount = docData[decrementField] || 0;
  if (currentCount <= 0) return;

  if (currentCount > 1) {
    await docRef.update({
      [decrementField]: firebase.firestore.FieldValue.increment(-1),
      lastActionAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    return;
  }

  await docRef.update({
    [decrementField]: 0,
    lastActionAt: firebase.firestore.FieldValue.serverTimestamp(),
  });

  const remainingToday = summarizeActivityEntry({
    ...docData,
    [decrementField]: 0,
  });
  if (remainingToday.total > 0) return;

  // No activity left — roll back streak if it was incremented today
  const mainDoc = await streakRef().get();
  if (!mainDoc.exists || mainDoc.data().lastActiveDate !== today) return;

  const data = mainDoc.data();
  const yesterdayDoc = await dailyActivityRef().doc(yesterday).get();
  const hadYesterday = yesterdayDoc.exists
    && summarizeActivityEntry(yesterdayDoc.data()).total > 0;

  const rollback = {
    currentStreak: hadYesterday ? Math.max((data.currentStreak || 1) - 1, 0) : 0,
    lastActiveDate: hadYesterday ? yesterday : '',
    totalActiveDays: Math.max((data.totalActiveDays || 1) - 1, 0),
  };

  await streakRef().update(rollback);
  _cachedStreak = null;
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
