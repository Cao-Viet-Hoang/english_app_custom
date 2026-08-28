/* ============================================================
   SENTENCE TOPICS MODULE
   Firestore CRUD for sentence-pattern topics and the sentences
   nested inside each topic.
   Path: users/{username}/sentenceTopics/{topicId}
         users/{username}/sentenceTopics/{topicId}/sentences/{sentenceId}
   ============================================================ */

import { getDb } from '../core/firebase.js';
import { getUsername } from '../core/router.js';
import { recordActivity, removeActivity } from './streak.js';

let localOrderCounter = 0;

function nextOrderKey() {
  localOrderCounter += 1;
  return Date.now() * 1000 + localOrderCounter;
}

function getOrderKey(sentence) {
  const n = Number(sentence.orderKey);
  return Number.isFinite(n) ? n : null;
}

function getCreatedAtMs(sentence) {
  return sentence.createdAt && typeof sentence.createdAt.toMillis === 'function'
    ? sentence.createdAt.toMillis()
    : null;
}

function compareSentencesByInputOrder(a, b) {
  const aOrderKey = getOrderKey(a);
  const bOrderKey = getOrderKey(b);
  if (aOrderKey !== null && bOrderKey !== null && aOrderKey !== bOrderKey) {
    return aOrderKey - bOrderKey;
  }
  if (aOrderKey !== null && bOrderKey === null) return -1;
  if (aOrderKey === null && bOrderKey !== null) return 1;

  const aCreatedAtMs = getCreatedAtMs(a);
  const bCreatedAtMs = getCreatedAtMs(b);
  if (aCreatedAtMs !== null && bCreatedAtMs !== null && aCreatedAtMs !== bCreatedAtMs) {
    return aCreatedAtMs - bCreatedAtMs;
  }
  if (aCreatedAtMs !== null && bCreatedAtMs === null) return -1;
  if (aCreatedAtMs === null && bCreatedAtMs !== null) return 1;

  return 0;
}

/* ------------------------------------------------------------------
 * Topic-level
 * ----------------------------------------------------------------*/

/**
 * Get the sentenceTopics collection reference for the current user.
 * @returns {firebase.firestore.CollectionReference}
 */
export function sentenceTopicsRef() {
  const db = getDb();
  const username = getUsername();
  return db.collection('users').doc(username).collection('sentenceTopics');
}

/**
 * Load all sentence topics for the current user, ordered by creation date (newest first).
 * @returns {Promise<Array<{ id: string, name: string, createdAt: any, sentenceCount: number, learnedCount: number }>>}
 */
