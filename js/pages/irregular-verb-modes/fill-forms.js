/* ============================================================
   IRREGULAR VERBS — Fill the Forms Mode
   Show some forms, user fills the missing ones.
   ============================================================ */

import { shuffle } from '../../shared/shuffle.js';
import { speakText } from '../../shared/tts.js';
import { buildResultHtml } from '../../shared/result-builder.js';
import { handleStreakRecord } from '../../shared/streak-handler.js';
import { escapeHtml } from '../../ui/index.js';

// Challenge types: which field is hidden
const CHALLENGE_TYPES = [
  { hide: ['pastSimple', 'pastParticiple'], label: 'V2 & V3' },
  { hide: ['pastSimple'],                  label: 'V2' },
  { hide: ['pastParticiple'],              label: 'V3' },
];

export function initIVFillForms(allVerbs) {
  const panel = document.getElementById('panel-fill-forms');
  if (!panel) return;

  const verbs = shuffle([...allVerbs]);
  let index = 0, correct = 0, wrong = 0, answered = false;
  const total = verbs.length;

  renderQuestion();

  function getCurrentChallenge() {
    const v = verbs[index];
    const ct = CHALLENGE_TYPES[index % CHALLENGE_TYPES.length];
    return { v, ct };
  }

  function renderQuestion() {
    answered = false;
    const { v, ct } = getCurrentChallenge();
    panel.innerHTML = buildQuestionHtml(v, ct, index, total, correct, wrong);

    panel.querySelectorAll('.iv-fill-input').forEach(inp => {
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          panel.querySelector('.btn-check')?.click();
        }
      });
    });

    panel.querySelector('.btn-check')?.addEventListener('click', checkAnswers);
    panel.querySelector('.btn-speak-fill')?.addEventListener('click', () => speakText(v.base));

    // Auto-focus first input
    panel.querySelector('.iv-fill-input')?.focus();
  }

  function checkAnswers() {
    if (answered) return;
    answered = true;

    const { v, ct } = getCurrentChallenge();
    let allCorrect = true;

    ct.hide.forEach(field => {
      const inp = panel.querySelector(`.iv-fill-input[data-field="${field}"]`);
      if (!inp) return;
      const userVal = inp.value.trim().toLowerCase();
      const correctVal = (v[field] || '').toLowerCase();
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
    document.addEventListener('keydown', onNextKeyDown);
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
    if (pct >= 50) handleStreakRecord();
  }
}

function buildQuestionHtml(v, ct, index, total, correct, wrong) {
  const FIELDS = [
    { key: 'base',           label: 'Base (V1)' },
    { key: 'pastSimple',     label: 'Past Simple (V2)' },
    { key: 'pastParticiple', label: 'Past Participle (V3)' },
  ];

  const pct = total > 0 ? Math.round((index / total) * 100) : 0;

  const formsHtml = FIELDS.map(f => {
    const isHidden = ct.hide.includes(f.key);
    if (isHidden) {
      return `
        <div class="iv-fill-form-col">
          <div class="iv-fill-form-col-label">${escapeHtml(f.label)}</div>
          <input class="iv-fill-input" type="text" data-field="${f.key}"
                 placeholder="type here…" autocomplete="off" autocorrect="off" spellcheck="false" />
          <div class="iv-fill-correct-answer"></div>
        </div>`;
    }
    return `
      <div class="iv-fill-form-col">
        <div class="iv-fill-form-col-label">${escapeHtml(f.label)}</div>
        <div class="iv-fill-given">${escapeHtml(v[f.key] || '—')}</div>
      </div>`;
  }).join('');

  return `
    <div class="stats-bar">
      <div class="stat">Verb <strong>${index + 1}</strong> / <strong>${total}</strong></div>
      <div class="stat stat-progress">
        <div class="progress-bar"><div class="progress-bar-fill" style="width:${pct}%"></div></div>
        <span>${pct}%</span>
      </div>
      <div class="stat">
        ✓ <strong class="stat-correct" style="color:var(--color-success)">${correct}</strong>
        &nbsp;✗ <strong class="stat-wrong" style="color:var(--color-danger)">${wrong}</strong>
      </div>
    </div>

    <div class="iv-fill-container">
      <div class="iv-fill-card">
        <div class="iv-fill-meaning">
          ${escapeHtml(v.vietnamese || v.base)}
          <button class="btn-speak-fill btn-speak" type="button" title="Pronounce V1" style="vertical-align:middle;margin-left:6px">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
            </svg>
          </button>
        </div>
        <div class="iv-fill-forms-grid">
          ${formsHtml}
        </div>
        <div class="iv-fill-actions">
          <button class="btn btn-primary btn-check" type="button">Check</button>
          <button class="btn btn-ghost btn-next hidden" type="button">
            ${index + 1 < total ? 'Next →' : 'See Results'}
          </button>
        </div>
      </div>
    </div>
  `;
}
