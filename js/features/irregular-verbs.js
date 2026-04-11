/* ============================================================
   IRREGULAR VERBS MODULE
   Firestore CRUD for irregular verbs.
   Path: users/{username}/irregularVerbs/{verbId}
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
 * Detect verb conjugation pattern from the three forms.
 * @param {string} base
 * @param {string} pastSimple
 * @param {string} pastParticiple
 * @returns {string} "AAA" | "ABB" | "ABA" | "ABC"
 */
export function detectVerbPattern(base, pastSimple, pastParticiple) {
  const b = (base || '').toLowerCase().trim();
  const p2 = (pastSimple || '').toLowerCase().trim();
  const p3 = (pastParticiple || '').toLowerCase().trim();
  if (b === p2 && b === p3) return 'AAA';
  if (b === p3 && b !== p2) return 'ABA';
  if (p2 === p3 && b !== p2) return 'ABB';
  return 'ABC';
}

/**
 * Get the irregular verbs collection reference.
 * @returns {firebase.firestore.CollectionReference}
 */
function verbsRef() {
  const db = getDb();
  const username = getUsername();
  return db.collection('users').doc(username).collection('irregularVerbs');
}

/**
 * Load all irregular verbs, sorted by orderKey (input order).
 * @returns {Promise<Array<Object>>}
 */
export async function loadIrregularVerbs() {
  const snapshot = await verbsRef().get();
  const verbs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  verbs.sort((a, b) => {
    const aKey = Number(a.orderKey) || 0;
    const bKey = Number(b.orderKey) || 0;
    return aKey - bKey;
  });
  return verbs;
}

/**
 * Add a new irregular verb.
 * @param {Object} data  { base, pastSimple, pastParticiple, vietnamese, ipaBase }
 * @returns {Promise<string>}  The new verb ID
 */
export async function addIrregularVerb(data) {
  const base          = (data.base          || '').trim().toLowerCase();
  const pastSimple    = (data.pastSimple    || '').trim().toLowerCase();
  const pastParticiple = (data.pastParticiple || '').trim().toLowerCase();
  const vietnamese    = (data.vietnamese    || '').trim();
  const ipaBase       = (data.ipaBase       || '').trim();
  const pattern       = detectVerbPattern(base, pastSimple, pastParticiple);

  const docRef = await verbsRef().add({
    base,
    pastSimple,
    pastParticiple,
    vietnamese,
    ipaBase,
    pattern,
    learned: false,
    orderKey: nextOrderKey(),
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  return docRef.id;
}

/**
 * Update an existing irregular verb.
 * @param {string} verbId
 * @param {Object} data  Partial update fields
 */
export async function updateIrregularVerb(verbId, data) {
  const update = {};
  if (data.base          !== undefined) update.base          = data.base.trim().toLowerCase();
  if (data.pastSimple    !== undefined) update.pastSimple    = data.pastSimple.trim().toLowerCase();
  if (data.pastParticiple !== undefined) update.pastParticiple = data.pastParticiple.trim().toLowerCase();
  if (data.vietnamese    !== undefined) update.vietnamese    = data.vietnamese.trim();
  if (data.ipaBase       !== undefined) update.ipaBase       = data.ipaBase.trim();

  // Recompute pattern if any form changed
  if (data.base !== undefined || data.pastSimple !== undefined || data.pastParticiple !== undefined) {
    update.pattern = detectVerbPattern(
      update.base          ?? data.base          ?? '',
      update.pastSimple    ?? data.pastSimple    ?? '',
      update.pastParticiple ?? data.pastParticiple ?? '',
    );
  }

  update.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
  await verbsRef().doc(verbId).update(update);
}

/**
 * Delete an irregular verb.
 * @param {string} verbId
 * @param {boolean} [wasLearned]
 */
export async function deleteIrregularVerb(verbId, wasLearned = false) {
  await verbsRef().doc(verbId).delete();
  if (wasLearned) {
    try { await removeActivity(); } catch { /* ignore */ }
  }
}

/**
 * Toggle the learned status of an irregular verb.
 * @param {string} verbId
 * @param {boolean} learned
 */
export async function toggleVerbLearned(verbId, learned) {
  await verbsRef().doc(verbId).update({
    learned: !!learned,
    learnedAt: learned ? firebase.firestore.FieldValue.serverTimestamp() : null,
  });

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
 * Get verb count stats: total and learned.
 * @returns {Promise<{ total: number, learned: number }>}
 */
export async function getVerbStats() {
  const verbs = await loadIrregularVerbs();
  return {
    total: verbs.length,
    learned: verbs.filter(v => v.learned).length,
  };
}
