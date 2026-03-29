/* ============================================================
   TRANSLATION WRITING MODE
   ============================================================ */

import {
  generateTranslationChallenge,
  evaluateTranslation,
} from '../../ai/writing-ai.js';
import { escapeHtml } from '../../ui/utils.js';
import { showToast } from '../../ui/toast.js';
import { handleStreakRecord } from '../../shared/streak-handler.js';
import {
  buildScoreBadge,
  buildDiffComparisonHtml,
  buildErrorCardsHtml,
  buildInlineDiff,
} from '../../ai/feedback-builder.js';

let trChallenge = null;
let trTopicName = '';

export function initTranslationMode(allWords, topicId, topicName = '') {
  trTopicName = topicName;
  document.getElementById('tr-content').style.display = 'none';
  document.getElementById('tr-loading').style.display = '';
  document.getElementById('tr-feedback').classList.add('hidden');
  document.getElementById('tr-next-row').style.display = 'none';

  const backBtn = document.getElementById('tr-btn-back');
  if (backBtn) backBtn.href = `topic-detail.html?topicId=${topicId}`;

  document.getElementById('tr-loading').innerHTML =
    `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none"
          stroke="var(--color-primary)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/>
      <path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/>
    </svg>
    <span class="ai-loading-text">AI will generate a Vietnamese text for you to translate.</span>
    <button class="btn btn-primary" id="tr-start-btn">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
      Start
    </button>`;
  document.getElementById('tr-start-btn').onclick = () => generateNewTranslation(allWords, topicId);
}

async function generateNewTranslation(allWords, topicId) {
  document.getElementById('tr-content').style.display = 'none';
  document.getElementById('tr-loading').style.display = '';
  document.getElementById('tr-loading').innerHTML =
    '<div class="spinner spinner-lg"></div><span class="ai-loading-text">Generating translation challenge...</span>';

  try {
    trChallenge = await generateTranslationChallenge(allWords, trTopicName);

    document.getElementById('tr-source').textContent = trChallenge.vietnameseText;
    document.getElementById('tr-loading').style.display = 'none';
    document.getElementById('tr-content').style.display = '';

    // Reset input
    const input = document.getElementById('tr-input');
    input.value = '';
    input.disabled = false;
    input.focus();

    const checkBtn = document.getElementById('tr-btn-check');
    checkBtn.disabled = true;
    document.getElementById('tr-feedback').classList.add('hidden');
    document.getElementById('tr-next-row').style.display = 'none';
    document.getElementById('tr-container').classList.remove('has-feedback');

    input.oninput = () => {
      checkBtn.disabled = input.value.trim().length === 0;
    };

    checkBtn.onclick = () => handleTranslationCheck(allWords, topicId);

    // Rewrite — keep current text for editing and resubmit
    document.getElementById('tr-btn-rewrite').onclick = () => {
      input.disabled = false;
      input.focus();
      checkBtn.disabled = input.value.trim().length === 0;
      document.getElementById('tr-feedback').classList.add('hidden');
      document.getElementById('tr-next-row').style.display = 'none';
      document.getElementById('tr-container').classList.remove('has-feedback');
    };

    document.getElementById('tr-btn-next').onclick = () => generateNewTranslation(allWords, topicId);

  } catch (err) {
    console.error('Translation gen error:', err);
    document.getElementById('tr-loading').innerHTML =
      '<div class="ai-loading"><span class="ai-loading-text" style="color:var(--color-danger)">Failed to generate challenge.</span>' +
      '<button class="btn btn-primary btn-sm" onclick="this.closest(\'.ai-loading\').querySelector(\'.ai-loading-text\').textContent=\'Retrying...\';this.remove()">Retry</button></div>';
    showToast('Failed to generate translation challenge.', 'error');
  }
}

async function handleTranslationCheck(allWords, topicId) {
  const input = document.getElementById('tr-input');
  const userTranslation = input.value.trim();
  if (!userTranslation || !trChallenge) return;

  input.disabled = true;
  document.getElementById('tr-btn-check').disabled = true;

  const feedbackEl = document.getElementById('tr-feedback');
  feedbackEl.classList.remove('hidden');
  feedbackEl.innerHTML = '<div class="ai-loading"><div class="spinner"></div><span class="ai-loading-text">Evaluating...</span></div>';

  try {
    const result = await evaluateTranslation(
      trChallenge.vietnameseText,
      userTranslation,
      trChallenge.referenceEnglish,
      trTopicName,
      allWords,
    );

    if (result.overallScore >= 6) {
      handleStreakRecord();
    }

    feedbackEl.innerHTML = buildTranslationFeedback(result, userTranslation);
    document.getElementById('tr-container').classList.add('has-feedback');
    document.getElementById('tr-next-row').style.display = '';
  } catch (err) {
    console.error('Translation eval error:', err);
    feedbackEl.innerHTML = '';
    feedbackEl.classList.add('hidden');
    showToast('AI evaluation failed. ' + (err.message || ''), 'error');
    input.disabled = false;
    document.getElementById('tr-btn-check').disabled = false;
  }
}

function buildTranslationFeedback(result, userTranslation) {
  const corrected = result.correctedTranslation || result.suggestedTranslation;
  const diffHtml = buildInlineDiff(userTranslation, corrected);

  return `
    <div class="ai-feedback-title">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
      AI Feedback
    </div>
    <div class="score-badges">
      ${buildScoreBadge(result.accuracyScore, 'Accuracy')}
      ${buildScoreBadge(result.grammarScore, 'Grammar')}
      ${buildScoreBadge(result.overallScore, 'Overall')}
    </div>
    ${buildDiffComparisonHtml(diffHtml, 'Your Translation', 'Corrected Version')}
    ${buildErrorCardsHtml(result.grammarErrors)}
    <div class="ai-feedback-text">${escapeHtml(result.feedback)}</div>
    <div class="corrected-box">
      <div class="corrected-box-label">Suggested Translation</div>
      <div class="corrected-box-text">${escapeHtml(result.suggestedTranslation)}</div>
    </div>
  `;
}
