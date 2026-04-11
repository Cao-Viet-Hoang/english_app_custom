/**
 * Shared bulk-add utilities.
 *
 * Reusable helpers for any "Bulk Add (AI)" flow:
 *   - Input parsing with lowercase normalisation
 *   - Real-time uppercase warning
 *   - Selection counter
 *   - AI spelling-correction notice
 *   - Duplicate-warning row / confirmation HTML
 *   - Preview-table row-toggle + Select All / Deselect All wiring
 */

import { showToast, escapeHtml } from '../ui/index.js';

/* ------------------------------------------------------------------
 * Input Parsing
 * ----------------------------------------------------------------*/

/**
 * Split comma-/newline-separated text into a deduplicated lowercase array.
 * If any uppercase letter was converted, the input element's value is
 * updated and a toast is shown so the user knows what happened.
 *
 * @param {string} text           Raw textarea value
 * @param {HTMLElement|null} inputEl  Input element to update (optional)
 * @returns {string[]}
 */
export function parseBulkInput(text, inputEl = null) {
  const raw = [...new Set(
    text.split(/[,\n]+/)
      .map(w => w.trim())
      .filter(w => w.length > 0)
  )];
  const lowered = raw.map(w => w.toLowerCase());
  if (raw.some((w, i) => w !== lowered[i])) {
    if (inputEl) inputEl.value = lowered.join(', ');
    showToast('Converted to lowercase.', 'info');
  }
  return [...new Set(lowered)];
}

/* ------------------------------------------------------------------
 * Lowercase Warning
 * ----------------------------------------------------------------*/

/**
 * Attach a real-time listener that shows / hides a warning element
 * whenever the input contains uppercase characters.
 *
 * @param {HTMLElement|null} inputEl
 * @param {HTMLElement|null} warnEl
 */
export function setupLowercaseWarning(inputEl, warnEl) {
  if (!inputEl || !warnEl) return;
  inputEl.addEventListener('input', () => {
    warnEl.classList.toggle('hidden', !/[A-Z]/.test(inputEl.value));
  });
}

/* ------------------------------------------------------------------
 * Selection Counter
 * ----------------------------------------------------------------*/

/**
 * Update "X / Y selected" text and enable/disable the add button.
 *
 * @param {HTMLElement|null} tbodyEl
 * @param {HTMLElement|null} counterEl
 * @param {HTMLElement|null} btnEl
 */
export function updateBulkCounter(tbodyEl, counterEl, btnEl) {
  if (!tbodyEl || !counterEl || !btnEl) return;
  const checked = tbodyEl.querySelectorAll('input[type=checkbox]:checked').length;
  const total   = tbodyEl.querySelectorAll('input[type=checkbox]').length;
  counterEl.textContent = `${checked} / ${total} selected`;
  btnEl.disabled = checked === 0;
}

/* ------------------------------------------------------------------
 * Preview Table Interaction
 * ----------------------------------------------------------------*/

/**
 * Wire up:
 *  - checkbox change → update counter
 *  - row click (outside checkbox) → toggle that row's checkbox
 *  - Select All / Deselect All buttons
 *
 * @param {object} opts
 * @param {HTMLElement|null} opts.tbodyEl
 * @param {HTMLElement|null} opts.selectAllBtn
 * @param {HTMLElement|null} opts.deselectAllBtn
 * @param {Function}         opts.onCountChange  Called after every toggle
 */
