/* ============================================================
   SENTENCE WRITING MODE
   ============================================================ */

import { evaluateSentence } from '../../ai/writing-ai.js';
import { escapeHtml } from '../../ui/utils.js';
import { showToast } from '../../ui/toast.js';
import { shuffle } from '../../shared/shuffle.js';
import { buildResultHtml } from '../../shared/result-builder.js';
import { handleStreakRecord } from '../../shared/streak-handler.js';
import {
  WORD_TYPE_LABELS,
  buildScoreBadge,
  buildDiffComparisonHtml,
  buildErrorCardsHtml,
  buildWordChoiceHtml,
  buildInlineDiff,
} from '../../ai/feedback-builder.js';

let swWords = [], swIndex = 0, swScores = [];
let swTopicName = '';
let swAllWords = [];

export function initSentenceMode(allWords, topicId, topicName = '') {
  swWords = shuffle(allWords);
  swIndex = 0;
  swScores = [];
  swTopicName = topicName;
  swAllWords = allWords;

  const container = document.getElementById('sw-container');
  const result = document.getElementById('sw-result');
  container.style.display = '';
  container.classList.remove('has-feedback');
  result.classList.add('hidden');

  showSentenceWord(topicId);
}

function showSentenceWord(topicId) {
  if (swIndex >= swWords.length) {
    showSentenceResults(topicId);
    return;
  }

  const w = swWords[swIndex];
  document.getElementById('sw-word').textContent = w.english;
  document.getElementById('sw-ipa').textContent = w.ipaUS || '';
  document.getElementById('sw-type').textContent = WORD_TYPE_LABELS[w.wordType] || w.wordType || '';
  document.getElementById('sw-meaning').textContent = w.vietnamese || '';

  document.getElementById('sw-current').textContent = swIndex + 1;
  document.getElementById('sw-total').textContent = swWords.length;

  const pct = Math.round((swIndex / swWords.length) * 100);
  document.getElementById('sw-progress').style.width = pct + '%';
  document.getElementById('sw-progress-text').textContent = pct + '%';

  const avg = swScores.length > 0
    ? (swScores.reduce((a, b) => a + b, 0) / swScores.length).toFixed(1)
    : '-';
  document.getElementById('sw-avg-score').textContent = avg;

  // Reset input
  const input = document.getElementById('sw-input');
  input.value = '';
  input.disabled = false;
  input.focus();

  const checkBtn = document.getElementById('sw-btn-check');
  checkBtn.disabled = true;
  document.getElementById('sw-btn-skip').style.display = '';
  document.getElementById('sw-feedback').classList.add('hidden');
  document.getElementById('sw-next-row').style.display = 'none';
  document.getElementById('sw-container').classList.remove('has-feedback');

  // Enable check when user types
  input.oninput = () => {
    checkBtn.disabled = input.value.trim().length === 0;
  };

  // Check handler
  checkBtn.onclick = () => handleSentenceCheck(topicId);

  // Skip handler
  document.getElementById('sw-btn-skip').onclick = () => {
    swScores.push(0);
    swIndex++;
    showSentenceWord(topicId);
  };

  // Rewrite handler
  document.getElementById('sw-btn-rewrite').onclick = () => {
    input.disabled = false;
    input.focus();
    checkBtn.disabled = input.value.trim().length === 0;
    document.getElementById('sw-btn-skip').style.display = '';
    document.getElementById('sw-feedback').classList.add('hidden');
    document.getElementById('sw-next-row').style.display = 'none';
    document.getElementById('sw-container').classList.remove('has-feedback');
    // Remove last score since user is rewriting
    swScores.pop();
    const avg = swScores.length > 0
      ? (swScores.reduce((a, b) => a + b, 0) / swScores.length).toFixed(1)
      : '-';
    document.getElementById('sw-avg-score').textContent = avg;
  };

  // Next handler
  document.getElementById('sw-btn-next').onclick = () => {
    swIndex++;
    showSentenceWord(topicId);
  };
}

async function handleSentenceCheck(topicId) {
  const w = swWords[swIndex];
  const input = document.getElementById('sw-input');
  const sentence = input.value.trim();
  if (!sentence) return;

  input.disabled = true;
  document.getElementById('sw-btn-check').disabled = true;
  document.getElementById('sw-btn-skip').style.display = 'none';

  // Show loading
  const feedbackEl = document.getElementById('sw-feedback');
  feedbackEl.classList.remove('hidden');
  feedbackEl.innerHTML = '<div class="ai-loading"><div class="spinner"></div><span class="ai-loading-text">Evaluating...</span></div>';

  try {
    const result = await evaluateSentence(w, sentence, swTopicName, swAllWords);
    swScores.push(result.overallScore);

    // Record streak for good scores
    if (result.overallScore >= 6) {
      handleStreakRecord();
    }

    feedbackEl.innerHTML = buildSentenceFeedback(result, sentence);
    document.getElementById('sw-container').classList.add('has-feedback');
    document.getElementById('sw-next-row').style.display = '';

    // Update avg
    const avg = (swScores.reduce((a, b) => a + b, 0) / swScores.length).toFixed(1);
    document.getElementById('sw-avg-score').textContent = avg;
  } catch (err) {
    console.error('Sentence eval error:', err);
    feedbackEl.innerHTML = '';
    feedbackEl.classList.add('hidden');
    showToast('AI evaluation failed. ' + (err.message || ''), 'error');
    input.disabled = false;
    document.getElementById('sw-btn-check').disabled = false;
    document.getElementById('sw-btn-skip').style.display = '';
  }
}

function buildSentenceFeedback(result, userSentence) {
  const diffHtml = buildInlineDiff(userSentence, result.correctedSentence);

  return `
    <div class="ai-feedback-title">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
      AI Feedback
    </div>
    <div class="score-badges">
      ${buildScoreBadge(result.grammarScore, 'Grammar')}
      ${buildScoreBadge(result.usageScore, 'Usage')}
      ${buildScoreBadge(result.naturalnessScore, 'Natural')}
      ${buildScoreBadge(result.overallScore, 'Overall')}
    </div>
    ${buildDiffComparisonHtml(diffHtml, 'Your Sentence', 'Corrected Sentence')}
    ${buildErrorCardsHtml(result.grammarErrors)}
    ${buildWordChoiceHtml(result.wordChoiceSuggestions)}
    <div class="ai-feedback-text">${escapeHtml(result.feedback)}</div>
    ${result.tips.length > 0 ? `
      <ul class="ai-tips">
        ${result.tips.map(t => `<li>${escapeHtml(t)}</li>`).join('')}
      </ul>
    ` : ''}
  `;
}

function showSentenceResults(topicId) {
  const container = document.getElementById('sw-container');
  const result = document.getElementById('sw-result');
  container.style.display = 'none';
  result.classList.remove('hidden');

  document.getElementById('sw-progress').style.width = '100%';
  document.getElementById('sw-progress-text').textContent = '100%';

  const avg = swScores.length > 0
    ? (swScores.reduce((a, b) => a + b, 0) / swScores.length).toFixed(1)
    : 0;
  const good = swScores.filter(s => s >= 6).length;
  result.innerHTML = buildResultHtml(good, swWords.length, { topicId, label: `Avg: ${avg}/10` });
}
