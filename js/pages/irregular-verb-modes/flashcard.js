/* ============================================================
   IRREGULAR VERBS — Flashcard Mode
   Front: V1 + Vietnamese. Back: V2 + V3 + pattern.
   ============================================================ */

import { shuffle } from '../../shared/shuffle.js';
import { speakText } from '../../shared/tts.js';
import { buildResultHtml } from '../../shared/result-builder.js';
import { handleStreakRecord } from '../../shared/streak-handler.js';
import { escapeHtml } from '../../ui/index.js';

const FC_MAX_RETRY = 2;

const PATTERN_CSS = { AAA: 'pat-aaa', ABB: 'pat-abb', ABA: 'pat-aba', ABC: 'pat-abc' };

function patBadge(p) {
  const cls = PATTERN_CSS[p] || 'pat-abc';
  return `<span class="iv-pattern-badge ${cls}">${escapeHtml(p || 'ABC')}</span>`;
}

export function initIVFlashcard(allVerbs) {
  const panel = document.getElementById('panel-flashcard');
  if (!panel) return;

  let verbs = shuffle([...allVerbs]);
  let index = 0, known = 0, unknown = 0;
  const originalTotal = verbs.length;
  const retryCount = new Map();
  const dontKnowSet = new Set();

  panel.innerHTML = buildPanelHtml(originalTotal);

  const container  = panel.querySelector('.iv-fc-container');
  const resultEl   = panel.querySelector('.iv-fc-result');
  const card       = panel.querySelector('.iv-fc-card');
  const statCurrent = panel.querySelector('.fc-current');
  const statTotal   = panel.querySelector('.fc-total');
  const statKnown   = panel.querySelector('.fc-known');
  const statUnknown = panel.querySelector('.fc-unknown');
  const progressFill = panel.querySelector('.progress-bar-fill');
  const progressTxt  = panel.querySelector('.fc-progress-text');

  panel.querySelector('.iv-fc-speak-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    speakText(verbs[index]?.base || '');
  });

  panel.querySelector('.btn-know')?.addEventListener('click', () => {
    known++;
    index++;
    showCard();
  });

  panel.querySelector('.btn-dont-know')?.addEventListener('click', () => {
    const v = verbs[index];
    dontKnowSet.add(v.id);
    const retries = retryCount.get(v.id) || 0;
    if (retries < FC_MAX_RETRY) {
      verbs.push(v);
      retryCount.set(v.id, retries + 1);
    } else {
      unknown++;
    }
    index++;
    showCard();
  });

  card.addEventListener('click', () => card.classList.toggle('flipped'));

  document.addEventListener('keydown', onKeyDown);

  function onKeyDown(e) {
    if (!panel.closest('.practice-panel.active')) return;
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      card.classList.toggle('flipped');
    } else if (e.code === 'ArrowRight' || e.code === 'KeyJ') {
      panel.querySelector('.btn-know')?.click();
    } else if (e.code === 'ArrowLeft' || e.code === 'KeyK') {
      panel.querySelector('.btn-dont-know')?.click();
    }
  }

  function showCard() {
    card.classList.remove('flipped');
    if (index >= verbs.length) {
      finishSession();
      return;
    }

    const v = verbs[index];
    const isReview = retryCount.has(v.id) && retryCount.get(v.id) > 0;

    panel.querySelector('.iv-fc-verb').textContent        = v.base;
    panel.querySelector('.iv-fc-ipa').textContent         = v.ipaBase || '';
    panel.querySelector('.iv-fc-meaning').textContent     = v.vietnamese || '';
    panel.querySelector('.iv-fc-v2-val').textContent      = v.pastSimple || '—';
    panel.querySelector('.iv-fc-v3-val').textContent      = v.pastParticiple || '—';
    panel.querySelector('.iv-fc-pat-wrap').innerHTML      = patBadge(v.pattern);
    panel.querySelector('.iv-fc-review-badge').classList.toggle('hidden', !isReview);

    statCurrent.textContent  = String(known + unknown + 1);
    statTotal.textContent    = String(originalTotal);
    statKnown.textContent    = String(known);
    statUnknown.textContent  = String(unknown);

    const pct = Math.round((known / originalTotal) * 100);
    progressFill.style.width = pct + '%';
    progressTxt.textContent  = pct + '%';
  }

  function finishSession() {
    document.removeEventListener('keydown', onKeyDown);
    unknown = originalTotal - known;
    container.classList.add('hidden');
    resultEl.classList.remove('hidden');
    resultEl.innerHTML = `
      <div class="practice-result">
        ${buildResultHtml(known, originalTotal, { backHref: 'irregular-verbs.html', backLabel: 'Back to Verbs' })}
        ${buildDontKnowList(verbs, dontKnowSet)}
      </div>
    `;

    const pct = Math.round((known / originalTotal) * 100);
    if (pct >= 50) handleStreakRecord('irregularVerb');
  }

  showCard();
}

