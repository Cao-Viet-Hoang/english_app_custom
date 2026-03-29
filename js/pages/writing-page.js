/* ============================================================
   WRITING PAGE CONTROLLER
   Init, auth, data loading, mode switching, results, streak.
   ============================================================ */

import { guardAuth, logout, getQueryParam, navigateTo } from '../core/router.js';
import { initFirebase, saveNote, loadNotes, deleteNote } from '../core/firebase.js';
import { getTopic } from '../features/topics.js';
import { loadWords } from '../features/vocabulary.js';
import { showToast, escapeHtml, showMilestoneModal, setupModalClose, showModal, closeModal } from '../ui/index.js';
import { loadStreak } from '../features/streak.js';
import { initSentenceMode } from './writing-modes/sentence.js';
import { initParagraphMode } from './writing-modes/paragraph.js';
import { initTranslationMode } from './writing-modes/translation.js';
import { initDictationMode } from './writing-modes/dictation.js';
import { ERROR_TYPE_LABELS } from '../ai/feedback-builder.js';
import { initChatWidget, sendToChat } from '../chat/chat-ui.js';

// ---- Auth & Firebase ----
const session = guardAuth();
initFirebase(session.firebase);

document.getElementById('nav-username').textContent = session.username;
document.getElementById('nav-avatar').textContent = session.username.charAt(0).toUpperCase();
document.getElementById('btn-logout').addEventListener('click', logout);

// ---- Navbar streak badge ----
loadStreak().then(data => {
  const el = document.getElementById('navbar-streak');
  const countEl = document.getElementById('navbar-streak-count');
  if (data.currentStreak > 0 || data.isActiveToday) {
    countEl.textContent = data.currentStreak;
    el.style.display = '';
  }
}).catch(() => {});

// ---- Topic ID from URL ----
const topicId = getQueryParam('topicId');
if (!topicId) {
  navigateTo('topics.html');
  throw new Error('No topicId');
}

const bcLink = document.getElementById('breadcrumb-topic-link');
bcLink.href = `topic-detail.html?topicId=${topicId}`;
document.getElementById('link-back-detail').href = `topic-detail.html?topicId=${topicId}`;

// ---- DOM Refs ----
const practiceLoading = document.getElementById('practice-loading');
const practiceEmpty = document.getElementById('practice-empty');
const wordBadge = document.getElementById('detail-word-badge');

// ---- State ----
let allWords = [];
let _topicName = '';

// ---- Chat widget (context read lazily when panel opens) ----
initChatWidget(() => ({ topic: _topicName, page: 'Writing', words: allWords }));

// ============================================================
// MODE SWITCHING
// ============================================================
let currentMode = 'sentence';
const MIN_WORDS_FOR_MODE = {
  sentence: 1,
  paragraph: 3,
  translation: 3,
  dictation: 1,
};

function updateModeAvailability() {
  document.querySelectorAll('.mode-btn').forEach(btn => {
    const mode = btn.dataset.mode;
    const min = MIN_WORDS_FOR_MODE[mode] || 1;
    if (allWords.length < min) {
      btn.classList.add('disabled');
      btn.title = `Requires at least ${min} words`;
    } else {
      btn.classList.remove('disabled');
      btn.title = '';
    }
  });
}

document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const mode = btn.dataset.mode;
    const min = MIN_WORDS_FOR_MODE[mode] || 1;
    if (allWords.length < min) return;

    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.practice-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    currentMode = mode;
    document.getElementById(`panel-${currentMode}`).classList.add('active');
    startMode(currentMode);
  });
});

function startMode(mode) {
  if (mode === 'sentence') initSentenceMode(allWords, topicId, _topicName);
  else if (mode === 'paragraph') initParagraphMode(allWords, topicId, _topicName);
  else if (mode === 'translation') initTranslationMode(allWords, topicId, _topicName);
  else if (mode === 'dictation') initDictationMode(allWords, topicId, _topicName);
}

window._restartMode = () => startMode(currentMode);

