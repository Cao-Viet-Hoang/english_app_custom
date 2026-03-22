/* ============================================================
   TOAST NOTIFICATIONS
   Brief popup messages for user feedback.
   ============================================================ */

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
