/* ============================================================
   IRREGULAR VERBS — Conjugation Quiz Mode
   Multiple choice: given V1, pick V2 or V3.
   ============================================================ */

import { shuffle } from '../../shared/shuffle.js';
import { speakText } from '../../shared/tts.js';
import { buildResultHtml } from '../../shared/result-builder.js';
import { handleStreakRecord } from '../../shared/streak-handler.js';
import { escapeHtml } from '../../ui/index.js';

// Direction options
const DIRECTIONS = [
  { value: 'v1-v2', label: 'V1 → V2 (Past Simple)' },
  { value: 'v1-v3', label: 'V1 → V3 (Participle)' },
  { value: 'v2-v1', label: 'V2 → V1 (Base)' },
  { value: 'random', label: 'Random' },
];

export function initIVQuiz(allVerbs) {
  const panel = document.getElementById('panel-quiz');
  if (!panel) return;

  let direction = 'v1-v2';
  let verbs = shuffle([...allVerbs]);
  let index = 0, correct = 0, wrong = 0;
  const total = verbs.length;

  render();

  function getFields() {
    let dir = direction;
    if (dir === 'random') {
      const opts = ['v1-v2', 'v1-v3', 'v2-v1'];
      dir = opts[index % opts.length];
    }
    if (dir === 'v1-v2') return { promptField: 'base',       promptLabel: 'Base (V1)',       answerField: 'pastSimple',     answerLabel: 'Past Simple (V2)' };
    if (dir === 'v1-v3') return { promptField: 'base',       promptLabel: 'Base (V1)',       answerField: 'pastParticiple', answerLabel: 'Past Participle (V3)' };
    return                        { promptField: 'pastSimple', promptLabel: 'Past Simple (V2)', answerField: 'base',           answerLabel: 'Base (V1)' };
  }

  function buildOptions(v) {
    const { answerField } = getFields();
    const correct = (v[answerField] || '').toLowerCase();
    const pool = allVerbs
      .filter(x => x.id !== v.id && (x[answerField] || '').toLowerCase() !== correct)
      .map(x => (x[answerField] || '').toLowerCase())
      .filter(Boolean);
    shuffle(pool);
    const opts = [correct, ...pool.slice(0, 3)];
    return shuffle(opts);
  }

  function render() {
    const pct = total > 0 ? Math.round((index / total) * 100) : 0;
    const v = verbs[index];
    const { promptField, promptLabel, answerLabel } = getFields();
    const options = buildOptions(v);

    panel.innerHTML = `
      <div class="stats-bar">
        <div class="stat">Question <strong>${index + 1}</strong> / <strong>${total}</strong></div>
        <div class="stat stat-progress">
          <div class="progress-bar"><div class="progress-bar-fill" style="width:${pct}%"></div></div>
          <span>${pct}%</span>
        </div>
        <div class="stat">
          ✓ <strong class="stat-correct">${correct}</strong>
          &nbsp;✗ <strong class="stat-wrong">${wrong}</strong>
        </div>
      </div>

      <div class="iv-quiz-container">
        <div class="iv-quiz-toolbar">
          <select id="iv-quiz-direction" class="sort-select">
            ${DIRECTIONS.map(d => `<option value="${d.value}"${d.value === direction ? ' selected' : ''}>${d.label}</option>`).join('')}
          </select>
        </div>

        <div class="iv-quiz-card">
          <div class="iv-quiz-prompt-label">${escapeHtml(promptLabel)}</div>
          <div class="iv-quiz-prompt">${escapeHtml(v[promptField] || '—')}</div>
          <div class="iv-quiz-ask-label">What is the <strong>${escapeHtml(answerLabel)}</strong>?</div>
        </div>

        <div class="iv-quiz-options">
          ${options.map((opt, i) => `
            <button class="iv-quiz-option" data-answer="${escapeHtml(opt)}" type="button">
              <span class="iv-quiz-option-key">${String.fromCharCode(65 + i)}</span>
              <span>${escapeHtml(opt)}</span>
            </button>
          `).join('')}
        </div>
      </div>
    `;

    panel.querySelector('#iv-quiz-direction')?.addEventListener('change', (e) => {
      direction = e.target.value;
    });

    panel.querySelectorAll('.iv-quiz-option').forEach((btn, i) => {
      btn.addEventListener('click', () => selectOption(btn));
    });

    document.addEventListener('keydown', onKeyDown);
  }

  function selectOption(btn) {
    if (btn.disabled) return;
    document.removeEventListener('keydown', onKeyDown);

    const v = verbs[index];
    const { answerField } = getFields();
    const correctVal = (v[answerField] || '').toLowerCase();
    const chosen = btn.dataset.answer;
    const isCorrect = chosen === correctVal;

    if (isCorrect) correct++; else wrong++;

    panel.querySelectorAll('.iv-quiz-option').forEach(b => {
      b.disabled = true;
      if (b.dataset.answer === correctVal) b.classList.add('correct');
      if (b === btn && !isCorrect) b.classList.add('wrong');
    });

    // Add next button
    const optionsEl = panel.querySelector('.iv-quiz-options');
    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'btn btn-primary iv-quiz-next';
    nextBtn.textContent = index + 1 < total ? 'Next →' : 'See Results';
    nextBtn.addEventListener('click', () => {
      index++;
      if (index >= total) finishSession();
      else render();
    });

    const container = panel.querySelector('.iv-quiz-container');
    if (container) container.appendChild(nextBtn);

    speakText(v.base);
    nextBtn.focus();
  }

  function onKeyDown(e) {
    if (!panel.closest('.practice-panel.active')) return;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
    const keys = ['1','2','3','4','a','b','c','d','A','B','C','D'];
    const idx = keys.indexOf(e.key);
    if (idx !== -1) {
      const optIdx = idx % 4;
      const opts = panel.querySelectorAll('.iv-quiz-option:not([disabled])');
      if (opts[optIdx]) selectOption(opts[optIdx]);
    }
  }

  function finishSession() {
    document.removeEventListener('keydown', onKeyDown);
    panel.innerHTML = `
      <div class="practice-result">
        ${buildResultHtml(correct, total, { backHref: 'irregular-verbs.html', backLabel: 'Back to Verbs' })}
      </div>
    `;
    const pct = Math.round((correct / total) * 100);
    if (pct >= 50) handleStreakRecord('irregularVerb');
  }
}
