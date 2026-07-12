/* ============================================================
   REVIEW MODULE
   Spaced-repetition data layer: builds a global review queue across
   all topics and persists SM-2 scheduling updates on word documents.
   Word path: users/{username}/topics/{topicId}/words/{wordId}
   ============================================================ */

import { getDb } from '../core/firebase.js';
import { getUsername } from '../core/router.js';
import { addDays } from './streak-logic.js';
import { isDue, reviewWord } from './srs-logic.js';

/** Today as a local "YYYY-MM-DD" string (matches the streak module's day boundary). */
export function getTodayDateString() {
  return new Date().toLocaleDateString('en-CA');
}

/** Current UTC offset in minutes, east of UTC positive (e.g. GMT+7 → 420). */
export function getUtcOffsetMinutes() {
  return -new Date().getTimezoneOffset();
}

/** Words subcollection ref for a given topic. */
function wordsRef(topicId) {
  const db = getDb();
  const username = getUsername();
  return db
    .collection('users').doc(username)
    .collection('topics').doc(topicId)
    .collection('words');
}

/**
 * Load every word across all topics, each tagged with its topic id/name.
 * Fan-out pattern (topics -> words), mirroring findDuplicateWords().
 * @returns {Promise<Array<Object>>}
 */
async function loadAllWords() {
  const db = getDb();
  const username = getUsername();
  const topicsSnap = await db.collection('users').doc(username).collection('topics').get();

  const perTopic = await Promise.all(
    topicsSnap.docs.map(async (topicDoc) => {
      const topicName = topicDoc.data().name || '';
      const wordsSnap = await topicDoc.ref.collection('words').get();
      return wordsSnap.docs.map((doc) => ({
        id: doc.id,
        topicId: topicDoc.id,
        topicName,
        ...doc.data(),
      }));
    }),
  );

  return perTopic.flat();
}

/** Effective due date for sorting (legacy learned words have none → treat as today). */
function effectiveDueDate(word, todayStr) {
  return word.srsDueDate || todayStr;
}

/**
 * Load all words due for review today, across every topic, sorted by due date.
 * @param {string} todayStr  "YYYY-MM-DD"
 * @returns {Promise<Array<Object>>}
 */
export async function loadDueWords(todayStr) {
  const all = await loadAllWords();
  const due = all.filter((w) => isDue(w, todayStr));
  due.sort((a, b) => {
    const da = effectiveDueDate(a, todayStr);
    const dbb = effectiveDueDate(b, todayStr);
    if (da !== dbb) return da < dbb ? -1 : 1;
    return 0;
  });
  return due;
}

/**
 * Aggregate review counters for the dashboard and the topics-hub badge.
 * @param {string} todayStr  "YYYY-MM-DD"
 * @returns {Promise<{ dueCount: number, learnedTotal: number, dueTomorrow: number, upcoming7d: number }>}
 */
export async function getReviewStats(todayStr) {
  const all = await loadAllWords();
  const tomorrow = addDays(todayStr, 1);
  const in7Days = addDays(todayStr, 7);

  let dueCount = 0;
  let learnedTotal = 0;
  let dueTomorrow = 0;
  let upcoming7d = 0;

  for (const w of all) {
    if (!w.learned) continue;
    learnedTotal += 1;
    if (isDue(w, todayStr)) {
      dueCount += 1;
    } else if (w.srsDueDate) {
      if (w.srsDueDate === tomorrow) dueTomorrow += 1;
      if (w.srsDueDate > todayStr && w.srsDueDate <= in7Days) upcoming7d += 1;
    }
  }

  return { dueCount, learnedTotal, dueTomorrow, upcoming7d };
}

/**
 * Count words due today. Convenience wrapper for the topics-hub badge.
 * @param {string} todayStr  "YYYY-MM-DD"
 * @returns {Promise<number>}
 */
export async function countDueWords(todayStr) {
  const due = await loadDueWords(todayStr);
  return due.length;
}

/**
 * Persist a review result for one word using the SM-2 scheduler.
 * @param {Object} word     Due-queue word (must carry topicId + id + srs* fields)
 * @param {string|number} rating  A RATING value or raw quality 0–5
 * @param {string} todayStr "YYYY-MM-DD"
 * @returns {Promise<Object>}  The new srs* fields written (for local state update)
 */
export async function submitReview(word, rating, todayStr) {
  const next = reviewWord(word, rating, todayStr);
  await wordsRef(word.topicId).doc(word.id).update({
    ...next,
    // Absolute review instant (UTC/GMT) + the offset the due date was bucketed in,
    // so the local day is always reconstructible for correct time computation.
    srsLastReviewedAt: firebase.firestore.FieldValue.serverTimestamp(),
    srsTzOffset: getUtcOffsetMinutes(),
  });
  return next;
}
