/* ============================================================
   FIREBASE INITIALIZATION MODULE
   Receives config from session, initialises Firebase app + Firestore.
   ============================================================ */

// Firebase SDK loaded via CDN <script> in HTML (compat mode for simplicity).
// Globals expected: firebase

import { getUsername } from './router.js';

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

// ----------------------------------------------------------------
// Notes CRUD (generic — supports writing, reading, practice, etc.)
// ----------------------------------------------------------------

function notesRef() {
  const db = getDb();
  const username = getUsername();
  return db.collection('users').doc(username).collection('notes');
}

/**
 * Save a note. Requires `source` (e.g. 'writing', 'reading', 'practice').
 */
export async function saveNote(note) {
  const doc = await notesRef().add({
    source: note.source || 'writing',
    original: note.original || '',
    corrected: note.corrected || '',
    explanation: note.explanation || '',
    type: note.type || 'grammar',
    topicId: note.topicId || '',
    savedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  return doc.id;
}

/**
 * Load notes, optionally filtered by source.
 * @param {string} [source] - e.g. 'writing', 'reading'. Omit to load all.
 */
export async function loadNotes(source) {
  const snap = await notesRef().orderBy('savedAt', 'desc').get();
  const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return source ? all.filter(n => n.source === source) : all;
}

export async function deleteNote(noteId) {
  await notesRef().doc(noteId).delete();
}
