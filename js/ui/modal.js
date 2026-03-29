/* ============================================================
   MODAL HELPERS
   Show, close, and wire up close behaviours for modal overlays.
   ============================================================ */

/**
 * Show a modal overlay by selector or element reference.
 * @param {string|HTMLElement} modal  CSS selector or element
 */
export function showModal(modal) {
  const el = typeof modal === 'string' ? document.querySelector(modal) : modal;
  if (!el) return;
  el.classList.add('active');
  requestAnimationFrame(() => {
    const first = el.querySelector('input, textarea, select');
    if (first) first.focus();
  });
}

/**
 * Hide a modal overlay.
 * @param {string|HTMLElement} modal
 */
export function closeModal(modal) {
  const el = typeof modal === 'string' ? document.querySelector(modal) : modal;
  if (!el) return;
  el.classList.remove('active');
}

/**
 * Wire up standard close behaviours for a modal overlay:
 *  - click on any [data-close-modal] element
 *  - Escape key
 * @param {string} selector  CSS selector for the .modal-overlay
 */
export function setupModalClose(selector) {
  const overlay = document.querySelector(selector);
  if (!overlay) return;

  overlay.querySelectorAll('[data-close-modal]').forEach((btn) => {
    btn.addEventListener('click', () => closeModal(overlay));
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('active')) {
      closeModal(overlay);
    }
  });
}
