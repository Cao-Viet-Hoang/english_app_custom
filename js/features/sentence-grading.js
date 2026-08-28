/* ============================================================
   SENTENCE GRADING LOGIC (pure)
   Dependency-free grading math for the Sentence Patterns practice tool:
   text normalization, exact-match gating, word-level diff, and a
   character-level accuracy score. No Firestore, DOM, or globals here —
   safe to unit-test directly.

   Matching rules (locked product spec):
   - Case-insensitive
   - Punctuation-insensitive
   - Vietnamese diacritics MUST match exactly — no fuzzy/accent-insensitive
     folding. "toi di hoc" and "Tôi đi hoc" are both WRONG answers for
     "Tôi đi học".
   ============================================================ */

// Unicode punctuation (\p{P}) and symbol (\p{S}) classes — strips things like
// . , ! ? ; : " ' ( ) - / while leaving every letter (including Vietnamese
// diacritics) untouched.
const PUNCTUATION_RE = /[\p{P}\p{S}]/gu;

/**
 * Normalize text for grading comparisons: Unicode NFC-normalize, trim,
 * collapse internal whitespace to single spaces, lowercase, and (by default)
 * strip punctuation/symbols. Vietnamese diacritics are never altered or
 * stripped — only punctuation.
 * @param {string} text
 * @param {Object} [options]
 * @param {boolean} [options.stripPunctuation=true]
 * @returns {string}
 */
export function normalizeForGrading(text, { stripPunctuation = true } = {}) {
  let s = String(text ?? '').normalize('NFC');
  s = s.trim().replace(/\s+/g, ' ');
  s = s.toLowerCase();
  if (stripPunctuation) {
    s = s.replace(PUNCTUATION_RE, '');
    s = s.trim().replace(/\s+/g, ' ');
  }
  return s;
}

/**
 * Whether the user's input matches the correct answer for grading purposes.
 * Case- and punctuation-insensitive, but Vietnamese diacritics must match
 * exactly (no fuzzy accent folding). This is the only function that should
 * gate pass/fail for practice grading.
 * @param {string} userInput
 * @param {string} correctAnswer
 * @returns {boolean}
 */
export function isExactMatch(userInput, correctAnswer) {
  return normalizeForGrading(userInput) === normalizeForGrading(correctAnswer);
}

/**
 * Split text into display words: NFC-normalize, trim, and collapse internal
 * whitespace, but keep original case/punctuation for display.
 * @param {string} text
 * @returns {string[]}
 */
function splitWords(text) {
  const s = String(text ?? '').normalize('NFC').trim().replace(/\s+/g, ' ');
  return s ? s.split(' ') : [];
}

/**
 * Normalize a single word for diff comparison (case + punctuation
 * insensitive, diacritics preserved).
 * @param {string} word
 * @returns {string}
 */
function normalizeWord(word) {
  return word.toLowerCase().replace(PUNCTUATION_RE, '');
}

/**
 * Word-level diff between the user's input and the correct answer, aligned
 * via a classic LCS backtrack over the (normalized) word arrays. Adjacent
 * runs of unmatched words are paired up as substitutions ('wrong'); any
 * leftover unmatched words are reported as 'extra' (typed, shouldn't be
 * there) or 'missing' (should have been typed).
 * @param {string} userInput
 * @param {string} correctAnswer
 * @returns {Array<{ word: string, status: 'match'|'missing'|'extra'|'wrong', correct?: string }>}
 */
export function diffWords(userInput, correctAnswer) {
  const userWords = splitWords(userInput);
  const correctWords = splitWords(correctAnswer);
  const uNorm = userWords.map(normalizeWord);
  const cNorm = correctWords.map(normalizeWord);
  const m = uNorm.length;
  const n = cNorm.length;

  // Standard LCS length table.
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = uNorm[i - 1] === cNorm[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  // Backtrack to a raw op sequence: 'match' | 'delete' (extra) | 'insert' (missing).
  const rawOps = [];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (uNorm[i - 1] === cNorm[j - 1]) {
      rawOps.push({ type: 'match', userWord: userWords[i - 1], correctWord: correctWords[j - 1] });
      i -= 1;
      j -= 1;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      rawOps.push({ type: 'delete', userWord: userWords[i - 1] });
      i -= 1;
    } else {
      rawOps.push({ type: 'insert', correctWord: correctWords[j - 1] });
      j -= 1;
    }
  }
  while (i > 0) {
    rawOps.push({ type: 'delete', userWord: userWords[i - 1] });
    i -= 1;
  }
  while (j > 0) {
    rawOps.push({ type: 'insert', correctWord: correctWords[j - 1] });
    j -= 1;
  }
  rawOps.reverse();

  // Collapse adjacent delete/insert runs into paired substitutions ('wrong'),
  // leaving any count mismatch as leftover 'extra'/'missing'.
  const result = [];
  let idx = 0;
  while (idx < rawOps.length) {
    const op = rawOps[idx];
    if (op.type === 'match') {
      result.push({ word: op.userWord, status: 'match' });
      idx += 1;
      continue;
    }

    // Gather the whole contiguous unmatched run (deletes + inserts, any order).
    const extras = [];
    const missings = [];
    while (idx < rawOps.length && rawOps[idx].type !== 'match') {
      if (rawOps[idx].type === 'delete') extras.push(rawOps[idx].userWord);
      else missings.push(rawOps[idx].correctWord);
      idx += 1;
    }

    const pairCount = Math.min(extras.length, missings.length);
    for (let k = 0; k < pairCount; k++) {
      result.push({ word: extras[k], status: 'wrong', correct: missings[k] });
    }
    for (let k = pairCount; k < extras.length; k++) {
      result.push({ word: extras[k], status: 'extra' });
    }
    for (let k = pairCount; k < missings.length; k++) {
      result.push({ word: missings[k], status: 'missing' });
    }
  }

  return result;
}

/**
 * Levenshtein (edit) distance between two strings. Internal helper — not
 * part of the public grading surface.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function levenshteinDistance(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prevRow = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const currRow = [i];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      currRow.push(Math.min(
        prevRow[j] + 1,      // deletion
        currRow[j - 1] + 1,  // insertion
        prevRow[j - 1] + cost, // substitution
      ));
    }
    prevRow = currRow;
  }
  return prevRow[n];
}

/**
 * Character-level similarity between the user's input and the correct
 * answer, as a 0-100 integer percentage. Based on normalized Levenshtein
 * distance relative to the longer string's length.
 * @param {string} userInput
 * @param {string} correctAnswer
 * @returns {number} Integer 0-100.
 */
export function calculateAccuracy(userInput, correctAnswer) {
  const a = normalizeForGrading(userInput);
  const b = normalizeForGrading(correctAnswer);
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 100;

  const distance = levenshteinDistance(a, b);
  const ratio = 1 - distance / maxLen;
  const pct = Math.round(Math.max(0, Math.min(1, ratio)) * 100);
  return pct;
}
