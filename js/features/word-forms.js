/* ============================================================
   WORD FORMS MODULE
   Firestore CRUD for word forms.
   Path: users/{username}/wordForms/{formId}
   ============================================================ */

import { getDb } from '../core/firebase.js';
import { getUsername } from '../core/router.js';
import { recordActivity, removeActivity, getDailyEncouragement } from './streak.js';

let localOrderCounter = 0;

function nextOrderKey() {
  localOrderCounter += 1;
  return Date.now() * 1000 + localOrderCounter;
}

/**
 * Get the word forms collection reference.
 * @returns {firebase.firestore.CollectionReference}
 */
export function wordFormsRef() {
  const db = getDb();
  const username = getUsername();
  return db.collection('users').doc(username).collection('wordForms');
}

/**
 * Load all word forms, sorted by orderKey (input order).
 * @returns {Promise<Array<Object>>}
 */
export async function loadWordForms() {
  const snapshot = await wordFormsRef().get();
  const forms = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  forms.sort((a, b) => {
    const aKey = Number(a.orderKey) || 0;
    const bKey = Number(b.orderKey) || 0;
    return aKey - bKey;
  });
  return forms;
}

/**
 * Add a new word form entry.
 * @param {Object} data  { baseWord, baseType, noun, verb, adjective, adverb }
 * @returns {Promise<string>}  The new document ID
 */
export async function addWordForm(data) {
  const baseType  = (data.baseType  || 'noun').trim().toLowerCase();
  const noun      = (data.noun      || '').trim().toLowerCase();
  const verb      = (data.verb      || '').trim().toLowerCase();
  const adjective = (data.adjective || '').trim().toLowerCase();
  const adverb    = (data.adverb    || '').trim().toLowerCase();

  const docRef = await wordFormsRef().add({
    baseType,
    noun,
    verb,
    adjective,
    adverb,
    learned: false,
    orderKey: nextOrderKey(),
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  return docRef.id;
}

/**
 * Update an existing word form entry (partial update).
 * @param {string} formId
 * @param {Object} data  Partial fields to update
 */
export async function updateWordForm(formId, data) {
  const update = {};
  if (data.baseType  !== undefined) update.baseType  = data.baseType.trim().toLowerCase();
  if (data.noun      !== undefined) update.noun      = data.noun.trim().toLowerCase();
  if (data.verb      !== undefined) update.verb      = data.verb.trim().toLowerCase();
  if (data.adjective !== undefined) update.adjective = data.adjective.trim().toLowerCase();
  if (data.adverb    !== undefined) update.adverb    = data.adverb.trim().toLowerCase();
  update.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
  await wordFormsRef().doc(formId).update(update);
}

/**
 * Delete a word form entry.
 * @param {string} formId
 * @param {boolean} [wasLearned]
 */
export async function deleteWordForm(formId, wasLearned = false) {
  await wordFormsRef().doc(formId).delete();
  if (wasLearned) {
    try {
      await removeActivity({ type: 'learn', source: 'wordForm' });
    } catch {
      /* ignore */
    }
  }
}

/**
 * Toggle the learned status of a word form entry.
 * @param {string} formId
 * @param {boolean} learned
 */
export async function toggleWordFormLearned(formId, learned) {
  await wordFormsRef().doc(formId).update({
    learned: !!learned,
    learnedAt: learned ? firebase.firestore.FieldValue.serverTimestamp() : null,
  });

  if (learned) {
    try {
      const { streakData, isNewDay, milestone } = await recordActivity({
        type: 'learn',
        source: 'wordForm',
      });
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
      await removeActivity({ type: 'learn', source: 'wordForm' });
    } catch (err) {
      console.warn('Streak remove failed:', err);
    }
  }
}

/**
 * Find which base words already exist in the user's word forms collection.
 * Returns a Map compatible with the shared bulk-add-utils format:
 *   key → [{ name: string, isCurrent: boolean }]
 *
 * @param {string[]} words  Array of base words to check
 * @returns {Promise<Map<string, Array<{name:string, isCurrent:boolean}>>>}
 */
export async function findDuplicateWordForms(words) {
  const forms = await loadWordForms();
  const existing = new Set(
    forms.map(f => (f[f.baseType] || f.noun || f.verb || f.adjective || f.adverb || '').toLowerCase())
  );
  const result = new Map();
  for (const word of words) {
    const key = word.toLowerCase().trim();
    if (existing.has(key)) {
      result.set(key, [{ name: 'Word Forms', isCurrent: true }]);
    }
  }
  return result;
}

/**
 * Get word form count stats: total and learned.
 * @returns {Promise<{ total: number, learned: number }>}
 */
export async function getWordFormStats() {
  const forms = await loadWordForms();
  return {
    total: forms.length,
    learned: forms.filter(f => f.learned).length,
  };
}