export function setupBulkPreviewHandlers({ tbodyEl, selectAllBtn, deselectAllBtn, onCountChange }) {
  if (tbodyEl) {
    tbodyEl.addEventListener('change', onCountChange);
    tbodyEl.addEventListener('click', (e) => {
      if (e.target.type === 'checkbox') return;
      const row = e.target.closest('tr');
      if (!row) return;
      const cb = row.querySelector('input[type=checkbox]');
      if (cb) { cb.checked = !cb.checked; onCountChange(); }
    });
  }
  if (selectAllBtn) {
    selectAllBtn.addEventListener('click', () => {
      if (!tbodyEl) return;
      tbodyEl.querySelectorAll('input[type=checkbox]').forEach(cb => cb.checked = true);
      onCountChange();
    });
  }
  if (deselectAllBtn) {
    deselectAllBtn.addEventListener('click', () => {
      if (!tbodyEl) return;
      tbodyEl.querySelectorAll('input[type=checkbox]').forEach(cb => cb.checked = false);
      onCountChange();
    });
  }
}

/* ------------------------------------------------------------------
 * AI Spelling Correction Notice
 * ----------------------------------------------------------------*/

/**
 * Show / hide a correction-notice banner above the preview table.
 * Each result object must expose `correctedWord` and `originalWord`.
 *
 * @param {Array<{correctedWord?:string, originalWord?:string}>} results
 * @param {HTMLElement|null} noticeEl
 */
export function showCorrectionNotice(results, noticeEl) {
  if (!noticeEl) return;
  const corrections = results.filter(r =>
    r.correctedWord && r.originalWord &&
    r.correctedWord.toLowerCase() !== r.originalWord.toLowerCase()
  );
  if (corrections.length > 0) {
    const list = corrections
      .map(r => `<strong><s>${escapeHtml(r.originalWord)}</s> → ${escapeHtml(r.correctedWord)}</strong>`)
      .join(', ');
    noticeEl.innerHTML =
      `⚠ Spelling auto-corrected for ${corrections.length} word${corrections.length > 1 ? 's' : ''}: ${list}`;
    noticeEl.classList.remove('hidden');
  } else {
    noticeEl.classList.add('hidden');
  }
}

/* ------------------------------------------------------------------
 * Per-Row Inline Warnings (for preview table cells)
 * ----------------------------------------------------------------*/

/**
 * Build inline HTML for a duplicate warning inside a table cell.
 *
 * @param {Array<{name:string, isCurrent?:boolean}>|null} dupeLocations
 * @returns {string}
 */
export function buildDupeRowHtml(dupeLocations) {
  if (!dupeLocations || dupeLocations.length === 0) return '';
  const locs = dupeLocations
    .map(l => escapeHtml(l.name) + (l.isCurrent ? ' (current)' : ''))
    .join(', ');
  return `<br><small class="bulk-dupe-warn">Exists in: ${locs}</small>`;
}

/**
 * Build inline HTML for a spelling-correction indicator inside a table cell.
 *
 * @param {string|null} originalWord  The user's pre-correction input
 * @returns {string}
 */
export function buildCorrectionRowHtml(originalWord) {
  if (!originalWord) return '';
  return `<br><small class="bulk-correction-warn"><s>${escapeHtml(originalWord)}</s> → corrected</small>`;
}

/* ------------------------------------------------------------------
 * Duplicate Confirmation Dialog
 * ----------------------------------------------------------------*/

/**
 * Build the body HTML for a "duplicates found" confirmation dialog.
 * `duplicatesMap` maps a display key (word / verb base) to an array
 * of `{ name, isCurrent }` location objects.
 *
 * @param {Map<string, Array<{name:string, isCurrent?:boolean}>>} duplicatesMap
 * @returns {string}
 */
export function buildDuplicateWarningHtml(duplicatesMap) {
  let html = '<div class="bulk-dupe-dialog">';
  html += '<p>The following item(s) already exist:</p><ul>';
  for (const [key, locations] of duplicatesMap) {
    const locs = locations
      .map(l => l.isCurrent
        ? `<strong>${escapeHtml(l.name)}</strong> (current)`
        : `<strong>${escapeHtml(l.name)}</strong>`)
      .join(', ');
    html += `<li><span class="bulk-dupe-key">${escapeHtml(key)}</span> — ${locs}</li>`;
  }
  html += '</ul><p class="text-light">Do you still want to add?</p></div>';
  return html;
}
