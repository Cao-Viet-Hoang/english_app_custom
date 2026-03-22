/* ============================================================
   UI UTILITIES
   Pure helper functions with no DOM side-effects at import time.
   ============================================================ */

/**
 * Minimal HTML escaping for safe interpolation into innerHTML.
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Format a Firestore Timestamp or Date to a readable string.
 * @param {Object|Date} ts  Firestore Timestamp or JS Date
 * @returns {string}
 */
export function formatDate(ts) {
  if (!ts) return '';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  return date.toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}
