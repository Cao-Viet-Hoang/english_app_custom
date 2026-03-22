/* ============================================================
   PARAGRAPHS MODULE
   Firestore CRUD for AI-generated paragraphs inside a topic.
   Path: users/{username}/topics/{topicId}/paragraphs/{paraId}
   ============================================================ */

import { getDb } from './firebase.js';
import { getUsername } from './router.js';

/**
 * Get the paragraphs subcollection reference.
 * @param {string} topicId
 * @returns {firebase.firestore.CollectionReference}
 */
function paragraphsRef(topicId) {
  const db = getDb();
  const username = getUsername();
  return db
    .collection('users').doc(username)
    .collection('topics').doc(topicId)
    .collection('paragraphs');
}

/**
 * Load all paragraphs in a topic, newest first.
 * @param {string} topicId
 * @returns {Promise<Array<{ id: string, englishText: string, vietnameseText: string, createdAt: any }>>}
 */
export async function loadParagraphs(topicId) {
  const snapshot = await paragraphsRef(topicId)
    .orderBy('createdAt', 'desc')
    .get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

/**
 * Save a new paragraph.
 * @param {string} topicId
 * @param {{ englishText: string, vietnameseText: string, usedWords?: string[], customInstruction?: string }} data
 * @returns {Promise<string>}  The new paragraph ID
 */
export async function saveParagraph(topicId, data) {
  const doc = {
    englishText:    (data.englishText    || '').trim(),
    vietnameseText: (data.vietnameseText || '').trim(),
    createdAt:      firebase.firestore.FieldValue.serverTimestamp(),
  };
  if (Array.isArray(data.usedWords)) {
    doc.usedWords = data.usedWords;
  }
  if ((data.customInstruction || '').trim()) {
    doc.customInstruction = data.customInstruction.trim();
  }
  const docRef = await paragraphsRef(topicId).add(doc);
  return docRef.id;
}

/**
 * Delete a paragraph.
 * @param {string} topicId
 * @param {string} paraId
 */
export async function deleteParagraph(topicId, paraId) {
  await paragraphsRef(topicId).doc(paraId).delete();
}
