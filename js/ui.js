/* ============================================================
   UI UTILITIES MODULE
   Modal, toast, confirm dialog helpers — shared across all pages.
   ============================================================ */

// ----------------------------------------------------------------
// Toast notifications
// ----------------------------------------------------------------

let _toastContainer = null;

function ensureToastContainer() {
  if (_toastContainer) return _toastContainer;
  _toastContainer = document.createElement('div');
  _toastContainer.className = 'toast-container';
  document.body.appendChild(_toastContainer);
  return _toastContainer;
}

/**
 * Show a brief toast message.
 * @param {string} message
 * @param {'info'|'success'|'error'|'warning'} type
 * @param {number} duration  ms to stay visible (default 3000)
 */
export function showToast(message, type = 'info', duration = 3000) {
  const container = ensureToastContainer();
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('removing');
    toast.addEventListener('animationend', () => toast.remove());
  }, duration);
}

// ----------------------------------------------------------------
// Generic modal helpers
// ----------------------------------------------------------------

/**
 * Show a modal overlay by selector or element reference.
 * @param {string|HTMLElement} modal  CSS selector or element
 */
export function showModal(modal) {
  const el = typeof modal === 'string' ? document.querySelector(modal) : modal;
  if (!el) return;
  el.classList.add('active');
  // Focus first input if present
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
 *  – click on overlay backdrop closes the modal
 *  – click on any element with [data-close-modal]
 *  – Escape key
 * @param {string} selector  CSS selector for the .modal-overlay
 */
export function setupModalClose(selector) {
  const overlay = document.querySelector(selector);
  if (!overlay) return;

  // Backdrop click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal(overlay);
  });

  // Close buttons inside
  overlay.querySelectorAll('[data-close-modal]').forEach((btn) => {
    btn.addEventListener('click', () => closeModal(overlay));
  });

  // Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('active')) {
      closeModal(overlay);
    }
  });
}

// ----------------------------------------------------------------
// Confirm dialog (promise-based)
// ----------------------------------------------------------------

/**
 * Show a confirmation dialog and return a promise.
 * @param {string} message    Main message text
 * @param {Object} options
 * @param {string} options.title       Dialog title (default "Confirm")
 * @param {string} options.confirmText Confirm button label (default "Confirm")
 * @param {string} options.cancelText  Cancel button label (default "Cancel")
 * @param {string} options.confirmClass Button class (default "btn-danger")
 * @returns {Promise<boolean>}
 */
export function confirmDialog(message, options = {}) {
  const {
    title = 'Confirm',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    confirmClass = 'btn-danger',
  } = options;

  return new Promise((resolve) => {
    // Build overlay
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    overlay.innerHTML = `
      <div class="modal" style="max-width:400px">
        <div class="modal-header">
          <h3>${escapeHtml(title)}</h3>
        </div>
        <div class="modal-body">
          <p>${escapeHtml(message)}</p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" data-action="cancel">${escapeHtml(cancelText)}</button>
          <button class="btn ${confirmClass}" data-action="confirm">${escapeHtml(confirmText)}</button>
        </div>
      </div>
    `;

    const cleanup = (result) => {
      overlay.classList.remove('active');
      setTimeout(() => overlay.remove(), 300);
      resolve(result);
    };

    overlay.querySelector('[data-action="cancel"]').addEventListener('click', () => cleanup(false));
    overlay.querySelector('[data-action="confirm"]').addEventListener('click', () => cleanup(true));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup(false); });
    document.addEventListener('keydown', function handler(e) {
      if (e.key === 'Escape') {
        document.removeEventListener('keydown', handler);
        cleanup(false);
      }
    });

    document.body.appendChild(overlay);
    overlay.querySelector('[data-action="confirm"]').focus();
  });
}

/**
 * Same as confirmDialog but accepts raw HTML for the body.
 * @param {string} bodyHtml  Raw HTML for the modal body
 * @param {Object} options
 * @returns {Promise<boolean>}
 */
export function confirmDialogHtml(bodyHtml, options = {}) {
  const {
    title = 'Confirm',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    confirmClass = 'btn-danger',
  } = options;

  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    overlay.innerHTML = `
      <div class="modal" style="max-width:480px">
        <div class="modal-header">
          <h3>${escapeHtml(title)}</h3>
        </div>
        <div class="modal-body">
          ${bodyHtml}
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" data-action="cancel">${escapeHtml(cancelText)}</button>
          <button class="btn ${confirmClass}" data-action="confirm">${escapeHtml(confirmText)}</button>
        </div>
      </div>
    `;

    const cleanup = (result) => {
      overlay.classList.remove('active');
      setTimeout(() => overlay.remove(), 300);
      resolve(result);
    };

    overlay.querySelector('[data-action="cancel"]').addEventListener('click', () => cleanup(false));
    overlay.querySelector('[data-action="confirm"]').addEventListener('click', () => cleanup(true));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup(false); });
    document.addEventListener('keydown', function handler(e) {
      if (e.key === 'Escape') {
        document.removeEventListener('keydown', handler);
        cleanup(false);
      }
    });

    document.body.appendChild(overlay);
    overlay.querySelector('[data-action="confirm"]').focus();
  });
}

// ----------------------------------------------------------------
// Milestone celebration modal
// ----------------------------------------------------------------

/**
 * Show a milestone celebration modal.
 * @param {{ title: string, message: string }} milestoneInfo
 * @returns {Promise<void>}  Resolves when user dismisses
 */
export function showMilestoneModal({ title, message }) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    overlay.innerHTML = `
      <div class="modal" style="max-width:380px">
        <div class="milestone-content">
          <div class="milestone-icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
              <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
              <path d="M4 22h16"/>
              <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
              <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
              <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
            </svg>
          </div>
          <h3 class="milestone-title">${escapeHtml(title)}</h3>
          <p class="milestone-message">${escapeHtml(message)}</p>
          <button class="btn btn-primary" data-action="dismiss">Keep Going!</button>
        </div>
      </div>
    `;

    const cleanup = () => {
      overlay.classList.remove('active');
      setTimeout(() => overlay.remove(), 300);
      resolve();
    };

    overlay.querySelector('[data-action="dismiss"]').addEventListener('click', cleanup);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup(); });
    document.addEventListener('keydown', function handler(e) {
      if (e.key === 'Escape') {
        document.removeEventListener('keydown', handler);
        cleanup();
      }
    });

    document.body.appendChild(overlay);
  });
}

// ----------------------------------------------------------------
// Utility
// ----------------------------------------------------------------

/**
 * Minimal HTML escaping for safe interpolation.
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
