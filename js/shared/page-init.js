/* ============================================================
   PAGE INIT
   Shared bootstrap for protected pages: auth guard, Firebase init,
   navbar setup, streak badge, and optional topic ID extraction.
   ============================================================ */

import { guardAuth, logout, getQueryParam, navigateTo } from '../core/router.js';
import { initFirebase } from '../core/firebase.js';
import { loadStreak } from '../features/streak.js';

/**
 * Bootstrap a protected page.
 *
 * @param {Object} [options]
 * @param {boolean} [options.requireTopicId=false]  Redirect to topics.html if topicId missing
 * @returns {{ session: Object, topicId: string|null }}
 */
export function initProtectedPage({ requireTopicId = false } = {}) {
  const session = guardAuth();
  initFirebase(session.firebase);

  // Navbar user info
  const usernameEl = document.getElementById('nav-username');
  const avatarEl = document.getElementById('nav-avatar');
  const logoutBtn = document.getElementById('btn-logout');

  if (usernameEl) usernameEl.textContent = session.username;
  if (avatarEl) avatarEl.textContent = session.username.charAt(0).toUpperCase();
  if (logoutBtn) logoutBtn.addEventListener('click', logout);

  // Navbar streak badge (fire-and-forget)
  loadStreak().then(data => {
    const el = document.getElementById('navbar-streak');
    const countEl = document.getElementById('navbar-streak-count');
    if (el && countEl && (data.currentStreak > 0 || data.isActiveToday)) {
      countEl.textContent = data.currentStreak;
      el.style.display = '';
    }
  }).catch(() => {});

  // Topic ID
  let topicId = null;
  if (requireTopicId) {
    topicId = getQueryParam('topicId');
    if (!topicId) {
      navigateTo('topics.html');
      throw new Error('No topicId');
    }
  } else {
    topicId = getQueryParam('topicId');
  }

  return { session, topicId };
}
