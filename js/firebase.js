/* ============================================================
   FIREBASE INITIALIZATION MODULE
   Receives config from session, initialises Firebase app + Firestore.
   ============================================================ */

// Firebase SDK loaded via CDN <script> in HTML (compat mode for simplicity).
// Globals expected: firebase

let _db = null;
let _app = null;

/**
 * Initialise Firebase with the provided config object.
 * Safe to call multiple times — only the first call has effect.
 * @param {Object} config  Firebase config { apiKey, authDomain, projectId, ... }
 * @returns {firebase.firestore.Firestore}
 */
export function initFirebase(config) {
  if (_db) return _db;

  if (!config || !config.apiKey || !config.projectId) {
    throw new Error('Invalid Firebase config: apiKey and projectId are required.');
  }

  // Provide sensible defaults for optional fields
  const fullConfig = {
    apiKey:            config.apiKey,
    authDomain:        config.authDomain        || `${config.projectId}.firebaseapp.com`,
    projectId:         config.projectId,
    storageBucket:     config.storageBucket      || `${config.projectId}.appspot.com`,
    messagingSenderId: config.messagingSenderId  || '',
    appId:             config.appId              || '',
  };

  // Avoid re-initialising if another script already did it
  if (!firebase.apps.length) {
    _app = firebase.initializeApp(fullConfig);
  } else {
    _app = firebase.app();
  }

  _db = firebase.firestore();
  return _db;
}

/**
 * Get the Firestore instance. Throws if not yet initialised.
 * @returns {firebase.firestore.Firestore}
 */
export function getDb() {
  if (!_db) {
    // Try to recover from sessionStorage
    const raw = sessionStorage.getItem('app_session');
    if (raw) {
      try {
        const session = JSON.parse(raw);
        if (session.firebase) {
          return initFirebase(session.firebase);
        }
      } catch { /* fall through */ }
    }
    throw new Error('Firestore has not been initialised. Please log in first.');
  }
  return _db;
}
