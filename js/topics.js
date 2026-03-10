/* ============================================================
   TOPICS MODULE
   Firestore CRUD for topics: create, rename, delete, list.
   Path: users/{username}/topics/{topicId}
   ============================================================ */

import { getDb } from './firebase.js';
import { getUsername } from './router.js';

/**
 * Get the topics collection reference for the current user.
 * @returns {firebase.firestore.CollectionReference}
 */
function topicsRef() {
  const db = getDb();
  const username = getUsername();
  return db.collection('users').doc(username).collection('topics');
}

/**
 * Load all topics for the current user, ordered by creation date (newest first).
 * @returns {Promise<Array<{ id: string, name: string, createdAt: any, wordCount: number }>>}
 */
export async function loadTopics() {
  const snapshot = await topicsRef().orderBy('createdAt', 'desc').get();
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

/**
 * Create a new topic.
 * @param {string} name  Topic display name
 * @returns {Promise<string>}  The new document ID
 */
export async function createTopic(name) {
  const docRef = await topicsRef().add({
    name:      name.trim(),
    wordCount: 0,
    learnedCount: 0,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  return docRef.id;
}

/**
 * Rename a topic.
 * @param {string} topicId
 * @param {string} newName
 */
export async function renameTopic(topicId, newName) {
  await topicsRef().doc(topicId).update({
    name:      newName.trim(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}

/**
 * Delete a topic and all its subcollections (words, paragraphs).
 * Note: Firestore JS SDK does not cascade-delete subcollections automatically.
 * We manually delete subcollection docs first.
 * @param {string} topicId
 */
export async function deleteTopic(topicId) {
  const topicDoc = topicsRef().doc(topicId);

  // Delete words subcollection
  const wordsSnap = await topicDoc.collection('words').get();
  const batch1 = getDb().batch();
  wordsSnap.docs.forEach((d) => batch1.delete(d.ref));
  if (!wordsSnap.empty) await batch1.commit();

  // Delete paragraphs subcollection
  const parasSnap = await topicDoc.collection('paragraphs').get();
  const batch2 = getDb().batch();
  parasSnap.docs.forEach((d) => batch2.delete(d.ref));
  if (!parasSnap.empty) await batch2.commit();

  // Delete the topic document itself
  await topicDoc.delete();
}

/**
 * Update the cached wordCount on a topic doc.
 * Called after adding / deleting vocabulary words.
 * @param {string} topicId
 * @param {number} delta   +1 or -1
 */
export async function updateWordCount(topicId, delta) {
  await topicsRef().doc(topicId).update({
    wordCount: firebase.firestore.FieldValue.increment(delta),
  });
}

/**
 * Update the cached learnedCount on a topic doc.
 * @param {string} topicId
 * @param {number} delta   +1 or -1
 */
export async function updateLearnedCount(topicId, delta) {
  await topicsRef().doc(topicId).update({
    learnedCount: firebase.firestore.FieldValue.increment(delta),
  });
}

/**
 * Get a single topic by ID.
 * @param {string} topicId
 * @returns {Promise<Object|null>}
 */
export async function getTopic(topicId) {
  const doc = await topicsRef().doc(topicId).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}
