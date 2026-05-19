/* ============================================================
   RESULT BUILDER
   Shared result screen HTML for practice / reading / writing.
   ============================================================ */

/**
 * Build HTML for a score result overlay.
 *
 * @param {number} correct  Number of correct answers
 * @param {number} total    Total questions / words
 * @param {Object} [options]
 * @param {string} [options.topicId]   For the "Back to Topic" link (topic-detail.html)
 * @param {string} [options.backHref]  Custom back link URL (overrides topicId)
 * @param {string} [options.backLabel] Custom back link label (defaults to "Back to Topic")
 * @param {string} [options.label]     Custom score label (overrides percentage)
 * @returns {string} HTML string
 */
export function buildResultHtml(correct, total, { topicId = '', backHref = '', backLabel = '', label = '' } = {}) {
  const pct = Math.round((correct / total) * 100);
  let iconClass, iconSvg, resultLabel;

  if (pct >= 80) {
    iconClass = 'great';
    iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
    resultLabel = 'Excellent!';
  } else if (pct >= 50) {
    iconClass = 'good';
    iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
    resultLabel = 'Good effort! Keep practicing.';
  } else {
    iconClass = 'needs-work';
    iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
    resultLabel = 'Keep going! Practice makes perfect.';
  }

  const resolvedHref = backHref || (topicId ? `topic-detail.html?topicId=${topicId}` : '');
  const resolvedLabel = backLabel || 'Back to Topic';
  const backLink = resolvedHref
    ? `<a class="btn btn-ghost" href="${resolvedHref}">${resolvedLabel}</a>`
    : '';

  return `
    <div class="result-icon ${iconClass}">${iconSvg}</div>
    <div class="result-score">${label || pct + '%'}</div>
    <div class="result-label">${resultLabel}</div>
    <div class="result-details">
      <div class="result-detail-item">
        <div class="num green">${correct}</div>
        <div class="lbl">Correct</div>
      </div>
      <div class="result-detail-item">
        <div class="num red">${total - correct}</div>
        <div class="lbl">Wrong</div>
      </div>
    </div>
    <div class="result-actions">
      <button class="btn btn-primary" onclick="window._restartMode()">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
        Play Again
      </button>
      ${backLink}
    </div>
  `;
}
