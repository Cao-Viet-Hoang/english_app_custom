/* ============================================================
   SRS LOGIC (pure)
   Dependency-free spaced-repetition math (SM-2 / SuperMemo 2).
   No Firestore, DOM, or globals here — safe to unit-test directly.
   ============================================================ */

import { addDays } from './streak-logic.js';

// Default easiness factor for a brand-new card (SM-2 convention).
export const DEFAULT_EASE = 2.5;
// Easiness factor floor — prevents intervals from collapsing.
export const MIN_EASE = 1.3;

// The four self-grade buttons shown after flipping a card.
export const RATING = {
  AGAIN: 'again',
  HARD: 'hard',
  GOOD: 'good',
  EASY: 'easy',
};

// Map each rating to an SM-2 quality score (0–5).
// q < 3 is a lapse (card forgotten); q >= 3 is a pass.
const RATING_QUALITY = {
  [RATING.AGAIN]: 1,
  [RATING.HARD]: 3,
  [RATING.GOOD]: 4,
  [RATING.EASY]: 5,
};

/**
 * Resolve a rating (or raw quality number) to an SM-2 quality score 0–5.
 * @param {string|number} rating
 * @returns {number}
 */
export function qualityOf(rating) {
  if (typeof rating === 'number') return rating;
  const q = RATING_QUALITY[rating];
  return q === undefined ? RATING_QUALITY[RATING.GOOD] : q;
}

/**
 * Compute the next SM-2 scheduling state after a review. Pure — takes the
 * card's current scheduling state and a rating, returns the next state.
 * The caller derives the due date from `interval` (e.g. addDays(today, interval)).
 *
 * @param {Object} card
 * @param {number} [card.interval]     Current interval in days
 * @param {number} [card.easeFactor]   Current easiness factor
 * @param {number} [card.repetitions]  Consecutive successful reviews
 * @param {string|number} rating       A RATING value or raw quality 0–5
 * @returns {{ interval: number, easeFactor: number, repetitions: number }}
 */
export function scheduleReview(card = {}, rating = RATING.GOOD) {
  const q = qualityOf(rating);
  let interval = Number.isFinite(card.interval) ? card.interval : 0;
  let easeFactor = Number.isFinite(card.easeFactor) ? card.easeFactor : DEFAULT_EASE;
  let repetitions = Number.isFinite(card.repetitions) ? card.repetitions : 0;

  if (q < 3) {
    // Lapse: relearn from scratch, but review again tomorrow (not same day).
    repetitions = 0;
    interval = 1;
  } else {
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor);
    }
    repetitions += 1;
  }
  // Typical ladder when always Good (EF 2.5): 1 -> 6 -> 15 -> 38 -> 95 days.

  // Update easiness factor (applied on every review) and clamp to the floor.
  easeFactor += 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02);
  if (easeFactor < MIN_EASE) easeFactor = MIN_EASE;

  return { interval, easeFactor, repetitions };
}

/**
 * Build the fresh SRS scheduling fields for a word the moment it is learned.
 * Due immediately (today) so it enters the review queue right away.
 * @param {string} todayStr  "YYYY-MM-DD"
 * @returns {{ srsRepetitions: number, srsEaseFactor: number, srsInterval: number, srsDueDate: string }}
 */
export function initialSchedule(todayStr) {
  return {
    srsRepetitions: 0,
    srsEaseFactor: DEFAULT_EASE,
    srsInterval: 0,
    srsDueDate: todayStr,
  };
}

/**
 * Whether a word is due for review on the given day.
 * A learned word with no schedule yet (legacy data) counts as due.
 * @param {Object} word
 * @param {string} todayStr  "YYYY-MM-DD"
 * @returns {boolean}
 */
export function isDue(word = {}, todayStr) {
  if (!word.learned) return false;
  if (!word.srsDueDate) return true;
  return word.srsDueDate <= todayStr;
}

/**
 * Apply a review to a word's current scheduling fields and return the next
 * set of fields to persist (excluding the server timestamp, added by caller).
 * @param {Object} word      Word doc with srs* fields (may be missing/legacy)
 * @param {string|number} rating
 * @param {string} todayStr  "YYYY-MM-DD"
 * @returns {{ srsRepetitions: number, srsEaseFactor: number, srsInterval: number, srsDueDate: string }}
 */
export function reviewWord(word = {}, rating = RATING.GOOD, todayStr) {
  const next = scheduleReview(
    {
      interval: word.srsInterval,
      easeFactor: word.srsEaseFactor,
      repetitions: word.srsRepetitions,
    },
    rating,
  );
  return {
    srsRepetitions: next.repetitions,
    srsEaseFactor: next.easeFactor,
    srsInterval: next.interval,
    srsDueDate: addDays(todayStr, next.interval),
  };
}