function buildDontKnowList(verbs, dontKnowSet) {
  if (dontKnowSet.size === 0) return '';
  const items = verbs.filter((v, i, arr) =>
    dontKnowSet.has(v.id) && arr.indexOf(v) === i
  );
  if (items.length === 0) return '';
  return `
    <div class="fc-review-list">
      <div class="fc-review-list-title">Review these verbs</div>
      <div class="fc-review-list-items">
        ${items.map(v => `
          <div class="fc-review-item">
            <span class="fc-review-item-word">${escapeHtml(v.base)} → ${escapeHtml(v.pastSimple || '?')} → ${escapeHtml(v.pastParticiple || '?')}</span>
            <span class="fc-review-item-meaning">${escapeHtml(v.vietnamese || '')}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function buildPanelHtml(total) {
  return `
    <!-- Stats bar -->
    <div class="stats-bar">
      <div class="stat">Card <strong class="fc-current">1</strong> / <strong class="fc-total">${total}</strong></div>
      <div class="stat stat-progress">
        <div class="progress-bar"><div class="progress-bar-fill" style="width:0%"></div></div>
        <span class="fc-progress-text">0%</span>
      </div>
      <div class="stat">✓ <strong class="fc-known">0</strong>
        &nbsp;✗ <strong class="fc-unknown">0</strong>
      </div>
    </div>

    <!-- Flashcard container -->
    <div class="iv-fc-container">
      <div class="iv-fc-wrapper">
        <div class="iv-fc-card">
          <!-- Front -->
          <div class="iv-fc-face iv-fc-front">
            <span class="iv-fc-review-badge hidden">Review</span>
            <button class="iv-fc-speak-btn" type="button" title="Pronounce">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
                   fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
              </svg>
            </button>
            <div class="iv-fc-label">Base Form (V1)</div>
            <div class="iv-fc-verb"></div>
            <div class="iv-fc-ipa"></div>
            <div class="iv-fc-meaning"></div>
            <div class="iv-fc-hint">Click to reveal V2 &amp; V3</div>
          </div>
          <!-- Back -->
          <div class="iv-fc-face iv-fc-back">
            <div class="iv-fc-label">Conjugated Forms</div>
            <div class="iv-fc-forms">
              <div class="iv-fc-form-item">
                <div class="iv-fc-form-label">Past Simple (V2)</div>
                <div class="iv-fc-form-value v2 iv-fc-v2-val"></div>
              </div>
              <div class="iv-fc-form-item">
                <div class="iv-fc-form-label">Past Participle (V3)</div>
                <div class="iv-fc-form-value v3 iv-fc-v3-val"></div>
              </div>
            </div>
            <div class="iv-fc-pat-wrap"></div>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="iv-fc-actions">
        <button class="btn btn-dont-know" type="button">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
          Don't Know
        </button>
        <button class="btn btn-know" type="button">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          Know It
        </button>
      </div>
    </div>

    <!-- Result -->
    <div class="iv-fc-result hidden"></div>
  `;
}
