/* ============================================================
   FEEDBACK BUILDER
   Shared helpers for building AI feedback UI in writing modes:
   score badges, error cards, diff comparison, and LCS-based
   inline diff between user text and corrected text.
   ============================================================ */

import { escapeHtml, escapeAttr } from '../ui/utils.js';

// ----------------------------------------------------------------
// Constants
// ----------------------------------------------------------------

export const ERROR_TYPE_LABELS = {
  grammar: 'Grammar',
  word_choice: 'Word Choice',
  spelling: 'Spelling',
  punctuation: 'Punctuation',
  word_order: 'Word Order',
};

export const WORD_TYPE_LABELS = {
  noun: 'Noun',
  verb: 'Verb',
  adj: 'Adjective',
  adv: 'Adverb',
  phrase: 'Phrase',
  other: 'Other',
};

// ----------------------------------------------------------------
// Score badge
// ----------------------------------------------------------------

/**
 * Build a colored score badge.
 * @param {number} score  0-10
 * @param {string} label  e.g. "Grammar", "Usage"
 * @returns {string} HTML
 */
export function buildScoreBadge(score, label) {
  const cls = score >= 7 ? 'score-high' : score >= 5 ? 'score-mid' : 'score-low';
  return `
    <div class="score-badge ${cls}">
      <span class="score-badge-value">${score}</span>
      <span class="score-badge-label">${label}</span>
    </div>
  `;
}

// ----------------------------------------------------------------
// Diff comparison (side-by-side user vs corrected)
// ----------------------------------------------------------------

/**
 * Build the side-by-side diff comparison HTML.
 * @param {{ userHtml: string, correctedHtml: string }} diffHtml
 * @param {string} userLabel
 * @param {string} correctedLabel
 * @returns {string} HTML
 */
export function buildDiffComparisonHtml(diffHtml, userLabel, correctedLabel) {
  return `
    <div class="fb-diff-comparison">
      <div class="fb-diff-col fb-diff-col--user">
        <div class="fb-diff-col-label">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          ${userLabel}
        </div>
        <div class="fb-diff-col-text">${diffHtml.userHtml}</div>
      </div>
      <div class="fb-diff-col fb-diff-col--corrected">
        <div class="fb-diff-col-label">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
          ${correctedLabel}
        </div>
        <div class="fb-diff-col-text">${diffHtml.correctedHtml}</div>
      </div>
    </div>
  `;
}

// ----------------------------------------------------------------
// Error cards
// ----------------------------------------------------------------

/**
 * Deduplicate grammar errors that share the same original+corrected text.
 * @param {Array} errors
 * @returns {Array}
 */
export function deduplicateErrors(errors) {
  if (!errors || errors.length === 0) return [];
  const map = new Map();
  for (const err of errors) {
    const key = (err.original || '').toLowerCase().trim() + '||' + (err.corrected || '').toLowerCase().trim();
    if (map.has(key)) {
      const existing = map.get(key);
      const newExpl = (err.explanation || '').trim();
      if (newExpl && !existing.explanation.includes(newExpl)) {
        existing.explanation += '\n' + newExpl;
      }
    } else {
      map.set(key, { ...err, explanation: (err.explanation || '').trim() });
    }
  }
  return [...map.values()];
}

/**
 * Build error cards HTML for grammar/writing errors.
 * @param {Array} grammarErrors
 * @returns {string} HTML
 */
export function buildErrorCardsHtml(grammarErrors) {
  const errors = deduplicateErrors(grammarErrors);
  if (errors.length === 0) return '';

  return `
    <div class="fb-errors-section">
      <div class="fb-errors-title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        Error Details (${errors.length})
      </div>
      ${errors.map((err, i) => `
        <div class="fb-error-card">
          <div class="fb-error-header">
            <span class="fb-error-num">${i + 1}</span>
            <span class="fb-error-type fb-error-type--${escapeHtml(err.type || 'grammar')}">${ERROR_TYPE_LABELS[err.type] || 'Error'}</span>
            <button class="fb-error-explain-btn" title="Explain with AI"
              data-original="${escapeAttr(err.original || '')}"
              data-corrected="${escapeAttr(err.corrected || '')}"
              data-explanation="${escapeAttr(err.explanation || '')}"
              data-type="${escapeAttr(err.type || 'grammar')}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              AI
            </button>
            <button class="fb-error-save-btn" title="Save to My Notes"
              data-original="${escapeAttr(err.original || '')}"
              data-corrected="${escapeAttr(err.corrected || '')}"
              data-explanation="${escapeAttr(err.explanation || '')}"
              data-type="${escapeAttr(err.type || 'grammar')}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
            </button>
          </div>
          <div class="fb-error-diff">
            <div class="fb-error-wrong">
              <span class="fb-error-icon">&#10007;</span>
              <span>${escapeHtml(err.original || '')}</span>
            </div>
            ${err.vietnameseOriginal ? `<div class="fb-error-vi">${escapeHtml(err.vietnameseOriginal)}</div>` : ''}
            <div class="fb-error-arrow">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg>
            </div>
            <div class="fb-error-right">
              <span class="fb-error-icon">&#10003;</span>
              <span>${escapeHtml(err.corrected || '')}</span>
            </div>
            ${err.vietnameseCorrected ? `<div class="fb-error-vi fb-error-vi--correct">${escapeHtml(err.vietnameseCorrected)}</div>` : ''}
          </div>
          <div class="fb-error-explanation">${escapeHtml(err.explanation || '').replace(/\n/g, '<br>')}</div>
        </div>
      `).join('')}
    </div>
  `;
}

