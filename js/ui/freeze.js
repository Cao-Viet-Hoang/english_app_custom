/* ============================================================
   STREAK FREEZE MODAL
   Notifies the user that a streak freeze was used to save their streak.
   ============================================================ */

/**
 * Show a modal explaining that one or more streak freezes were consumed.
 * @param {{ streak: number, freezesUsed: number, freezesLeft: number }} info
 * @returns {Promise<void>} Resolves when the user dismisses the modal
 */
export function showStreakFreezeModal({ streak = 0, freezesUsed = 1, freezesLeft = 0 }) {
  return new Promise((resolve) => {
    const usedText = freezesUsed === 1
      ? 'A streak freeze was used'
      : `${freezesUsed} streak freezes were used`;
    const leftText = freezesLeft === 1
      ? '1 freeze left'
      : `${freezesLeft} freezes left`;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    overlay.innerHTML = `
      <div class="modal" style="max-width:380px">
        <div class="milestone-content">
          <div class="milestone-icon freeze-icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="2" x2="12" y2="22"/>
              <line x1="2" y1="12" x2="22" y2="12"/>
              <line x1="4.9" y1="4.9" x2="19.1" y2="19.1"/>
              <line x1="19.1" y1="4.9" x2="4.9" y2="19.1"/>
              <path d="M9.2 4.8 12 7l2.8-2.2M9.2 19.2 12 17l2.8 2.2"/>
              <path d="M4.8 9.2 7 12l-2.2 2.8M19.2 9.2 17 12l2.2 2.8"/>
            </svg>
          </div>
          <h3 class="milestone-title">Streak Freeze Used</h3>
          <p class="milestone-message">
            ${usedText} to protect your ${streak}-day streak. ${leftText} — keep learning to earn more!
          </p>
          <button class="btn btn-primary" data-action="dismiss">Got it</button>
        </div>
      </div>
    `;

    const cleanup = () => {
      overlay.classList.remove('active');
      setTimeout(() => overlay.remove(), 300);
      resolve();
    };

    overlay.querySelector('[data-action="dismiss"]').addEventListener('click', cleanup);
    document.addEventListener('keydown', function handler(e) {
      if (e.key === 'Escape') {
        document.removeEventListener('keydown', handler);
        cleanup();
      }
    });

    document.body.appendChild(overlay);
  });
}
