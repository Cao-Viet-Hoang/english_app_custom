/* ============================================================
   READING COMPREHENSION MODE (MCQ)
   ============================================================ */

import { generateReadingPassage } from '../../ai/reading-ai.js';
import { escapeHtml } from '../../ui/utils.js';
import { showToast } from '../../ui/toast.js';
import { handleStreakRecord } from '../../shared/streak-handler.js';

let rcData = null;
let rcAnswers = {};

export function initComprehensionMode(allWords, topicId, topicName = '') {
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
  document.getElementById('rc-start-btn').onclick = () => generateComprehensionPassage(allWords, topicId, topicName);
}

async function generateComprehensionPassage(allWords, topicId, topicName = '') {
  document.getElementById('rc-content').style.display = 'none';
  document.getElementById('rc-loading').style.display = '';
  document.getElementById('rc-loading').innerHTML =
    '<div class="spinner spinner-lg"></div><span class="ai-loading-text">Generating reading passage...</span>';

  try {
    rcData = await generateReadingPassage(allWords, 'mcq', topicName);
    rcAnswers = {};

    // Display passage with highlighted vocab
    const passageEl = document.getElementById('rc-passage');
    passageEl.innerHTML = highlightVocabInPassage(rcData.passage, rcData.highlightWords);

    // Build questions
    const questionsEl = document.getElementById('rc-questions');
    questionsEl.innerHTML = buildMCQQuestions(rcData.questions);

    // Wire up option clicks
    questionsEl.querySelectorAll('.quiz-option').forEach(btn => {
      btn.addEventListener('click', () => handleMCQOptionClick(btn));
    });

    // Check button
    const checkBtn = document.getElementById('rc-btn-check');
    checkBtn.disabled = true;
    checkBtn.onclick = () => handleComprehensionCheck();

    // New passage button
    document.getElementById('rc-btn-new').onclick = () => generateComprehensionPassage(allWords, topicId, topicName);

    document.getElementById('rc-action-row').style.display = '';
    document.getElementById('rc-done-row').style.display = 'none';

    document.getElementById('rc-loading').style.display = 'none';
    document.getElementById('rc-content').style.display = '';

  } catch (err) {
    console.error('Reading passage gen error:', err);
    document.getElementById('rc-loading').innerHTML =
      `<span class="ai-loading-text" style="color:var(--color-danger)">Failed to generate passage.</span>
       <button class="btn btn-primary btn-sm" id="rc-retry-btn">Retry</button>`;
    document.getElementById('rc-retry-btn').onclick = () => generateComprehensionPassage(allWords, topicId, topicName);
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

function buildMCQQuestions(questions) {
  const keys = ['A', 'B', 'C', 'D'];

  return questions.map((q, qi) => {
    const optionsHtml = (q.options || []).map((opt, oi) => `
      <button class="quiz-option" data-question="${qi}" data-option="${oi}">
        <span class="option-key">${keys[oi]}</span>
        <span>${escapeHtml(opt)}</span>
      </button>
    `).join('');

    return `
      <div class="reading-question-card" data-question-index="${qi}">
        <div class="reading-question-number">Question ${qi + 1}</div>
        <div class="reading-question-text">${escapeHtml(q.question)}</div>
        <div class="quiz-options">${optionsHtml}</div>
        <div class="question-explanation" id="rc-explanation-${qi}">${escapeHtml(q.explanation || '')}</div>
      </div>
    `;
  }).join('');
}

function handleMCQOptionClick(btn) {
  if (btn.classList.contains('disabled')) return;

  const qi = parseInt(btn.dataset.question);
  const oi = parseInt(btn.dataset.option);

  // Deselect other options in same question
  const card = btn.closest('.reading-question-card');
  card.querySelectorAll('.quiz-option').forEach(b => {
    b.classList.remove('correct', 'wrong');
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

function handleComprehensionCheck() {
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
    handleStreakRecord();
  }

  document.getElementById('rc-action-row').style.display = 'none';
  document.getElementById('rc-done-row').style.display = '';

  // Show score summary
  showToast(`Score: ${correct}/${total} (${pct}%)`, pct >= 50 ? 'success' : 'warning');
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
