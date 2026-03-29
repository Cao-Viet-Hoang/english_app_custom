/* ============================================================
   DICTATION WRITING MODE
   ============================================================ */

import { generateDictationSentence } from '../../ai/writing-ai.js';
import { escapeHtml } from '../../ui/utils.js';
import { showToast } from '../../ui/toast.js';
import { buildResultHtml } from '../../shared/result-builder.js';
import { handleStreakRecord } from '../../shared/streak-handler.js';
import { speakText } from '../../shared/tts.js';

let dcWords = [], dcIndex = 0, dcScore = 0, dcTotal = 5;
let dcSentences = [];
let dcTopicName = '';

export function initDictationMode(allWords, topicId, topicName = '') {
  dcWords = allWords;
  dcTopicName = topicName;
  dcIndex = 0;
  dcScore = 0;
  dcTotal = Math.min(5, allWords.length);
  dcSentences = [];

  const container = document.getElementById('dc-container');
  const result = document.getElementById('dc-result');
  container.style.display = '';
  result.classList.add('hidden');

  document.getElementById('dc-total').textContent = dcTotal;

  document.getElementById('dc-content').style.display = 'none';
  document.getElementById('dc-loading').style.display = '';
  document.getElementById('dc-loading').innerHTML =
    `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none"
          stroke="var(--color-primary)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 18v-6a9 9 0 0 1 18 0v6"/>
      <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>
    </svg>
    <span class="ai-loading-text">AI will generate sentences for dictation practice.</span>
    <button class="btn btn-primary" id="dc-start-btn">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
      Start
    </button>`;
  document.getElementById('dc-start-btn').onclick = () => generateAllDictation(topicId);
}

async function generateAllDictation(topicId) {
  document.getElementById('dc-content').style.display = 'none';
  document.getElementById('dc-loading').style.display = '';
  document.getElementById('dc-loading').innerHTML =
    `<div class="spinner spinner-lg"></div>
     <span class="ai-loading-text">Generating ${dcTotal} dictation sentences...</span>
     <span class="ai-loading-text" id="dc-gen-progress" style="font-size:var(--fs-xs)">0 / ${dcTotal}</span>`;

  dcSentences = [];

  try {
    for (let i = 0; i < dcTotal; i++) {
      const result = await generateDictationSentence(dcWords, dcTopicName);
      dcSentences.push(result.sentence);
      const progressEl = document.getElementById('dc-gen-progress');
      if (progressEl) progressEl.textContent = `${i + 1} / ${dcTotal}`;
    }

    dcIndex = 0;
    dcScore = 0;
    showDictationSentence(topicId);

  } catch (err) {
    console.error('Dictation gen error:', err);
    document.getElementById('dc-loading').innerHTML =
      `<span class="ai-loading-text" style="color:var(--color-danger)">Failed to generate sentences.</span>
       <button class="btn btn-primary btn-sm" id="dc-retry-btn">Retry</button>`;
    document.getElementById('dc-retry-btn').onclick = () => generateAllDictation(topicId);
    showToast('Failed to generate dictation sentences.', 'error');
  }
}

function showDictationSentence(topicId) {
  const sentence = dcSentences[dcIndex];

  document.getElementById('dc-loading').style.display = 'none';
  document.getElementById('dc-content').style.display = '';

  document.getElementById('dc-current').textContent = dcIndex + 1;
  const pct = Math.round((dcIndex / dcTotal) * 100);
  document.getElementById('dc-progress').style.width = pct + '%';
  document.getElementById('dc-progress-text').textContent = pct + '%';
  document.getElementById('dc-score').textContent = dcScore;

  // Reset input
  const input = document.getElementById('dc-input');
  input.value = '';
  input.disabled = false;
  input.focus();

  const checkBtn = document.getElementById('dc-btn-check');
  checkBtn.disabled = true;
  document.getElementById('dc-diff').classList.add('hidden');
  document.getElementById('dc-next-row').style.display = 'none';

  input.oninput = () => {
    checkBtn.disabled = input.value.trim().length === 0;
  };

  // Auto-play
  const speed = parseFloat(document.getElementById('dc-speed').value) || 0.85;
  speakText(sentence, speed);

  // Play button
  document.getElementById('dc-play-btn').onclick = () => {
    const spd = parseFloat(document.getElementById('dc-speed').value) || 0.85;
    speakText(sentence, spd);
  };

  checkBtn.onclick = () => handleDictationCheck(topicId);
  document.getElementById('dc-btn-next').onclick = () => {
    dcIndex++;
    if (dcIndex >= dcTotal) {
      showDictationResults(topicId);
    } else {
      showDictationSentence(topicId);
    }
  };
}

