/* ============================================================
   AUTH MODULE
   Parses login JSON secret, initialises Firebase, saves session.
   ============================================================ */

import { initFirebase } from './firebase.js';
import { setSession, navigateTo, getSession } from './router.js';
import { showToast } from './ui.js';

/**
 * Expected JSON secret format:
 * {
 *   "firebase": {
 *     "apiKey": "...",
 *     "projectId": "...",
 *     "authDomain": "...",         // optional
 *     "storageBucket": "...",      // optional
 *     "messagingSenderId": "...",  // optional
 *     "appId": "..."              // optional
 *   },
 *   "azureOpenAI": {
 *     "endpoint": "https://xxx.openai.azure.com",
 *     "apiKey": "...",
 *     "deploymentName": "gpt-4o"
 *   }
 * }
 */

const REQUIRED_FIREBASE  = ['apiKey', 'projectId'];
const REQUIRED_AZURE     = ['endpoint', 'apiKey', 'deploymentName'];
const LOCAL_STORAGE_KEY  = 'app_login_credentials';

/**
 * Validate and parse the JSON secret string.
 * Returns { firebase, azureOpenAI } or throws with a descriptive message.
 */
function parseSecret(jsonStr) {
  let parsed;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error('Invalid JSON format. Please check your secret string.');
  }

  // Firebase config
  if (!parsed.firebase || typeof parsed.firebase !== 'object') {
    throw new Error('Missing "firebase" object in the secret.');
  }
  for (const key of REQUIRED_FIREBASE) {
    if (!parsed.firebase[key]) {
      throw new Error(`Missing required Firebase field: "${key}".`);
    }
  }

  // Azure OpenAI config
  if (!parsed.azureOpenAI || typeof parsed.azureOpenAI !== 'object') {
    throw new Error('Missing "azureOpenAI" object in the secret.');
  }
  for (const key of REQUIRED_AZURE) {
    if (!parsed.azureOpenAI[key]) {
      throw new Error(`Missing required Azure OpenAI field: "${key}".`);
    }
  }

  return {
    firebase:    parsed.firebase,
    azureOpenAI: parsed.azureOpenAI,
  };
}

/**
 * Check if the username exists by reading users/{username} and verifying
 * that the document exists and has active === true.
 * @param {string} username
 * @returns {Promise<boolean>}
 */
async function userExistsInDb(username) {
  const db = firebase.firestore();
  const doc = await db.collection('users').doc(username).get();
  return doc.exists && doc.data().active === true;
}

/**
 * Perform the actual login sequence: init Firebase, verify user, save session.
 * @param {string} username
 * @param {Object} config  { firebase, azureOpenAI }
 * @param {Object} [ui]    Optional UI elements { errorEl, submitBtn } for inline feedback
 * @returns {Promise<boolean>} true if login succeeded
 */
async function performLogin(username, config, ui = {}) {
  const { errorEl, submitBtn } = ui;

  try {
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner"></span> Connecting…';
    }

    initFirebase(config.firebase);

    // Connectivity test
    const db = firebase.firestore();
    await db.collection('_ping').doc('test').get();

    // Check if user exists in DB
    const exists = await userExistsInDb(username);
    if (!exists) {
      if (errorEl) errorEl.textContent = `User "${username}" does not exist.`;
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign In';
      }
      // Remove bad credentials from localStorage
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      return false;
    }

    // Save session (sessionStorage — used by router guards)
    setSession({
      username:    username,
      azureOpenAI: config.azureOpenAI,
      firebase:    config.firebase,
    });

    // Persist credentials to localStorage for auto-login next time
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({
      username:  username,
      secret:    { firebase: config.firebase, azureOpenAI: config.azureOpenAI },
    }));

    showToast(`Welcome, ${username}!`, 'success');
    setTimeout(() => navigateTo('topics.html'), 400);
    return true;

  } catch (err) {
    console.error('Login error:', err);
    if (errorEl) errorEl.textContent = 'Could not connect to Firebase. Please check your config.';
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign In';
    }
    return false;
  }
}

/**
 * Initialise the login page.
 */
export async function initLoginPage() {
  // If already logged in (session exists), redirect to dashboard
  const existing = getSession();
  if (existing && existing.username) {
    navigateTo('topics.html');
    return;
  }

  const form      = document.getElementById('login-form');
  const errorEl   = document.getElementById('login-error');
  const submitBtn = document.getElementById('login-submit');

  if (!form) return;

  // --- AUTO-LOGIN from localStorage ---
  const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (saved) {
    try {
      const creds = JSON.parse(saved);
      if (creds.username && creds.secret) {
        // Show a loading state while auto-logging in
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner"></span> Signing in…';
        errorEl.textContent = '';

        const ok = await performLogin(creds.username, creds.secret, { errorEl, submitBtn });
        if (ok) return; // successfully auto-logged in
        // If auto-login failed (user removed from DB, etc.), fall through to manual form
      }
    } catch {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.textContent = '';

    const username  = document.getElementById('login-username').value.trim();
    const secretStr = document.getElementById('login-secret').value.trim();

    // Basic validation
    if (!username) {
      errorEl.textContent = 'Please enter a username.';
      return;
    }
    if (username.length < 2 || username.length > 40) {
      errorEl.textContent = 'Username must be 2–40 characters.';
      return;
    }
    if (!secretStr) {
      errorEl.textContent = 'Please enter your JSON secret.';
      return;
    }

    // Parse secret
    let config;
    try {
      config = parseSecret(secretStr);
    } catch (err) {
      errorEl.textContent = err.message;
      return;
    }

    // Perform login (init Firebase, check user in DB, save session + localStorage)
    await performLogin(username, config, { errorEl, submitBtn });
  });
}
