/* ============================================================
   TRUE/FALSE READING MODE
   ============================================================ */

import { generateReadingPassage } from '../../ai/reading-ai.js';
import { escapeHtml } from '../../ui/utils.js';
import { showToast } from '../../ui/toast.js';
import { handleStreakRecord } from '../../shared/streak-handler.js';

let tfData = null;
let tfAnswers = {};

export function initTrueFalseMode(allWords, topicId) {
  tfData = null;
  tfAnswers = {};

  document.getElementById('tf-content').style.display = 'none';
  document.getElementById('tf-result').classList.add('hidden');
  document.getElementById('tf-loading').style.display = '';
  document.getElementById('tf-loading').innerHTML =
    `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none"
          stroke="var(--color-primary)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
    <span class="ai-loading-text">AI will generate a reading passage with true/false statements.</span>
    <button class="btn btn-primary" id="tf-start-btn">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
      Start
    </button>`;
  document.getElementById('tf-start-btn').onclick = () => generateTrueFalsePassage(allWords, topicId);
}

async function generateTrueFalsePassage(allWords, topicId) {
  document.getElementById('tf-content').style.display = 'none';
  document.getElementById('tf-loading').style.display = '';
  document.getElementById('tf-loading').innerHTML =
    '<div class="spinner spinner-lg"></div><span class="ai-loading-text">Generating reading passage...</span>';

  try {
    tfData = await generateReadingPassage(allWords, 'truefalse');
    tfAnswers = {};

    // Display passage
    const passageEl = document.getElementById('tf-passage');
    passageEl.innerHTML = highlightVocabInPassage(tfData.passage, tfData.highlightWords);

    // Build T/F statements
    const statementsEl = document.getElementById('tf-statements');
    statementsEl.innerHTML = buildTFStatements(tfData.questions);

    // Wire up T/F buttons
    statementsEl.querySelectorAll('.tf-btn').forEach(btn => {
      btn.addEventListener('click', () => handleTFClick(btn));
    });

    // Check button
    const checkBtn = document.getElementById('tf-btn-check');
    checkBtn.disabled = true;
    checkBtn.onclick = () => handleTrueFalseCheck();

    // New passage button
    document.getElementById('tf-btn-new').onclick = () => generateTrueFalsePassage(allWords, topicId);

    document.getElementById('tf-action-row').style.display = '';
    document.getElementById('tf-done-row').style.display = 'none';

    document.getElementById('tf-loading').style.display = 'none';
    document.getElementById('tf-content').style.display = '';

  } catch (err) {
    console.error('T/F passage gen error:', err);
    document.getElementById('tf-loading').innerHTML =
      `<span class="ai-loading-text" style="color:var(--color-danger)">Failed to generate passage.</span>
       <button class="btn btn-primary btn-sm" id="tf-retry-btn">Retry</button>`;
    document.getElementById('tf-retry-btn').onclick = () => generateTrueFalsePassage(allWords, topicId);
    showToast('Failed to generate reading passage.', 'error');
  }
}

function highlightVocabInPassage(passage, highlightWords) {
  if (!highlightWords || highlightWords.length === 0) return escapeHtml(passage);

  let html = escapeHtml(passage);

  for (const word of highlightWords) {
    const escaped = escapeHtml(word);
    const regex = new RegExp(`\\b(${escapeRegex(escaped)})\\b`, 'gi');
    html = html.replace(regex, '<span class="vocab-highlight">$1</span>');
  }

  return html;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildTFStatements(questions) {
  return questions.map((q, qi) => `
    <div class="tf-statement-card" data-statement-index="${qi}">
      <div class="tf-statement-text">${escapeHtml(q.statement)}</div>
      <div class="tf-toggle">
        <button class="tf-btn" data-statement="${qi}" data-value="true">True</button>
        <button class="tf-btn" data-statement="${qi}" data-value="false">False</button>
      </div>
      <div class="tf-explanation" id="tf-explanation-${qi}">${escapeHtml(q.explanation || '')}</div>
    </div>
  `).join('');
}

function handleTFClick(btn) {
  if (btn.classList.contains('disabled')) return;

  const qi = parseInt(btn.dataset.statement);
  const value = btn.dataset.value === 'true';

  // Deselect siblings
  const card = btn.closest('.tf-statement-card');
  card.querySelectorAll('.tf-btn').forEach(b => {
    b.classList.remove('selected-true', 'selected-false');
  });

  // Select this
  btn.classList.add(value ? 'selected-true' : 'selected-false');
  tfAnswers[qi] = value;

  // Enable check when all answered
  const totalStatements = tfData.questions.length;
  const answeredCount = Object.keys(tfAnswers).length;
  document.getElementById('tf-btn-check').disabled = answeredCount < totalStatements;
}

function handleTrueFalseCheck() {
  let correct = 0;
  const total = tfData.questions.length;

  tfData.questions.forEach((q, qi) => {
    const card = document.querySelector(`[data-statement-index="${qi}"]`);
    const userAnswer = tfAnswers[qi];
    const isCorrect = userAnswer === q.isTrue;

    if (isCorrect) correct++;

    // Disable buttons
    card.querySelectorAll('.tf-btn').forEach(b => b.classList.add('disabled'));

    // Highlight result
    card.classList.add(isCorrect ? 'tf-result-correct' : 'tf-result-wrong');

    // Show explanation
    const explanationEl = document.getElementById(`tf-explanation-${qi}`);
    if (explanationEl) explanationEl.classList.add('visible');
  });

  // Record streak for passing score
  const pct = Math.round((correct / total) * 100);
  if (pct >= 50) {
    handleStreakRecord();
  }

  document.getElementById('tf-action-row').style.display = 'none';
  document.getElementById('tf-done-row').style.display = '';

  showToast(`Score: ${correct}/${total} (${pct}%)`, pct >= 50 ? 'success' : 'warning');
}

// Keyboard shortcuts for T/F
document.addEventListener('keydown', (e) => {
  const panel = document.getElementById('panel-truefalse');
  if (!panel || !panel.classList.contains('active')) return;
  if (document.activeElement?.tagName === 'TEXTAREA') return;

  if (e.key.toLowerCase() === 't' || e.key.toLowerCase() === 'f') {
    const value = e.key.toLowerCase() === 't' ? 'true' : 'false';
    const total = tfData ? tfData.questions.length : 0;
    for (let i = 0; i < total; i++) {
      if (tfAnswers[i] === undefined) {
        const btn = document.querySelector(`[data-statement="${i}"][data-value="${value}"]`);
        if (btn && !btn.classList.contains('disabled')) {
          btn.click();
          break;
        }
      }
    }
  }
});