// ----------------------------------------------------------------
// Word choice suggestions
// ----------------------------------------------------------------

/**
 * Build word choice suggestion cards HTML.
 * @param {Array<{ userWord: string, suggestedWord: string, reason: string }>} suggestions
 * @returns {string} HTML
 */
export function buildWordChoiceHtml(suggestions) {
  if (!suggestions || suggestions.length === 0) return '';

  return `
    <div class="fb-wordchoice-section">
      <div class="fb-wordchoice-title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
        Word Choice Suggestions
      </div>
      ${suggestions.map(s => `
        <div class="fb-wordchoice-card">
          <div class="fb-wordchoice-swap">
            <span class="fb-wordchoice-user">${escapeHtml(s.userWord || '')}</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
            <span class="fb-wordchoice-suggested">${escapeHtml(s.suggestedWord || '')}</span>
          </div>
          <div class="fb-wordchoice-reason">${escapeHtml(s.reason || '')}</div>
        </div>
      `).join('')}
    </div>
  `;
}

// ----------------------------------------------------------------
// LCS-based inline diff
// ----------------------------------------------------------------

/**
 * Compute LCS (Longest Common Subsequence) of two string arrays (case-insensitive).
 * @param {string[]} a
 * @param {string[]} b
 * @returns {string[]}
 */
export function buildLCS(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1].toLowerCase() === b[j - 1].toLowerCase()
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  const result = [];
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1].toLowerCase() === b[j - 1].toLowerCase()) {
      result.unshift(a[i - 1]);
      i--; j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }
  return result;
}

/**
 * Build inline word-level diff between user text and corrected text.
 * @param {string} userText
 * @param {string} correctedText
 * @returns {{ userHtml: string, correctedHtml: string }}
 */
export function buildInlineDiff(userText, correctedText) {
  const userWords = userText.split(/(\s+)/);
  const corrWords = correctedText.split(/(\s+)/);

  const userTokens = userWords.filter(w => w.trim());
  const corrTokens = corrWords.filter(w => w.trim());
  const lcs = buildLCS(userTokens, corrTokens);

  let ui = 0, ci = 0, li = 0;
  const userParts = [], corrParts = [];

  while (ui < userTokens.length || ci < corrTokens.length) {
    if (li < lcs.length && ui < userTokens.length && ci < corrTokens.length
        && userTokens[ui].toLowerCase() === lcs[li].toLowerCase()
        && corrTokens[ci].toLowerCase() === lcs[li].toLowerCase()) {
      userParts.push(escapeHtml(userTokens[ui]));
      corrParts.push(escapeHtml(corrTokens[ci]));
      ui++; ci++; li++;
    } else if (li < lcs.length && ci < corrTokens.length
               && corrTokens[ci].toLowerCase() === lcs[li].toLowerCase()) {
      userParts.push(`<span class="fb-diff-del">${escapeHtml(userTokens[ui])}</span>`);
      ui++;
    } else if (li < lcs.length && ui < userTokens.length
               && userTokens[ui].toLowerCase() === lcs[li].toLowerCase()) {
      corrParts.push(`<span class="fb-diff-add">${escapeHtml(corrTokens[ci])}</span>`);
      ci++;
    } else {
      if (ui < userTokens.length) {
        userParts.push(`<span class="fb-diff-del">${escapeHtml(userTokens[ui])}</span>`);
        ui++;
      }
      if (ci < corrTokens.length) {
        corrParts.push(`<span class="fb-diff-add">${escapeHtml(corrTokens[ci])}</span>`);
        ci++;
      }
    }
  }

  return {
    userHtml: userParts.join(' '),
    correctedHtml: corrParts.join(' '),
  };
}
