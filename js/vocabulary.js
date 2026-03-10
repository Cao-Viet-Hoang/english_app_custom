/* ============================================================
   VOCABULARY MODULE
   Firestore CRUD for words inside a topic.
   Path: users/{username}/topics/{topicId}/words/{wordId}
   ============================================================ */

import { getDb } from './firebase.js';
import { getUsername } from './router.js';
import { updateWordCount, updateLearnedCount } from './topics.js';

let localOrderCounter = 0;

function nextOrderKey() {
  localOrderCounter += 1;
  return Date.now() * 1000 + localOrderCounter;
}

function getOrderKey(word) {
  const n = Number(word.orderKey);
  return Number.isFinite(n) ? n : null;
}

function getCreatedAtMs(word) {
  return word.createdAt && typeof word.createdAt.toMillis === 'function'
    ? word.createdAt.toMillis()
    : null;
}

function compareWordsByInputOrder(a, b) {
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

/**
 * Get the words subcollection reference.
 * @param {string} topicId
 * @returns {firebase.firestore.CollectionReference}
 */
function wordsRef(topicId) {
  const db = getDb();
  const username = getUsername();
  return db
    .collection('users').doc(username)
    .collection('topics').doc(topicId)
    .collection('words');
}

/**
 * Load all words in a topic, preserving user input order.
 * @param {string} topicId
 * @returns {Promise<Array<Object>>}
 */
export async function loadWords(topicId) {
  const snapshot = await wordsRef(topicId).get();
  const words = snapshot.docs.map((doc) => {
    const d = doc.data();
    // Backward compat: migrate old single `ipa` field -> ipaUS
    if (d.ipa && !d.ipaUS) {
      d.ipaUS = d.ipa;
    }
    return { id: doc.id, ...d };
  });
  words.sort(compareWordsByInputOrder);
  return words;
}

/**
 * Add a new word to a topic.
 * @param {string} topicId
 * @param {Object} data  { english, vietnamese, description, wordType, ipaUS, ipaUK }
 * @returns {Promise<string>}  The new word ID
 */
export async function addWord(topicId, data) {
  const docRef = await wordsRef(topicId).add({
    english:     (data.english     || '').trim(),
    vietnamese:  (data.vietnamese  || '').trim(),
    description: (data.description || '').trim(),
    wordType:    (data.wordType    || 'other').trim().toLowerCase(),
    ipaUS:       (data.ipaUS       || '').trim(),
    ipaUK:       (data.ipaUK       || '').trim(),
    createdAt:   firebase.firestore.FieldValue.serverTimestamp(),
    orderKey:    nextOrderKey(),
  });

  // Increment topic wordCount
  await updateWordCount(topicId, 1);
  return docRef.id;
}

/**
 * Update an existing word.
 * @param {string} topicId
 * @param {string} wordId
 * @param {Object} data  Partial update fields
 */
export async function updateWord(topicId, wordId, data) {
  const update = {};
  if (data.english     !== undefined) update.english     = data.english.trim();
  if (data.vietnamese  !== undefined) update.vietnamese  = data.vietnamese.trim();
  if (data.description !== undefined) update.description = data.description.trim();
  if (data.wordType    !== undefined) update.wordType    = data.wordType.trim().toLowerCase();
  if (data.ipaUS       !== undefined) update.ipaUS       = data.ipaUS.trim();
  if (data.ipaUK       !== undefined) update.ipaUK       = data.ipaUK.trim();
  update.updatedAt = firebase.firestore.FieldValue.serverTimestamp();

  await wordsRef(topicId).doc(wordId).update(update);
}

/**
 * Delete a word from a topic.
 * @param {string} topicId
 * @param {string} wordId
 */
export async function deleteWord(topicId, wordId, wasLearned = false) {
  await wordsRef(topicId).doc(wordId).delete();
  await updateWordCount(topicId, -1);
  if (wasLearned) {
    await updateLearnedCount(topicId, -1);
  }
}

/**
 * Save AI-generated insights for a word.
 * @param {string} topicId
 * @param {string} wordId
 * @param {Object} insights  The structured insights object from AI
 */
/**
 * Toggle the learned status of a word.
 * @param {string} topicId
 * @param {string} wordId
 * @param {boolean} learned
 */
export async function toggleWordLearned(topicId, wordId, learned) {
  await wordsRef(topicId).doc(wordId).update({
    learned: !!learned,
    learnedAt: learned ? firebase.firestore.FieldValue.serverTimestamp() : null,
  });
  await updateLearnedCount(topicId, learned ? 1 : -1);
}

export async function saveWordInsights(topicId, wordId, insights) {
  await wordsRef(topicId).doc(wordId).update({
    aiInsights: insights,
    aiInsightsGeneratedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}
