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
 * Clear session, remove saved credentials, and redirect to login.
 */
export function logout() {
  sessionStorage.removeItem(SESSION_KEY);
  localStorage.removeItem('app_login_credentials');
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