export async function loadSentenceTopics() {
  const snapshot = await sentenceTopicsRef().orderBy('createdAt', 'desc').get();
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

/**
 * Create a new sentence topic.
 * @param {string} name  Topic display name
 * @returns {Promise<string>}  The new document ID
 */
export async function createSentenceTopic(name) {
  const docRef = await sentenceTopicsRef().add({
    name:          name.trim(),
    sentenceCount: 0,
    learnedCount:  0,
    createdAt:     firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt:     firebase.firestore.FieldValue.serverTimestamp(),
  });
  return docRef.id;
}

/**
 * Rename a sentence topic.
 * @param {string} topicId
 * @param {string} newName
 */
export async function renameSentenceTopic(topicId, newName) {
  await sentenceTopicsRef().doc(topicId).update({
    name:      newName.trim(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}

/**
 * Delete a sentence topic and its nested sentences subcollection.
 * Note: Firestore JS SDK does not cascade-delete subcollections automatically.
 * We manually delete subcollection docs first.
 * @param {string} topicId
 */
export async function deleteSentenceTopic(topicId) {
  const topicDoc = sentenceTopicsRef().doc(topicId);

  // Delete sentences subcollection
  const sentencesSnap = await topicDoc.collection('sentences').get();
  const batch = getDb().batch();
  sentencesSnap.docs.forEach((d) => batch.delete(d.ref));
  if (!sentencesSnap.empty) await batch.commit();

  // Delete the topic document itself
  await topicDoc.delete();
}

/**
 * Get the Firestore doc reference for a sentence topic.
 * Exposed so callers can batch a sentence write with a counter update
 * in a single atomic commit.
 * @param {string} topicId
 * @returns {firebase.firestore.DocumentReference}
 */
export function sentenceTopicDocRef(topicId) {
  return sentenceTopicsRef().doc(topicId);
}

/**
 * Recompute sentenceCount/learnedCount on a topic doc from the actual
 * sentences subcollection. Self-heals drift caused by interrupted writes.
 * @param {string} topicId
 * @returns {Promise<{ sentenceCount: number, learnedCount: number }>}
 */
export async function recalculateSentenceCounts(topicId) {
  const sentencesSnap = await sentenceTopicsRef().doc(topicId).collection('sentences').get();
  const sentenceCount = sentencesSnap.size;
  const learnedCount = sentencesSnap.docs.filter((d) => !!d.data().learned).length;
  await sentenceTopicsRef().doc(topicId).update({ sentenceCount, learnedCount });
  return { sentenceCount, learnedCount };
}

/**
 * Get a single sentence topic by ID.
 * @param {string} topicId
 * @returns {Promise<Object|null>}
 */
export async function getSentenceTopic(topicId) {
  const doc = await sentenceTopicsRef().doc(topicId).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

/* ------------------------------------------------------------------
 * Sentence-level (nested under a topic)
 * ----------------------------------------------------------------*/

/**
 * Get the sentences subcollection reference.
 * @param {string} topicId
 * @returns {firebase.firestore.CollectionReference}
 */
export function sentencesRef(topicId) {
  const db = getDb();
  const username = getUsername();
  return db
    .collection('users').doc(username)
    .collection('sentenceTopics').doc(topicId)
    .collection('sentences');
}

/**
 * Load all sentences in a topic, preserving user input order.
 * @param {string} topicId
 * @returns {Promise<Array<Object>>}
 */
export async function loadSentences(topicId) {
  const snapshot = await sentencesRef(topicId).get();
  const sentences = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  sentences.sort(compareSentencesByInputOrder);
  return sentences;
}

/**
 * Add a new sentence to a topic.
 * @param {string} topicId
 * @param {Object} data  { english, vietnamese, pattern, usage, notes, register, level, variations }
 * @returns {Promise<string>}  The new sentence ID
 */
export async function addSentence(topicId, data) {
  const sentenceRef = sentencesRef(topicId).doc();

  // Batch the sentence creation with the topic's sentenceCount increment so
  // both writes commit atomically — a partial write (e.g. page navigating
  // away mid-request) can no longer leave the cached count out of sync.
  const batch = getDb().batch();
  batch.set(sentenceRef, {
    english:     (data.english     || '').trim(),
    vietnamese:  (data.vietnamese  || '').trim(),
    pattern:     (data.pattern     || '').trim(),
    usage:       (data.usage       || '').trim(),
    notes:       (data.notes       || '').trim(),
    register:    (data.register    || '').trim(),
    level:       (data.level       || '').trim(),
    variations:  Array.isArray(data.variations) ? data.variations : [],
    learned:     false,
    learnedAt:   null,
    orderKey:    nextOrderKey(),
    createdAt:   firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt:   firebase.firestore.FieldValue.serverTimestamp(),
  });
  batch.update(sentenceTopicDocRef(topicId), {
    sentenceCount: firebase.firestore.FieldValue.increment(1),
  });
  await batch.commit();
  return sentenceRef.id;
}

/**
 * Update an existing sentence.
 * @param {string} topicId
 * @param {string} sentenceId
 * @param {Object} data  Partial update fields
 */
export async function updateSentence(topicId, sentenceId, data) {
  const update = {};
  if (data.english    !== undefined) update.english    = data.english.trim();
  if (data.vietnamese !== undefined) update.vietnamese = data.vietnamese.trim();
  if (data.pattern    !== undefined) update.pattern    = data.pattern.trim();
  if (data.usage      !== undefined) update.usage      = data.usage.trim();
  if (data.notes      !== undefined) update.notes      = data.notes.trim();
  if (data.register   !== undefined) update.register   = data.register.trim();
  if (data.level      !== undefined) update.level      = data.level.trim();
  if (data.variations !== undefined) update.variations = Array.isArray(data.variations) ? data.variations : [];
  update.updatedAt = firebase.firestore.FieldValue.serverTimestamp();

  await sentencesRef(topicId).doc(sentenceId).update(update);
}

/**
 * Save lazily-generated AI insights (usage, notes, register, variations)
 * for an already-saved sentence. Mirrors `saveWordInsights()` in
 * vocabulary.js — triggered on demand from the sparkle button, not during
 * the initial Add/Edit form fill.
 * @param {string} topicId
 * @param {string} sentenceId
 * @param {{ usage?: string, notes?: string, register?: string, variations?: string[] }} insights
 */
export async function saveSentenceInsights(topicId, sentenceId, insights) {
  await sentencesRef(topicId).doc(sentenceId).update({
    usage:      insights.usage      || '',
    notes:      insights.notes      || '',
    register:   insights.register   || '',
    variations: Array.isArray(insights.variations) ? insights.variations : [],
    aiInsightsGeneratedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}

/**
 * Delete a sentence from a topic.
 * @param {string} topicId
 * @param {string} sentenceId
 * @param {boolean} [wasLearned=false]
 */
export async function deleteSentence(topicId, sentenceId, wasLearned = false) {
  const batch = getDb().batch();
  batch.delete(sentencesRef(topicId).doc(sentenceId));
  const counterUpdate = { sentenceCount: firebase.firestore.FieldValue.increment(-1) };
  if (wasLearned) {
    counterUpdate.learnedCount = firebase.firestore.FieldValue.increment(-1);
  }
  batch.update(sentenceTopicDocRef(topicId), counterUpdate);
  await batch.commit();
}

/**
 * Toggle the learned status of a sentence.
 * @param {string} topicId
 * @param {string} sentenceId
 * @param {boolean} learned
 */
export async function toggleSentenceLearned(topicId, sentenceId, learned) {
  const batch = getDb().batch();
  batch.update(sentencesRef(topicId).doc(sentenceId), {
    learned:   !!learned,
    learnedAt: learned ? firebase.firestore.FieldValue.serverTimestamp() : null,
  });
  batch.update(sentenceTopicDocRef(topicId), {
    learnedCount: firebase.firestore.FieldValue.increment(learned ? 1 : -1),
  });
  await batch.commit();

  // Track streak on positive learning actions; reverse on un-learn
  if (learned) {
    try {
      await recordActivity({ type: 'learn', source: 'sentence' });
    } catch (err) {
      console.warn('Streak update failed:', err);
    }
  } else {
    try {
      await removeActivity({ type: 'learn', source: 'sentence' });
    } catch (err) {
      console.warn('Streak remove failed:', err);
    }
  }
}

/**
 * Find sentences that already exist in a topic's current sentence list.
 * Comparison is case-insensitive on the `english` field.
 * @param {string} topicId
 * @param {Array<{english?: string, vietnamese?: string}>} sentences  Candidate objects to check
 * @returns {Promise<Map<string, Array<{topicId: string, name: string, isCurrent: boolean}>>>}
 */
export async function findDuplicateSentences(topicId, sentences) {
  const topic = await getSentenceTopic(topicId);
  const existing = await loadSentences(topicId);
  const existingSet = new Set(
    existing.map((s) => (s.english || '').toLowerCase().trim()).filter(Boolean)
  );

  const result = new Map();
  for (const candidate of sentences) {
    const eng = (candidate.english || '').toLowerCase().trim();
    if (!eng) continue;
    if (existingSet.has(eng)) {
      result.set(candidate.english, [{ topicId, name: topic?.name || '', isCurrent: true }]);
    }
  }
  return result;
}
