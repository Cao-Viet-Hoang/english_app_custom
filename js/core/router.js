/* ============================================================
   ROUTER / SESSION MODULE
   Guards pages, provides navigation helpers.
   ============================================================ */

const SESSION_KEY = 'app_session';

/**
 * Retrieve the current session from sessionStorage.
 * @returns {{ username: string, azureOpenAI: Object, firebase: Object } | null}
 */
export function getSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Persist session data to sessionStorage.
 * @param {Object} data
 */
export function setSession(data) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
}

/**
 * Clear session and redirect to login.
 * Keeps saved credentials in localStorage but marks them as pre-fill only
 * (no auto-login), so the login form is pre-populated on the next visit.
 */
export function logout() {
  sessionStorage.removeItem(SESSION_KEY);
  // Mark credentials for pre-fill only — don't auto-login after explicit logout
  const saved = localStorage.getItem('app_login_credentials');
  if (saved) {
    try {
      const creds = JSON.parse(saved);
      creds.autoLogin = false;
      localStorage.setItem('app_login_credentials', JSON.stringify(creds));
    } catch {
      localStorage.removeItem('app_login_credentials');
    }
  }
  navigateTo('index.html');
}

/**
 * Guard function — call at the top of every protected page.
 * Redirects to login if no valid session exists.
 * Also initialises Firebase from session config.
 * @returns {{ username: string, azureOpenAI: Object, firebase: Object }}
 */
export function guardAuth() {
  const session = getSession();
  if (!session || !session.username) {
    navigateTo('index.html');
    throw new Error('Not authenticated');
  }
  return session;
}

/**
 * Navigate to a page, optionally with query parameters.
 * @param {string} page   e.g. 'topics.html' or 'topic-detail.html'
 * @param {Object} params e.g. { topicId: 'abc123' }
 */
export function navigateTo(page, params = {}) {
  const query = new URLSearchParams(params).toString();
  window.location.href = query ? `${page}?${query}` : page;
}

/**
 * Read a query parameter from the current URL.
 * @param {string} name
 * @returns {string|null}
 */
export function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

/**
 * Get the current username from session.
 * @returns {string}
 */
export function getUsername() {
  const session = getSession();
  return session ? session.username : '';
}