function handleDictationCheck(topicId) {
  const input = document.getElementById('dc-input');
  const userText = input.value.trim();
  if (!userText) return;

  input.disabled = true;
  document.getElementById('dc-btn-check').disabled = true;

  // Word-level diff
  const currentSentence = dcSentences[dcIndex];
  const expected = currentSentence.toLowerCase().replace(/[.,!?;:'"]/g, '').split(/\s+/).filter(Boolean);
  const actual = userText.toLowerCase().replace(/[.,!?;:'"]/g, '').split(/\s+/).filter(Boolean);

  let correctCount = 0;
  const maxLen = Math.max(expected.length, actual.length);
  let diffHtml = '';

  for (let i = 0; i < maxLen; i++) {
    const exp = expected[i] || '';
    const act = actual[i] || '';

    if (exp === act) {
      correctCount++;
      diffHtml += `<span class="diff-correct">${escapeHtml(exp)}</span> `;
    } else if (!act && exp) {
      diffHtml += `<span class="diff-missing">${escapeHtml(exp)}</span> `;
    } else if (act && !exp) {
      diffHtml += `<span class="diff-extra">${escapeHtml(act)}</span> `;
    } else {
      diffHtml += `<span class="diff-wrong">${escapeHtml(act)}</span><span class="diff-expected"> [${escapeHtml(exp)}]</span> `;
    }
  }

  const isCorrect = correctCount === expected.length && actual.length === expected.length;
  if (isCorrect) dcScore++;

  if (isCorrect && correctCount >= expected.length) {
    handleStreakRecord();
  }

  const diffEl = document.getElementById('dc-diff');
  diffEl.classList.remove('hidden');
  diffEl.innerHTML = `
    <div class="dc-diff-header ${isCorrect ? 'dc-diff-correct' : 'dc-diff-wrong'}">
      ${isCorrect ? '✓ Correct!' : `${correctCount}/${expected.length} words correct`}
    </div>
    <div class="dc-diff-section">
      <div class="dc-diff-label">Your answer</div>
      <div class="dc-diff-text">${diffHtml}</div>
    </div>
    <div class="dc-diff-section dc-diff-answer">
      <div class="dc-diff-label">Correct sentence</div>
      <div class="dc-diff-text">${escapeHtml(currentSentence)}</div>
    </div>
  `;

  document.getElementById('dc-score').textContent = dcScore;
  document.getElementById('dc-next-row').style.display = '';
}

function showDictationResults(topicId) {
  const container = document.getElementById('dc-container');
  const result = document.getElementById('dc-result');
  container.style.display = 'none';
  result.classList.remove('hidden');

  document.getElementById('dc-progress').style.width = '100%';
  document.getElementById('dc-progress-text').textContent = '100%';

  result.innerHTML = buildResultHtml(dcScore, dcTotal, { topicId });
}

// Keyboard: R to replay in dictation mode
document.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 'r' && document.activeElement?.tagName !== 'TEXTAREA') {
    const panel = document.getElementById('panel-dictation');
    if (panel && panel.classList.contains('active')) {
      const playBtn = document.getElementById('dc-play-btn');
      if (playBtn && playBtn.offsetParent !== null) {
        playBtn.click();
      }
    }
  }
});
