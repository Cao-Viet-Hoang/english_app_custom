/* ============================================================
   SENTENCE GRADING LOGIC TESTS
   Run: node test/sentence-grading.test.js
   ============================================================ */

import {
  normalizeForGrading,
  isExactMatch,
  diffWords,
  calculateAccuracy,
} from '../js/features/sentence-grading.js';

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
// normalizeForGrading
// ------------------------------------------------------------

describe('normalizeForGrading', () => {
  it('lowercases and collapses whitespace', () => {
    assertEqual(normalizeForGrading('Hello   World'), 'hello world');
  });
  it('strips punctuation by default', () => {
    assertEqual(normalizeForGrading('Hello, world!'), 'hello world');
  });
  it('keeps punctuation when stripPunctuation is false', () => {
    assertEqual(normalizeForGrading('Hello, world!', { stripPunctuation: false }), 'hello, world!');
  });
  it('preserves Vietnamese diacritics', () => {
    assertEqual(normalizeForGrading('Tôi đi học.'), 'tôi đi học');
  });
});

// ------------------------------------------------------------
// isExactMatch
// ------------------------------------------------------------

describe('isExactMatch — case and punctuation insensitivity', () => {
  it('matches despite different case', () => {
    assertTrue(isExactMatch('Hello World.', 'hello world'));
  });
  it('matches despite punctuation differences', () => {
    assertTrue(isExactMatch('Hello, world!', 'Hello world?'));
  });
  it('does not match genuinely different sentences', () => {
    assertFalse(isExactMatch('Hello world', 'Goodbye world'));
  });
});

describe('isExactMatch — Vietnamese diacritics must match exactly', () => {
  it('fails when diacritics are entirely missing', () => {
    assertFalse(isExactMatch('Toi di hoc', 'Tôi đi học'));
  });
  it('fails when a single diacritic is wrong', () => {
    assertFalse(isExactMatch('Tôi đi hoc', 'Tôi đi học'));
  });
  it('matches when only case differs', () => {
    assertTrue(isExactMatch('tôi đi học', 'Tôi đi học'));
  });
  it('matches despite extra internal whitespace', () => {
    assertTrue(isExactMatch('Tôi   đi học', 'Tôi đi học'));
  });
});

// ------------------------------------------------------------
// diffWords
// ------------------------------------------------------------

describe('diffWords', () => {
  it('marks every word as match for an identical sentence', () => {
    const result = diffWords('The cat sat', 'The cat sat');
    assertDeepEqual(result, [
      { word: 'The', status: 'match' },
      { word: 'cat', status: 'match' },
      { word: 'sat', status: 'match' },
    ]);
  });

  it('marks a single wrong word as a paired substitution', () => {
    const result = diffWords('The dog sat', 'The cat sat');
    assertDeepEqual(result, [
      { word: 'The', status: 'match' },
      { word: 'dog', status: 'wrong', correct: 'cat' },
      { word: 'sat', status: 'match' },
    ]);
  });

  it('marks a missing word', () => {
    const result = diffWords('The sat', 'The cat sat');
    assertDeepEqual(result, [
      { word: 'The', status: 'match' },
      { word: 'cat', status: 'missing' },
      { word: 'sat', status: 'match' },
    ]);
  });

  it('marks an extra word', () => {
    const result = diffWords('The big cat sat', 'The cat sat');
    assertDeepEqual(result, [
      { word: 'The', status: 'match' },
      { word: 'big', status: 'extra' },
      { word: 'cat', status: 'match' },
      { word: 'sat', status: 'match' },
    ]);
  });

  it('is case/punctuation insensitive for match detection', () => {
    const result = diffWords('the cat sat.', 'The cat sat');
    assertDeepEqual(result, [
      { word: 'the', status: 'match' },
      { word: 'cat', status: 'match' },
      { word: 'sat.', status: 'match' },
    ]);
  });
});

// ------------------------------------------------------------
// calculateAccuracy
// ------------------------------------------------------------

describe('calculateAccuracy', () => {
  it('returns 100 for an exact match', () => {
    assertEqual(calculateAccuracy('Hello world', 'hello world'), 100);
  });
  it('returns 100 for two empty strings', () => {
    assertEqual(calculateAccuracy('', ''), 100);
  });
  it('returns 0 for completely different strings of similar length', () => {
    assertEqual(calculateAccuracy('abcde', 'vwxyz'), 0);
  });
  it('returns a mid-range value for a one-word-off sentence', () => {
    const pct = calculateAccuracy('The dog sat on the mat', 'The cat sat on the mat');
    assertTrue(pct > 50 && pct < 100, `expected a mid-range value, got ${pct}`);
  });
});

// ------------------------------------------------------------
finish();
