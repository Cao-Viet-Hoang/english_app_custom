/* ============================================================
   READING MODE IMPLEMENTATIONS
   Comprehension (MCQ), True/False
   ============================================================ */

import { generateReadingPassage } from './reading-ai.js';

// ============================================================
// READING COMPREHENSION MODE (MCQ)
// ============================================================

let rcData = null;
let rcAnswers = {};

export function initComprehensionMode(allWords, ctx) {
  rcData = null;
  rcAnswers = {};

  document.getElementById('rc-content').style.display = 'none';
  document.getElementById('rc-result').classList.add('hidden');
  document.getElementById('rc-loading').style.display = '';
  document.getElementById('rc-loading').innerHTML =
    `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none"
          stroke="var(--color-primary)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
    </svg>
    <span class="ai-loading-text">AI will generate a reading passage with comprehension questions.</span>
    <button class="btn btn-primary" id="rc-start-btn">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
      Start
    </button>`;
  document.getElementById('rc-start-btn').onclick = () => generateComprehensionPassage(allWords, ctx);
}

async function generateComprehensionPassage(allWords, ctx) {
  document.getElementById('rc-content').style.display = 'none';
  document.getElementById('rc-loading').style.display = '';
  document.getElementById('rc-loading').innerHTML =
    '<div class="spinner spinner-lg"></div><span class="ai-loading-text">Generating reading passage...</span>';

  try {
    rcData = await generateReadingPassage(allWords, 'mcq');
    rcAnswers = {};

    // Display passage with highlighted vocab
    const passageEl = document.getElementById('rc-passage');
    passageEl.innerHTML = highlightVocabInPassage(rcData.passage, rcData.highlightWords, ctx);

    // Build questions
    const questionsEl = document.getElementById('rc-questions');
    questionsEl.innerHTML = buildMCQQuestions(rcData.questions, ctx);

    // Wire up option clicks
    questionsEl.querySelectorAll('.quiz-option').forEach(btn => {
      btn.addEventListener('click', () => handleMCQOptionClick(btn, ctx));
    });

    // Check button
    const checkBtn = document.getElementById('rc-btn-check');
    checkBtn.disabled = true;
    checkBtn.onclick = () => handleComprehensionCheck(ctx);

    // New passage button
    document.getElementById('rc-btn-new').onclick = () => generateComprehensionPassage(allWords, ctx);

    document.getElementById('rc-action-row').style.display = '';
    document.getElementById('rc-done-row').style.display = 'none';

    document.getElementById('rc-loading').style.display = 'none';
    document.getElementById('rc-content').style.display = '';

  } catch (err) {
    console.error('Reading passage gen error:', err);
    document.getElementById('rc-loading').innerHTML =
      `<span class="ai-loading-text" style="color:var(--color-danger)">Failed to generate passage.</span>
       <button class="btn btn-primary btn-sm" id="rc-retry-btn">Retry</button>`;
    document.getElementById('rc-retry-btn').onclick = () => generateComprehensionPassage(allWords, ctx);
    ctx.showToast('Failed to generate reading passage.', 'error');
  }
}