// ============================================================
// INIT — Load topic + words
// ============================================================
(async function init() {
  try {
    const [topic, words] = await Promise.all([
      getTopic(topicId),
      loadWords(topicId),
    ]);

    if (!topic) {
      navigateTo('topics.html');
      return;
    }

    // Filter words if query param provided
    const wordFilter = getQueryParam('words');
    if (wordFilter) {
      const ids = new Set(wordFilter.split(','));
      allWords = words.filter(w => ids.has(w.id));
    } else {
      allWords = words;
    }

    // Update UI
    bcLink.textContent = topic.name;
    _topicName = topic.name;
    wordBadge.textContent = `${allWords.length} word${allWords.length !== 1 ? 's' : ''}`;
    practiceLoading.classList.add('hidden');

    if (allWords.length < 1) {
      practiceEmpty.classList.remove('hidden');
      document.querySelector('.mode-selector').style.display = 'none';
      return;
    }

    updateModeAvailability();
    document.getElementById('panel-sentence').classList.add('active');
    startMode('sentence');

  } catch (err) {
    console.error('Init error:', err);
    practiceLoading.classList.add('hidden');
    showToast('Failed to load data. ' + (err.message || ''), 'error');
  }
})();

// ============================================================
// WRITING NOTES
// ============================================================

let _notesCache = null;

async function refreshNotesCount() {
  try {
    _notesCache = await loadNotes('writing');
    const badge = document.getElementById('notes-count-badge');
    if (_notesCache.length > 0) {
      badge.textContent = _notesCache.length;
      badge.style.display = '';
    } else {
      badge.style.display = 'none';
    }
  } catch { /* silent */ }
}

// SVG icons for save button states
const BOOKMARK_OUTLINE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>';
const BOOKMARK_FILLED = '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>';

// Delegate save-button clicks from error cards (toggle save/unsave)
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('.fb-error-save-btn');
  if (!btn || btn.dataset.busy === 'true') return;

  btn.dataset.busy = 'true';
  const isSaved = btn.classList.contains('saved');

  if (isSaved) {
    // --- Unsave: instantly untick, then delete from DB ---
    const noteId = btn.dataset.noteId;
    btn.classList.remove('saved');
    btn.innerHTML = BOOKMARK_OUTLINE;
    btn.title = 'Save to My Notes';

    try {
      await deleteNote(noteId);
      delete btn.dataset.noteId;
      showToast('Note removed', 'info');
      refreshNotesCount();
    } catch {
      // Revert on failure
      btn.classList.add('saved');
      btn.innerHTML = BOOKMARK_FILLED;
      btn.title = 'Saved!';
      showToast('Failed to remove note', 'error');
    }
  } else {
    // --- Save: instantly tick, then save to DB ---
    btn.classList.add('saved');
    btn.innerHTML = BOOKMARK_FILLED;
    btn.title = 'Saved!';

    const note = {
      source: 'writing',
      original: btn.dataset.original || '',
      corrected: btn.dataset.corrected || '',
      explanation: btn.dataset.explanation || '',
      type: btn.dataset.type || 'grammar',
      topicId: topicId,
    };

    try {
      const noteId = await saveNote(note);
      btn.dataset.noteId = noteId;
      showToast('Saved to My Notes', 'success');
      refreshNotesCount();
    } catch {
      // Revert on failure
      btn.classList.remove('saved');
      btn.innerHTML = BOOKMARK_OUTLINE;
      btn.title = 'Save to My Notes';
      showToast('Failed to save note', 'error');
    }
  }

  delete btn.dataset.busy;
});

// Delegate "Explain with AI" button clicks from error cards
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.fb-error-explain-btn');
  if (!btn) return;

  const original = btn.dataset.original || '';
  const corrected = btn.dataset.corrected || '';
  const explanation = btn.dataset.explanation || '';
  const type = ERROR_TYPE_LABELS[btn.dataset.type] || 'Error';

  const message = `Giải thích chi tiết lỗi "${type}" sau:\n` +
    `Sai: "${original}"\n` +
    `Đúng: "${corrected}"\n` +
    (explanation ? `Giải thích ngắn: ${explanation}\n` : '') +
    `\nHãy giải thích kỹ hơn tại sao cách viết này sai, quy tắc ngữ pháp liên quan, và cho thêm ví dụ minh họa.`;

  sendToChat(message);
});

