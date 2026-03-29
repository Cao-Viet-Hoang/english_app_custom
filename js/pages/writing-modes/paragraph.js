/* ============================================================
   PARAGRAPH WRITING MODE
   ============================================================ */

import { evaluateParagraph } from '../../ai/writing-ai.js';
import { escapeHtml } from '../../ui/utils.js';
import { showToast } from '../../ui/toast.js';
import { shuffle } from '../../shared/shuffle.js';
import { handleStreakRecord } from '../../shared/streak-handler.js';
import {
  buildScoreBadge,
  buildDiffComparisonHtml,
  buildErrorCardsHtml,
  buildWordChoiceHtml,
  buildInlineDiff,
} from '../../ai/feedback-builder.js';

let pwWords = [];
let pwAllWords = [];
let pwTopicName = '';

export function initParagraphMode(allWords, topicId, topicName = '') {
  pwAllWords = allWords;
  pwTopicName = topicName;
  pwWords = shuffle(allWords).slice(0, Math.min(5, allWords.length));

  const container = document.getElementById('pw-container');
  const result = document.getElementById('pw-result');
  container.style.display = '';
  container.classList.remove('has-feedback');
  result.classList.add('hidden');

  showParagraphPrompt(topicId);
}

function showParagraphPrompt(topicId) {
  // Display target words
  const wordsEl = document.getElementById('pw-words');
  wordsEl.innerHTML = pwWords.map(w =>
    `<span class="target-word-badge">${escapeHtml(w.english)}</span>`
  ).join('');

  // Reset input
  const input = document.getElementById('pw-input');
  input.value = '';
  input.disabled = false;
  input.focus();

  const checkBtn = document.getElementById('pw-btn-check');
  checkBtn.disabled = true;
  document.getElementById('pw-feedback').classList.add('hidden');
  document.getElementById('pw-action-row').style.display = 'none';
  document.getElementById('pw-container').classList.remove('has-feedback');

  input.oninput = () => {
    checkBtn.disabled = input.value.trim().length === 0;
  };

  checkBtn.onclick = () => handleParagraphCheck(topicId);

  // Rewrite — keep current text for editing and resubmit
  document.getElementById('pw-btn-rewrite').onclick = () => {
    document.getElementById('pw-feedback').classList.add('hidden');
    document.getElementById('pw-action-row').style.display = 'none';
    document.getElementById('pw-container').classList.remove('has-feedback');
    input.disabled = false;
    input.focus();
    checkBtn.disabled = input.value.trim().length === 0;
  };

  document.getElementById('pw-btn-retry').onclick = () => {
    document.getElementById('pw-feedback').classList.add('hidden');
    document.getElementById('pw-action-row').style.display = 'none';
    document.getElementById('pw-container').classList.remove('has-feedback');
    input.value = '';
    input.disabled = false;
    input.focus();
    checkBtn.disabled = true;
  };

  document.getElementById('pw-btn-new').onclick = () => {
    pwWords = shuffle(shuffle(pwAllWords)).slice(0, Math.min(5, pwAllWords.length));
    showParagraphPrompt(topicId);
  };
}

async function handleParagraphCheck(topicId) {
  const input = document.getElementById('pw-input');
  const paragraph = input.value.trim();
  if (!paragraph) return;

  input.disabled = true;
  document.getElementById('pw-btn-check').disabled = true;

  const feedbackEl = document.getElementById('pw-feedback');
  feedbackEl.classList.remove('hidden');
  feedbackEl.innerHTML = '<div class="ai-loading"><div class="spinner"></div><span class="ai-loading-text">Evaluating...</span></div>';

  try {
    const result = await evaluateParagraph(pwWords, paragraph, pwTopicName, pwAllWords);

    if (result.overallScore >= 6) {
      handleStreakRecord();
    }

    feedbackEl.innerHTML = buildParagraphFeedback(result, paragraph);
    document.getElementById('pw-container').classList.add('has-feedback');
    document.getElementById('pw-action-row').style.display = '';
  } catch (err) {
    console.error('Paragraph eval error:', err);
    feedbackEl.innerHTML = '';
    feedbackEl.classList.add('hidden');
    showToast('AI evaluation failed. ' + (err.message || ''), 'error');
    input.disabled = false;
    document.getElementById('pw-btn-check').disabled = false;
  }
}

function buildParagraphFeedback(result, userParagraph) {
  const diffHtml = buildInlineDiff(userParagraph, result.correctedParagraph);

  const wordCoverage = result.wordResults.map(wr => {
    const cls = wr.usedCorrectly ? 'used-correct' : wr.used ? 'used-wrong' : 'not-used';
    const icon = wr.usedCorrectly ? '&#10003;' : wr.used ? '&#9888;' : '&#10007;';
    return `<span class="word-coverage-item ${cls}">${icon} ${escapeHtml(wr.word)}</span>`;
  }).join('');

  return `
    <div class="ai-feedback-title">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
      AI Feedback
    </div>
    <div class="score-badges">
      ${buildScoreBadge(result.grammarScore, 'Grammar')}
      ${buildScoreBadge(result.coherenceScore, 'Coherence')}
      ${buildScoreBadge(result.naturalnessScore, 'Natural')}
      ${buildScoreBadge(result.overallScore, 'Overall')}
    </div>
    <div class="word-coverage">${wordCoverage}</div>
    ${buildDiffComparisonHtml(diffHtml, 'Your Paragraph', 'Corrected Version')}
    ${buildErrorCardsHtml(result.grammarErrors)}
    ${buildWordChoiceHtml(result.wordChoiceSuggestions)}
    <div class="ai-feedback-text">${escapeHtml(result.feedback)}</div>
    ${result.suggestions.length > 0 ? `
      <ul class="ai-tips">
        ${result.suggestions.map(s => `<li>${escapeHtml(s)}</li>`).join('')}
      </ul>
    ` : ''}
  `;
}
