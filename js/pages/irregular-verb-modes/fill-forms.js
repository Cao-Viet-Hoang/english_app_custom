/* ============================================================
   IRREGULAR VERBS — Fill the Forms Mode
   Show some forms, user fills the missing ones.
   ============================================================ */

import { shuffle } from '../../shared/shuffle.js';
import { buildResultHtml } from '../../shared/result-builder.js';
import { handleStreakRecord } from '../../shared/streak-handler.js';
import { escapeHtml } from '../../ui/index.js';

// All three verb forms
const ALL_FIELDS = [
  { key: 'base',           label: 'Base (V1)' },
  { key: 'pastSimple',     label: 'Past Simple (V2)' },
  { key: 'pastParticiple', label: 'Past Participle (V3)' },
];

export function initIVFillForms(allVerbs) {
  const panel = document.getElementById('panel-fill-forms');
  if (!panel) return;

  const verbs = shuffle([...allVerbs]);
  let index = 0, correct = 0, wrong = 0, answered = false;
  const total = verbs.length;

  // Pre-assign a random given field for each verb
  const givenIndices = verbs.map(() => Math.floor(Math.random() * 3));

  renderQuestion();

  function getCurrentChallenge() {
    const v = verbs[index];
    const givenIdx = givenIndices[index];
    const givenField = ALL_FIELDS[givenIdx];
    const hideFields = ALL_FIELDS.filter((_, i) => i !== givenIdx);
    return { v, givenField, hideFields };
  }

  function renderQuestion() {
    answered = false;
    const { v, givenField, hideFields } = getCurrentChallenge();
    panel.innerHTML = buildQuestionHtml(v, givenField, hideFields, index, total, correct, wrong);

    panel.querySelectorAll('.iv-fill-input').forEach(inp => {
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          panel.querySelector('.btn-check')?.click();
        }
      });
    });

    panel.querySelector('.btn-check')?.addEventListener('click', checkAnswers);

    // Auto-focus first input
    panel.querySelector('.iv-fill-input')?.focus();
  }

  function checkAnswers() {
    if (answered) return;
    answered = true;

    const { v, hideFields } = getCurrentChallenge();
    let allCorrect = true;

    hideFields.forEach(f => {
      const inp = panel.querySelector(`.iv-fill-input[data-field="${f.key}"]`);
      if (!inp) return;
      const userVal = inp.value.trim().toLowerCase();
      const correctVal = (v[f.key] || '').toLowerCase();
      const isCorrect = userVal === correctVal;
      if (!isCorrect) allCorrect = false;

      inp.classList.add(isCorrect ? 'correct' : 'wrong');
      inp.disabled = true;

      if (!isCorrect) {
        const feedbackEl = inp.closest('.iv-fill-form-col')?.querySelector('.iv-fill-correct-answer');
        if (feedbackEl) feedbackEl.textContent = correctVal;
      }
    });

    if (allCorrect) correct++; else wrong++;

    const checkBtn = panel.querySelector('.btn-check');
    if (checkBtn) checkBtn.classList.add('hidden');

    const nextBtn = panel.querySelector('.btn-next');
    if (nextBtn) {
      nextBtn.classList.remove('hidden');
      nextBtn.focus();
    }

    // Update stats
    const statCorrect = panel.querySelector('.stat-correct');
    const statWrong = panel.querySelector('.stat-wrong');
    if (statCorrect) statCorrect.textContent = correct;
    if (statWrong) statWrong.textContent = wrong;

    document.removeEventListener('keydown', onKeyDown);
    // Defer so the current Enter keydown doesn't also trigger next
    setTimeout(() => document.addEventListener('keydown', onNextKeyDown), 0);
  }

  function onKeyDown(e) {
    if (!panel.closest('.practice-panel.active')) return;
    if (e.key === 'Enter' && !answered && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
      panel.querySelector('.btn-check')?.click();
    }
  }

  function onNextKeyDown(e) {
    if (!panel.closest('.practice-panel.active')) return;
    if (e.key === 'Enter' || e.code === 'Space') {
      e.preventDefault();
      panel.querySelector('.btn-next')?.click();
    }
  }

  document.addEventListener('keydown', onKeyDown);

  panel.addEventListener('click', (e) => {
    if (e.target.closest('.btn-check')) checkAnswers();
    if (e.target.closest('.btn-next')) {
      document.removeEventListener('keydown', onNextKeyDown);
      index++;
      if (index >= total) {
        finishSession();
      } else {
        renderQuestion();
        document.addEventListener('keydown', onKeyDown);
      }
    }
  });

  function finishSession() {
    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('keydown', onNextKeyDown);
    panel.innerHTML = `
      <div class="practice-result">
        ${buildResultHtml(correct, total, { backHref: 'irregular-verbs.html', backLabel: 'Back to Verbs' })}
      </div>
    `;
    const pct = Math.round((correct / total) * 100);
    if (pct >= 50) handleStreakRecord('irregularVerb');
  }
}

function buildQuestionHtml(v, givenField, hideFields, index, total, correct, wrong) {
  const pct = total > 0 ? Math.round((index / total) * 100) : 0;

  const inputsHtml = hideFields.map(f => `
    <div class="iv-fill-form-col">
      <div class="iv-fill-form-col-label">${escapeHtml(f.label)}</div>
      <input class="iv-fill-input" type="text" data-field="${f.key}"
             placeholder="type here…" autocomplete="off" autocorrect="off" spellcheck="false" />
      <div class="iv-fill-correct-answer"></div>
    </div>
  `).join('');

  return `
    <div class="stats-bar">
      <div class="stat">Verb <strong>${index + 1}</strong> / <strong>${total}</strong></div>
      <div class="stat stat-progress">
        <div class="progress-bar"><div class="progress-bar-fill" style="width:${pct}%"></div></div>
        <span>${pct}%</span>
      </div>
      <div class="stat">
        ✓ <strong class="stat-correct">${correct}</strong>
        &nbsp;✗ <strong class="stat-wrong">${wrong}</strong>
      </div>
    </div>

    <div class="iv-fill-container">
      <div class="iv-fill-card">
        <div class="iv-fill-prompt-label">${escapeHtml(givenField.label)}</div>
        <div class="iv-fill-prompt">${escapeHtml(v[givenField.key] || '—')}</div>

        <div class="iv-fill-forms-grid">
          ${inputsHtml}
        </div>
        <div class="iv-fill-actions">
          <button class="btn btn-primary btn-check" type="button">Check</button>
          <button class="btn btn-primary btn-next hidden" type="button">
            ${index + 1 < total ? 'Next →' : 'See Results'}
          </button>
        </div>
      </div>
    </div>
  `;
}