// Notes modal
setupModalClose('#notes-modal');
document.getElementById('btn-open-notes').addEventListener('click', () => {
  showModal('#notes-modal');
  renderNotesModal();
});

async function renderNotesModal() {
  const body = document.getElementById('notes-modal-body');
  body.innerHTML = '<div class="text-center" style="padding:var(--sp-5)"><div class="spinner"></div></div>';

  try {
    _notesCache = await loadNotes('writing');
    if (_notesCache.length === 0) {
      body.innerHTML = `
        <div class="notes-empty">
          <p>No saved notes yet.</p>
          <p class="notes-empty-hint">Click the bookmark icon on error cards to save them here.</p>
        </div>`;
      return;
    }

    body.innerHTML = `
      <div class="notes-list">
        ${_notesCache.map(note => `
          <div class="note-card" data-note-id="${escapeHtml(note.id)}">
            <div class="note-card-header">
              <span class="fb-error-type fb-error-type--${escapeHtml(note.type || 'grammar')}">${escapeHtml(ERROR_TYPE_LABELS[note.type] || 'Error')}</span>
              <button class="note-delete-btn" data-note-id="${escapeHtml(note.id)}" title="Delete">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
            <div class="fb-error-diff">
              <div class="fb-error-wrong">
                <span class="fb-error-icon">&#10007;</span>
                <span>${escapeHtml(note.original || '')}</span>
              </div>
              <div class="fb-error-arrow">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg>
              </div>
              <div class="fb-error-right">
                <span class="fb-error-icon">&#10003;</span>
                <span>${escapeHtml(note.corrected || '')}</span>
              </div>
            </div>
            <div class="fb-error-explanation">${escapeHtml(note.explanation || '').replace(/\n/g, '<br>')}</div>
          </div>
        `).join('')}
      </div>`;

    // Update count badge
    const badge = document.getElementById('notes-count-badge');
    badge.textContent = _notesCache.length;
    badge.style.display = '';
  } catch (err) {
    body.innerHTML = '<p class="text-center" style="color:var(--color-danger)">Failed to load notes.</p>';
  }
}

// Delegate delete clicks inside notes modal
document.getElementById('notes-modal-body').addEventListener('click', async (e) => {
  const btn = e.target.closest('.note-delete-btn');
  if (!btn) return;

  const noteId = btn.dataset.noteId;
  const card = btn.closest('.note-card');

  btn.disabled = true;
  try {
    await deleteNote(noteId);
    card.style.opacity = '0';
    card.style.transform = 'translateX(20px)';
    card.style.transition = 'all 0.3s ease';
    setTimeout(() => {
      card.remove();
      refreshNotesCount();
      // Check if empty
      const list = document.querySelector('.notes-list');
      if (list && !list.children.length) {
        renderNotesModal();
      }
    }, 300);
    showToast('Note deleted', 'info');
  } catch (err) {
    btn.disabled = false;
    showToast('Failed to delete note', 'error');
  }
});

// Load initial count
refreshNotesCount();

// ---- Keyboard shortcuts ----
document.addEventListener('keydown', (e) => {
  // Ctrl+Enter => check (delegated to active mode)
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    const panel = document.querySelector('.practice-panel.active');
    if (!panel) return;
    const checkBtn = panel.querySelector('[id$="-btn-check"]:not([disabled])');
    if (checkBtn && checkBtn.offsetParent !== null) {
      checkBtn.click();
      return;
    }
    const nextBtn = panel.querySelector('[id$="-btn-next"]');
    if (nextBtn && nextBtn.offsetParent !== null) {
      nextBtn.click();
    }
  }
});