function highlightVocabInPassage(passage, highlightWords, ctx) {
  if (!highlightWords || highlightWords.length === 0) return ctx.escapeHtml(passage);

  // Escape the passage first, then highlight words
  let html = ctx.escapeHtml(passage);

  for (const word of highlightWords) {
    const escaped = ctx.escapeHtml(word);
    // Case-insensitive replacement — match word boundaries
    const regex = new RegExp(`\\b(${escapeRegex(escaped)})\\b`, 'gi');
    html = html.replace(regex, '<span class="vocab-highlight">$1</span>');
  }

  return html;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildMCQQuestions(questions, ctx) {
  const keys = ['A', 'B', 'C', 'D'];

  return questions.map((q, qi) => {
    const optionsHtml = (q.options || []).map((opt, oi) => `
      <button class="quiz-option" data-question="${qi}" data-option="${oi}">
        <span class="option-key">${keys[oi]}</span>
        <span>${ctx.escapeHtml(opt)}</span>
      </button>
    `).join('');

    return `
      <div class="reading-question-card" data-question-index="${qi}">
        <div class="reading-question-number">Question ${qi + 1}</div>
        <div class="reading-question-text">${ctx.escapeHtml(q.question)}</div>
        <div class="quiz-options">${optionsHtml}</div>
        <div class="question-explanation" id="rc-explanation-${qi}">${ctx.escapeHtml(q.explanation || '')}</div>
      </div>
    `;
  }).join('');
}

function handleMCQOptionClick(btn, ctx) {
  if (btn.classList.contains('disabled')) return;

  const qi = parseInt(btn.dataset.question);
  const oi = parseInt(btn.dataset.option);

  // Deselect other options in same question
  const card = btn.closest('.reading-question-card');
  card.querySelectorAll('.quiz-option').forEach(b => {
    b.classList.remove('correct', 'wrong');
    // Just remove selection styling — use a subtle highlight
    b.style.borderColor = '';
    b.style.background = '';
  });

  // Select this option
  btn.style.borderColor = 'var(--color-primary)';
  btn.style.background = '#e8efff';

  rcAnswers[qi] = oi;

  // Enable check button when all questions answered
  const totalQuestions = rcData.questions.length;
  const answeredCount = Object.keys(rcAnswers).length;
  document.getElementById('rc-btn-check').disabled = answeredCount < totalQuestions;
}

function handleComprehensionCheck(ctx) {
  let correct = 0;
  const total = rcData.questions.length;

  rcData.questions.forEach((q, qi) => {
    const card = document.querySelector(`[data-question-index="${qi}"]`);
    const userAnswer = rcAnswers[qi];
    const isCorrect = userAnswer === q.correctIndex;

    if (isCorrect) correct++;

    // Disable all options
    card.querySelectorAll('.quiz-option').forEach(btn => {
      btn.classList.add('disabled');
      btn.style.borderColor = '';
      btn.style.background = '';

      const optIdx = parseInt(btn.dataset.option);
      if (optIdx === q.correctIndex) {
        btn.classList.add('correct');
      } else if (optIdx === userAnswer && !isCorrect) {
        btn.classList.add('wrong');
      }
    });

    // Show explanation
    const explanationEl = document.getElementById(`rc-explanation-${qi}`);
    if (explanationEl) explanationEl.classList.add('visible');
  });

  // Record streak for passing score
  const pct = Math.round((correct / total) * 100);
  if (pct >= 50) {
    ctx.handleStreakRecord();
  }

  document.getElementById('rc-action-row').style.display = 'none';
  document.getElementById('rc-done-row').style.display = '';

  // Show score summary
  ctx.showToast(`Score: ${correct}/${total} (${pct}%)`, pct >= 50 ? 'success' : 'warning');
}

// Keyboard shortcuts for MCQ
document.addEventListener('keydown', (e) => {
  const panel = document.getElementById('panel-comprehension');
  if (!panel || !panel.classList.contains('active')) return;

  const keyMap = { '1': 0, '2': 1, '3': 2, '4': 3, 'a': 0, 'b': 1, 'c': 2, 'd': 3 };
  const idx = keyMap[e.key.toLowerCase()];

  if (idx !== undefined && document.activeElement?.tagName !== 'TEXTAREA') {
    // Find first unanswered question or current question
    // Just click the first visible option at that index
  }
});

// ============================================================
// TRUE/FALSE MODE
// ============================================================

let tfData = null;
let tfAnswers = {};

export function initTrueFalseMode(allWords, ctx) {
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
  document.getElementById('tf-start-btn').onclick = () => generateTrueFalsePassage(allWords, ctx);
}

async function generateTrueFalsePassage(allWords, ctx) {
  document.getElementById('tf-content').style.display = 'none';
  document.getElementById('tf-loading').style.display = '';
  document.getElementById('tf-loading').innerHTML =
    '<div class="spinner spinner-lg"></div><span class="ai-loading-text">Generating reading passage...</span>';

  try {
    tfData = await generateReadingPassage(allWords, 'truefalse');
    tfAnswers = {};

    // Display passage
    const passageEl = document.getElementById('tf-passage');
    passageEl.innerHTML = highlightVocabInPassage(tfData.passage, tfData.highlightWords, ctx);

    // Build T/F statements
    const statementsEl = document.getElementById('tf-statements');
    statementsEl.innerHTML = buildTFStatements(tfData.questions, ctx);

    // Wire up T/F buttons
    statementsEl.querySelectorAll('.tf-btn').forEach(btn => {
      btn.addEventListener('click', () => handleTFClick(btn, ctx));
    });

    // Check button
    const checkBtn = document.getElementById('tf-btn-check');
    checkBtn.disabled = true;
    checkBtn.onclick = () => handleTrueFalseCheck(ctx);

    // New passage button
    document.getElementById('tf-btn-new').onclick = () => generateTrueFalsePassage(allWords, ctx);

    document.getElementById('tf-action-row').style.display = '';
    document.getElementById('tf-done-row').style.display = 'none';

    document.getElementById('tf-loading').style.display = 'none';
    document.getElementById('tf-content').style.display = '';

  } catch (err) {
    console.error('T/F passage gen error:', err);
    document.getElementById('tf-loading').innerHTML =
      `<span class="ai-loading-text" style="color:var(--color-danger)">Failed to generate passage.</span>
       <button class="btn btn-primary btn-sm" id="tf-retry-btn">Retry</button>`;
    document.getElementById('tf-retry-btn').onclick = () => generateTrueFalsePassage(allWords, ctx);
    ctx.showToast('Failed to generate reading passage.', 'error');
  }
}

function buildTFStatements(questions, ctx) {
  return questions.map((q, qi) => `
    <div class="tf-statement-card" data-statement-index="${qi}">
      <div class="tf-statement-text">${ctx.escapeHtml(q.statement)}</div>
      <div class="tf-toggle">
        <button class="tf-btn" data-statement="${qi}" data-value="true">True</button>
        <button class="tf-btn" data-statement="${qi}" data-value="false">False</button>
      </div>
      <div class="tf-explanation" id="tf-explanation-${qi}">${ctx.escapeHtml(q.explanation || '')}</div>
    </div>
  `).join('');
}

function handleTFClick(btn, ctx) {
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

function handleTrueFalseCheck(ctx) {
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
    ctx.handleStreakRecord();
  }

  document.getElementById('tf-action-row').style.display = 'none';
  document.getElementById('tf-done-row').style.display = '';

  ctx.showToast(`Score: ${correct}/${total} (${pct}%)`, pct >= 50 ? 'success' : 'warning');
}

// Keyboard shortcuts for T/F
document.addEventListener('keydown', (e) => {
  const panel = document.getElementById('panel-truefalse');
  if (!panel || !panel.classList.contains('active')) return;
  if (document.activeElement?.tagName === 'TEXTAREA') return;

  if (e.key.toLowerCase() === 't' || e.key.toLowerCase() === 'f') {
    // Find first unanswered statement and click T or F
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
