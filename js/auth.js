/* ============================================================
   AUTH MODULE
   Parses login JSON secret, initialises Firebase, saves session.
   ============================================================ */

import { initFirebase } from './firebase.js';
import { setSession, navigateTo, getSession } from './router.js';
import { showToast } from './ui.js';
import { DEV_MODE, DEV_USERNAME, DEV_FIREBASE, DEV_AZURE_OPENAI } from './config.js';

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
 * Initialise the login page.
 */
export function initLoginPage() {
  // If already logged in, redirect to dashboard
  const existing = getSession();
  if (existing && existing.username) {
    navigateTo('topics.html');
    return;
  }

  const form      = document.getElementById('login-form');
  const errorEl   = document.getElementById('login-error');
  const submitBtn = document.getElementById('login-submit');

  if (!form) return;

  // --- DEV MODE: pre-fill form fields so you just click Sign In ---
  if (DEV_MODE) {
    const usernameInput = document.getElementById('login-username');
    const secretInput   = document.getElementById('login-secret');
    if (usernameInput) usernameInput.value = DEV_USERNAME;
    if (secretInput) {
      secretInput.value = JSON.stringify({
        firebase:    DEV_FIREBASE,
        azureOpenAI: DEV_AZURE_OPENAI,
      }, null, 2);
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

    // Init Firebase
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span> Connecting…';
    try {
      initFirebase(config.firebase);

      // Quick connectivity test — try reading a non-existent doc
      const db = firebase.firestore();
      await db.collection('_ping').doc('test').get();

      // Save session
      setSession({
        username:    username,
        azureOpenAI: config.azureOpenAI,
        firebase:    config.firebase,
      });

      showToast(`Welcome, ${username}!`, 'success');
      setTimeout(() => navigateTo('topics.html'), 400);

    } catch (err) {
      console.error('Firebase init error:', err);
      errorEl.textContent = 'Could not connect to Firebase. Please check your config.';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign In';
    }
  });
}
