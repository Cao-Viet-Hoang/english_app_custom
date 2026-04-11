/* ============================================================
   IRREGULAR VERBS — Verb Matching Mode
   Click V1, then click the matching V2 (or V3).
   ============================================================ */

import { shuffle } from '../../shared/shuffle.js';
import { buildResultHtml } from '../../shared/result-builder.js';
import { handleStreakRecord } from '../../shared/streak-handler.js';
import { escapeHtml } from '../../ui/index.js';

const COUNT_OPTIONS = [4, 6, 8, 10];

export function initIVMatching(allVerbs) {
  const panel = document.getElementById('panel-matching');
  if (!panel) return;

  let pairCount = Math.min(6, allVerbs.length);
  let matchField = 'pastSimple'; // v2 by default
  let selectedCard = null;
  let matchedPairs = 0;
  let wrongAttempts = 0;
  let startTime = Date.now();

  render();

  function getAvailableCounts() {
    return COUNT_OPTIONS.filter(n => n <= allVerbs.length);
  }

  function render() {
    const counts = getAvailableCounts();
    const verbs = shuffle([...allVerbs]).slice(0, pairCount);
    matchedPairs = 0;
    wrongAttempts = 0;
    startTime = Date.now();
    selectedCard = null;

    const v1Cards = shuffle(verbs.map(v => ({ id: v.id, text: v.base, side: 'v1', verb: v })));
    const v2Cards = shuffle(verbs.map(v => ({ id: v.id, text: v[matchField] || '—', side: 'v2', verb: v })));

    panel.innerHTML = `
      <div class="iv-match-container">
        <div class="iv-match-toolbar">
          <div class="iv-match-count-group">
            ${counts.map(n => `
              <button class="iv-match-count-btn${n === pairCount ? ' active' : ''}" data-count="${n}" type="button">${n}</button>
            `).join('')}
          </div>
          <div class="iv-match-toolbar-actions">
            <select id="iv-match-field" class="sort-select">
              <option value="pastSimple"${matchField === 'pastSimple' ? ' selected' : ''}>Match V1 → V2</option>
              <option value="pastParticiple"${matchField === 'pastParticiple' ? ' selected' : ''}>Match V1 → V3</option>
            </select>
          </div>
        </div>

        <div class="iv-match-progress">
          Matched: <strong id="iv-match-count">${matchedPairs}</strong> / <strong>${pairCount}</strong>
        </div>

        <div class="iv-match-grid" id="iv-match-grid">
          ${buildMatchGrid(v1Cards, v2Cards)}
        </div>
      </div>
    `;

    panel.querySelector('#iv-match-field')?.addEventListener('change', (e) => {
      matchField = e.target.value;
      render();
    });

    panel.querySelectorAll('.iv-match-count-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        pairCount = parseInt(btn.dataset.count);
        render();
      });
    });

    panel.querySelector('#iv-match-grid')?.addEventListener('click', (e) => {
      const card = e.target.closest('.iv-match-card:not(.matched)');
      if (!card) return;

      if (selectedCard === null) {
        selectedCard = card;
        card.classList.add('selected');
      } else if (selectedCard === card) {
        card.classList.remove('selected');
        selectedCard = null;
      } else {
        const firstId = selectedCard.dataset.id;
        const secondId = card.dataset.id;
        const firstSide = selectedCard.dataset.side;
        const secondSide = card.dataset.side;

        // Must be different sides
        if (firstSide === secondSide) {
          selectedCard.classList.remove('selected');
          selectedCard = card;
          card.classList.add('selected');
          return;
        }

        if (firstId === secondId) {
          // Correct match!
          selectedCard.classList.remove('selected');
          selectedCard.classList.add('matched');
          card.classList.add('matched');
          selectedCard = null;
          matchedPairs++;
          const matchCountEl = panel.querySelector('#iv-match-count');
          if (matchCountEl) matchCountEl.textContent = String(matchedPairs);

          if (matchedPairs === pairCount) {
            setTimeout(() => finishSession(pairCount), 600);
          }
        } else {
          // Wrong match
          wrongAttempts++;
          const s = selectedCard;
          s.classList.add('wrong-flash');
          card.classList.add('wrong-flash');
          setTimeout(() => {
            s.classList.remove('selected', 'wrong-flash');
            card.classList.remove('wrong-flash');
          }, 450);
          selectedCard = null;
        }
      }
    });
  }

  function buildMatchGrid(v1Cards, v2Cards) {
    const rightLabel = matchField === 'pastParticiple' ? 'Past Participle (V3)' : 'Past Simple (V2)';

    const rows = v1Cards.map((c1, i) => {
      const c2 = v2Cards[i];
      return `
        <div class="iv-match-card v1-card" data-id="${c1.id}" data-side="v1">${escapeHtml(c1.text)}</div>
        <div class="iv-match-card v2-card" data-id="${c2.id}" data-side="v2">${escapeHtml(c2.text)}</div>
      `;
    }).join('');

    return `
      <div class="iv-match-col-header">Base (V1)</div>
      <div class="iv-match-col-header">${escapeHtml(rightLabel)}</div>
      ${rows}
    `;
  }

  function finishSession(total) {
    const pct = wrongAttempts === 0 ? 100 : Math.max(0, Math.round((1 - wrongAttempts / (total + wrongAttempts)) * 100));
    panel.innerHTML = `
      <div class="practice-result">
        ${buildResultHtml(pct === 100 ? total : Math.round(total * pct / 100), total, {
          backHref: 'irregular-verbs.html',
          backLabel: 'Back to Verbs',
          label: wrongAttempts === 0 ? 'Perfect!' : `${wrongAttempts} mistake${wrongAttempts !== 1 ? 's' : ''}`,
        })}
      </div>
    `;
    if (pct >= 50) handleStreakRecord();
  }
}
