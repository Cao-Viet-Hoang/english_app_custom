/* ============================================================
   SRS LOGIC TESTS
   Run: node test/srs-logic.test.js
   ============================================================ */

import {
  DEFAULT_EASE,
  MIN_EASE,
  RATING,
  qualityOf,
  scheduleReview,
  initialSchedule,
  isDue,
  reviewWord,
} from '../js/features/srs-logic.js';

import {
  describe,
  it,
  assertEqual,
  assertDeepEqual,
  assertTrue,
  assertFalse,
  finish,
} from './harness.js';

// ------------------------------------------------------------
// qualityOf
// ------------------------------------------------------------

describe('qualityOf', () => {
  it('maps the four ratings to SM-2 quality scores', () => {
    assertEqual(qualityOf(RATING.AGAIN), 1);
    assertEqual(qualityOf(RATING.HARD), 3);
    assertEqual(qualityOf(RATING.GOOD), 4);
    assertEqual(qualityOf(RATING.EASY), 5);
  });
  it('passes through a raw numeric quality', () => {
    assertEqual(qualityOf(5), 5);
    assertEqual(qualityOf(0), 0);
  });
  it('falls back to Good for an unknown rating', () => {
    assertEqual(qualityOf('bogus'), 4);
  });
});

// ------------------------------------------------------------
// scheduleReview — the SM-2 core
// ------------------------------------------------------------

describe('scheduleReview interval ladder (always Good)', () => {
  it('first pass sets interval to 1 day', () => {
    const r = scheduleReview({ interval: 0, easeFactor: DEFAULT_EASE, repetitions: 0 }, RATING.GOOD);
    assertEqual(r.interval, 1);
    assertEqual(r.repetitions, 1);
  });
  it('second pass sets interval to 6 days', () => {
    const r = scheduleReview({ interval: 1, easeFactor: DEFAULT_EASE, repetitions: 1 }, RATING.GOOD);
    assertEqual(r.interval, 6);
    assertEqual(r.repetitions, 2);
  });
  it('third pass multiplies by the ease factor (6 * 2.5 = 15)', () => {
    const r = scheduleReview({ interval: 6, easeFactor: DEFAULT_EASE, repetitions: 2 }, RATING.GOOD);
    assertEqual(r.interval, 15);
    assertEqual(r.repetitions, 3);
  });
  it('produces the 1 -> 6 -> 15 -> 38 ladder (EF 2.5, rounded)', () => {
    let card = { interval: 0, easeFactor: DEFAULT_EASE, repetitions: 0 };
    const ladder = [];
    for (let i = 0; i < 4; i++) {
      card = scheduleReview(card, RATING.GOOD);
      ladder.push(card.interval);
    }
    assertDeepEqual(ladder, [1, 6, 15, 38]);
  });
});

describe('scheduleReview lapse (Again)', () => {
  it('resets repetitions and interval on failure', () => {
    const r = scheduleReview({ interval: 37, easeFactor: 2.5, repetitions: 4 }, RATING.AGAIN);
    assertEqual(r.repetitions, 0);
    assertEqual(r.interval, 1, 'review again tomorrow, not same day');
  });
  it('lowers the ease factor on failure', () => {
    const r = scheduleReview({ interval: 10, easeFactor: 2.5, repetitions: 3 }, RATING.AGAIN);
    assertTrue(r.easeFactor < 2.5);
  });
});

describe('scheduleReview ease factor behaviour', () => {
  it('Good leaves the ease factor unchanged (q=4)', () => {
    const r = scheduleReview({ interval: 6, easeFactor: 2.5, repetitions: 2 }, RATING.GOOD);
    assertEqual(Math.round(r.easeFactor * 100) / 100, 2.5);
  });
  it('Easy raises the ease factor (q=5)', () => {
    const r = scheduleReview({ interval: 6, easeFactor: 2.5, repetitions: 2 }, RATING.EASY);
    assertTrue(r.easeFactor > 2.5);
  });
  it('Hard lowers the ease factor (q=3)', () => {
    const r = scheduleReview({ interval: 6, easeFactor: 2.5, repetitions: 2 }, RATING.HARD);
    assertTrue(r.easeFactor < 2.5);
  });
  it('never drops the ease factor below the floor after repeated Hard', () => {
    let card = { interval: 1, easeFactor: DEFAULT_EASE, repetitions: 0 };
    for (let i = 0; i < 20; i++) {
      card = scheduleReview(card, RATING.HARD);
    }
    assertTrue(card.easeFactor >= MIN_EASE);
    assertEqual(card.easeFactor, MIN_EASE);
  });
});

