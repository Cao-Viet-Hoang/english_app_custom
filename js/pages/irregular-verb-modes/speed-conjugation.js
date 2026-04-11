/* ============================================================
   IRREGULAR VERBS — Speed Conjugation Mode
   Given V1, type V2 and V3 as fast as possible.
   ============================================================ */

import { shuffle } from '../../shared/shuffle.js';
import { speakText } from '../../shared/tts.js';
import { buildResultHtml } from '../../shared/result-builder.js';
import { handleStreakRecord } from '../../shared/streak-handler.js';
import { escapeHtml } from '../../ui/index.js';

const TIME_OPTIONS = [30, 60, 120, 0]; // 0 = no timer

let _activeTimerInterval = null;

export function initIVSpeedConj(allVerbs) {
  const panel = document.getElementById('panel-speed-conj');
  if (!panel) return;

  // Clear any lingering timer from a previous session
  if (_activeTimerInterval) {
    clearInterval(_activeTimerInterval);
    _activeTimerInterval = null;
  }

  let timeLimit = 60;
  let timerInterval = null;
  let timeRemaining = timeLimit;
  let totalSeconds = 0;
  let verbs = shuffle([...allVerbs]);
  let index = 0, correct = 0, wrong = 0, started = false;

  renderStartView();

  function renderStartView() {
    panel.innerHTML = `
      <div class="iv-speed-container">
        <div class="iv-speed-toolbar">
          <div class="iv-speed-timer-group">
            ${TIME_OPTIONS.map(t => `
              <button class="iv-speed-timer-btn${t === timeLimit ? ' active' : ''}" data-time="${t}" type="button">
                ${t === 0 ? '∞' : t + 's'}
              </button>
            `).join('')}
          </div>
        </div>
        <div style="text-align:center;padding:var(--sp-7)">
          <p class="text-light" style="margin-bottom:var(--sp-5)">
            Với mỗi động từ V1 được hiện ra, hãy điền V2 và V3 càng nhanh càng tốt.
          </p>
          <button id="iv-speed-start" class="btn btn-primary btn-lg" type="button">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
            Start
          </button>
        </div>
      </div>
    `;

    panel.querySelectorAll('.iv-speed-timer-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        timeLimit = parseInt(btn.dataset.time);
        panel.querySelectorAll('.iv-speed-timer-btn').forEach(b => b.classList.toggle('active', b === btn));
      });
    });

    panel.querySelector('#iv-speed-start')?.addEventListener('click', startGame);
  }

  function startGame() {
    started = true;
    verbs = shuffle([...allVerbs]);
    index = 0; correct = 0; wrong = 0; totalSeconds = 0;
    timeRemaining = timeLimit > 0 ? timeLimit : 0;

    if (timeLimit > 0) {
      timerInterval = setInterval(() => {
        timeRemaining--;
        totalSeconds++;
        updateTimerDisplay();
        if (timeRemaining <= 0) {
          clearInterval(timerInterval);
          _activeTimerInterval = null;
          finishSession();
        }
      }, 1000);
    } else {
      timerInterval = setInterval(() => { totalSeconds++; updateTimerDisplay(); }, 1000);
    }
    _activeTimerInterval = timerInterval;

    renderCard();
  }

  function updateTimerDisplay() {
    const el = panel.querySelector('.iv-speed-timer-display');
    if (!el) return;
    if (timeLimit > 0) {
      el.textContent = String(timeRemaining) + 's';
      el.classList.toggle('warning', timeRemaining <= 15 && timeRemaining > 5);
      el.classList.toggle('danger', timeRemaining <= 5);
    } else {
      el.textContent = String(totalSeconds) + 's';
    }
  }

  function renderCard() {
    if (index >= verbs.length) {
      clearInterval(timerInterval);
      finishSession();
      return;
    }

    const v = verbs[index];
    const timerVal = timeLimit > 0 ? String(timeRemaining) + 's' : String(totalSeconds) + 's';
    const pct = Math.round((index / verbs.length) * 100);

    panel.innerHTML = `
      <div class="stats-bar">
        <div class="stat">Verb <strong>${index + 1}</strong> / <strong>${verbs.length}</strong></div>
        <div class="stat stat-progress">
          <div class="progress-bar"><div class="progress-bar-fill" style="width:${pct}%"></div></div>
          <span>${pct}%</span>
        </div>
        <div class="stat">
          ✓ <strong style="color:var(--color-success)">${correct}</strong>
          &nbsp;✗ <strong style="color:var(--color-danger)">${wrong}</strong>
        </div>
      </div>

      <div class="iv-speed-container">
        <div class="iv-speed-timer-display">${timerVal}</div>

        <div class="iv-speed-card">
          <div class="iv-speed-prompt-label">Base Form (V1)</div>
          <div class="iv-speed-prompt">${escapeHtml(v.base)}</div>
          <div class="iv-speed-meaning">${escapeHtml(v.vietnamese || '')}</div>

          <div class="iv-speed-inputs">
            <div class="iv-speed-input-col">
              <div class="iv-speed-input-label">Past Simple (V2)</div>
              <input class="iv-speed-input" id="iv-speed-v2" type="text"
                     placeholder="type V2…" autocomplete="off" autocorrect="off" spellcheck="false" />
              <div class="iv-speed-feedback" id="iv-speed-v2-fb"></div>
            </div>
            <div class="iv-speed-input-col">
              <div class="iv-speed-input-label">Past Participle (V3)</div>
              <input class="iv-speed-input" id="iv-speed-v3" type="text"
                     placeholder="type V3…" autocomplete="off" autocorrect="off" spellcheck="false" />
              <div class="iv-speed-feedback" id="iv-speed-v3-fb"></div>
            </div>
          </div>

          <div class="iv-speed-actions">
            <button class="btn btn-primary" id="iv-speed-check" type="button">Check</button>
            <button class="btn btn-ghost" id="iv-speed-skip" type="button">Skip</button>
          </div>
        </div>

        <div class="iv-speed-score">
          <div class="score-correct"><strong>${correct}</strong><span>Correct</span></div>
          <div class="score-wrong"><strong>${wrong}</strong><span>Wrong</span></div>
        </div>
      </div>
    `;

    const v2Input = panel.querySelector('#iv-speed-v2');
    const v3Input = panel.querySelector('#iv-speed-v3');
    v2Input?.focus();

    // Tab between inputs
    v2Input?.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') { e.preventDefault(); v3Input?.focus(); }
      if (e.key === 'Enter') panel.querySelector('#iv-speed-check')?.click();
    });
    v3Input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') panel.querySelector('#iv-speed-check')?.click();
    });

    panel.querySelector('#iv-speed-check')?.addEventListener('click', () => checkCard(v, v2Input, v3Input));
    panel.querySelector('#iv-speed-skip')?.addEventListener('click', () => {
      wrong++;
      nextCard(v);
    });
  }

  function checkCard(v, v2Input, v3Input) {
    const v2Val = v2Input?.value.trim().toLowerCase() || '';
    const v3Val = v3Input?.value.trim().toLowerCase() || '';
    const correctV2 = (v.pastSimple || '').toLowerCase();
    const correctV3 = (v.pastParticiple || '').toLowerCase();

    const v2Ok = v2Val === correctV2;
    const v3Ok = v3Val === correctV3;

    if (v2Input) {
      v2Input.disabled = true;
      v2Input.classList.add(v2Ok ? 'correct' : 'wrong');
    }
    if (v3Input) {
      v3Input.disabled = true;
      v3Input.classList.add(v3Ok ? 'correct' : 'wrong');
    }

    const v2Fb = panel.querySelector('#iv-speed-v2-fb');
    const v3Fb = panel.querySelector('#iv-speed-v3-fb');
    if (v2Fb) { v2Fb.className = `iv-speed-feedback ${v2Ok ? 'correct' : 'wrong'}`; v2Fb.textContent = v2Ok ? '✓' : correctV2; }
    if (v3Fb) { v3Fb.className = `iv-speed-feedback ${v3Ok ? 'correct' : 'wrong'}`; v3Fb.textContent = v3Ok ? '✓' : correctV3; }

    if (v2Ok && v3Ok) correct++; else wrong++;

    speakText(v.base);

    const checkBtn = panel.querySelector('#iv-speed-check');
    if (checkBtn) { checkBtn.textContent = index + 1 < verbs.length ? 'Next →' : 'Finish'; checkBtn.onclick = () => nextCard(v); checkBtn.focus(); }
    const skipBtn = panel.querySelector('#iv-speed-skip');
    if (skipBtn) skipBtn.classList.add('hidden');
  }

  function nextCard(v) {
    index++;
    if (index >= verbs.length || (timeLimit > 0 && timeRemaining <= 0)) {
      clearInterval(timerInterval);
      finishSession();
    } else {
      renderCard();
    }
  }

  function finishSession() {
    clearInterval(timerInterval);
    _activeTimerInterval = null;
    panel.innerHTML = `
      <div class="practice-result">
        ${buildResultHtml(correct, Math.max(index, 1), {
          backHref: 'irregular-verbs.html',
          backLabel: 'Back to Verbs',
          label: `${correct} / ${index} verbs`,
        })}
        <p class="text-light text-sm" style="margin-top:var(--sp-3)">Time: ${totalSeconds}s</p>
      </div>
    `;
    const pct = index > 0 ? Math.round((correct / index) * 100) : 0;
    if (pct >= 50) handleStreakRecord();
  }
}
