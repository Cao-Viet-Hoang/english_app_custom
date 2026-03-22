/* ============================================================
   VOCABULARY MODULE
   Firestore CRUD for words inside a topic.
   Path: users/{username}/topics/{topicId}/words/{wordId}
   ============================================================ */

import { getDb } from '../core/firebase.js';
import { getUsername } from '../core/router.js';
import { updateWordCount, updateLearnedCount } from './topics.js';
import { recordActivity, removeActivity, getDailyEncouragement } from './streak.js';

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

  // Track streak on positive learning actions; reverse on un-learn
  if (learned) {
    try {
      const { streakData, isNewDay, milestone } = await recordActivity();
      if (milestone) {
        sessionStorage.setItem('streak_milestone', String(milestone));
      } else if (isNewDay) {
        const msg = getDailyEncouragement(streakData.currentStreak);
        if (msg) sessionStorage.setItem('streak_daily_encourage', msg);
      }
    } catch (err) {
      console.warn('Streak update failed:', err);
    }
  } else {
    try {
      await removeActivity();
    } catch (err) {
      console.warn('Streak remove failed:', err);
    }
  }
}

/**
 * Search for duplicate words across all topics.
 * @param {string[]} words  Array of English words to check
 * @param {string} [currentTopicId]  The current topic ID (to distinguish "same topic" vs "other topic")
 * @returns {Promise<Map<string, Array<{topicId: string, topicName: string, isCurrent: boolean}>>>}
 */
export async function findDuplicateWords(words, currentTopicId = null) {
  const db = getDb();
  const username = getUsername();
  const normalizedWords = new Set(words.map(w => w.toLowerCase().trim()).filter(Boolean));
  const result = new Map();

  const topicsSnap = await db.collection('users').doc(username).collection('topics').get();

  const topicPromises = topicsSnap.docs.map(async (topicDoc) => {
    const topicData = topicDoc.data();
    const tid = topicDoc.id;
    const isCurrent = tid === currentTopicId;
    const wordsSnap = await topicDoc.ref.collection('words').get();
    return { tid, topicName: topicData.name, isCurrent, wordDocs: wordsSnap.docs };
  });

  const allTopicData = await Promise.all(topicPromises);

  for (const { tid, topicName, isCurrent, wordDocs } of allTopicData) {
    for (const wordDoc of wordDocs) {
      const eng = (wordDoc.data().english || '').toLowerCase().trim();
      if (normalizedWords.has(eng)) {
        if (!result.has(eng)) result.set(eng, []);
        result.get(eng).push({ topicId: tid, topicName, isCurrent });
      }
    }
  }

  return result;
}

export async function saveWordInsights(topicId, wordId, insights) {
  await wordsRef(topicId).doc(wordId).update({
    aiInsights: insights,
    aiInsightsGeneratedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}