describe('scheduleReview defaults', () => {
  it('assumes default ease/reps/interval when fields are missing', () => {
    const r = scheduleReview({}, RATING.GOOD);
    assertEqual(r.interval, 1);
    assertEqual(r.repetitions, 1);
    assertEqual(r.easeFactor, DEFAULT_EASE);
  });
});

// ------------------------------------------------------------
// initialSchedule
// ------------------------------------------------------------

describe('initialSchedule', () => {
  it('seeds a fresh card due today', () => {
    const s = initialSchedule('2026-07-12');
    assertEqual(s.srsRepetitions, 0);
    assertEqual(s.srsEaseFactor, DEFAULT_EASE);
    assertEqual(s.srsInterval, 0);
    assertEqual(s.srsDueDate, '2026-07-12');
  });
});

// ------------------------------------------------------------
// isDue
// ------------------------------------------------------------

describe('isDue', () => {
  const today = '2026-07-12';
  it('is false for a word that is not learned', () => {
    assertFalse(isDue({ learned: false, srsDueDate: '2026-07-01' }, today));
  });
  it('is true for a learned word with no schedule (legacy)', () => {
    assertTrue(isDue({ learned: true }, today));
  });
  it('is true when the due date is in the past', () => {
    assertTrue(isDue({ learned: true, srsDueDate: '2026-07-10' }, today));
  });
  it('is true when the due date is today', () => {
    assertTrue(isDue({ learned: true, srsDueDate: '2026-07-12' }, today));
  });
  it('is false when the due date is in the future', () => {
    assertFalse(isDue({ learned: true, srsDueDate: '2026-07-20' }, today));
  });
});

// ------------------------------------------------------------
// reviewWord — glue between a word doc and scheduleReview
// ------------------------------------------------------------

describe('reviewWord', () => {
  it('advances a freshly learned word one step on Good', () => {
    const word = { learned: true, srsRepetitions: 0, srsEaseFactor: 2.5, srsInterval: 0, srsDueDate: '2026-07-12' };
    const r = reviewWord(word, RATING.GOOD, '2026-07-12');
    assertEqual(r.srsRepetitions, 1);
    assertEqual(r.srsInterval, 1);
    assertEqual(r.srsDueDate, '2026-07-13', 'due tomorrow');
  });
  it('sends a lapsed word back to tomorrow', () => {
    const word = { learned: true, srsRepetitions: 3, srsEaseFactor: 2.4, srsInterval: 15, srsDueDate: '2026-07-12' };
    const r = reviewWord(word, RATING.AGAIN, '2026-07-12');
    assertEqual(r.srsRepetitions, 0);
    assertEqual(r.srsInterval, 1);
    assertEqual(r.srsDueDate, '2026-07-13');
  });
  it('handles a legacy learned word with no srs fields', () => {
    const word = { learned: true };
    const r = reviewWord(word, RATING.GOOD, '2026-07-12');
    assertEqual(r.srsRepetitions, 1);
    assertEqual(r.srsInterval, 1);
    assertEqual(r.srsDueDate, '2026-07-13');
  });
});

// ------------------------------------------------------------
// Multi-day simulation
// ------------------------------------------------------------

describe('simulation: a word reviewed Good every time it comes due', () => {
  it('grows the interval and pushes the due date out', () => {
    let word = { learned: true, ...initialSchedule('2026-07-12') };
    // Review on the day it is due, five times.
    let today = word.srsDueDate;
    const intervals = [];
    for (let i = 0; i < 5; i++) {
      const r = reviewWord(word, RATING.GOOD, today);
      word = { ...word, ...r };
      intervals.push(word.srsInterval);
      today = word.srsDueDate; // fast-forward to the next due date
    }
    assertDeepEqual(intervals, [1, 6, 15, 38, 95]);
  });
});

// ------------------------------------------------------------
finish();
