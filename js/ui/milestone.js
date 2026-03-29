/* ============================================================
   MILESTONE CELEBRATION MODAL
   Full-screen overlay celebrating streak milestones.
   ============================================================ */

import { escapeHtml } from './utils.js';

/**
 * Show a milestone celebration modal.
 * @param {{ title: string, message: string }} milestoneInfo
 * @returns {Promise<void>} Resolves when user dismisses
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
    document.addEventListener('keydown', function handler(e) {
      if (e.key === 'Escape') {
        document.removeEventListener('keydown', handler);
        cleanup();
      }
    });

    document.body.appendChild(overlay);
  });
}
