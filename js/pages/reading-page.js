/* ============================================================
   READING PAGE CONTROLLER
   Init, auth, data loading, mode switching, results, streak.
   ============================================================ */

import { guardAuth, logout, getQueryParam, navigateTo } from '../core/router.js';
import { initFirebase } from '../core/firebase.js';
import { getTopic } from '../features/topics.js';
import { loadWords } from '../features/vocabulary.js';
import { showToast, escapeHtml } from '../ui/index.js';
import { loadStreak } from '../features/streak.js';
import { initComprehensionMode } from './reading-modes/comprehension.js';
import { initTrueFalseMode } from './reading-modes/truefalse.js';
import { initChatWidget } from '../chat/chat-ui.js';

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
initChatWidget(() => ({ topic: _topicName, page: 'Reading', words: allWords }));

// ============================================================
// MODE SWITCHING
// ============================================================
let currentMode = 'comprehension';
const modeInitialized = {};

document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (allWords.length < 4) return;
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.practice-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    currentMode = btn.dataset.mode;
    document.getElementById(`panel-${currentMode}`).classList.add('active');
    if (!modeInitialized[currentMode]) {
      startMode(currentMode);
    }
  });
});

function startMode(mode) {
  modeInitialized[mode] = true;
  if (mode === 'comprehension') initComprehensionMode(allWords, topicId);
  else if (mode === 'truefalse') initTrueFalseMode(allWords, topicId);
}

window._restartMode = () => {
  modeInitialized[currentMode] = false;
  startMode(currentMode);
};

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

    const wordFilter = getQueryParam('words');
    if (wordFilter) {
      const ids = new Set(wordFilter.split(','));
      allWords = words.filter(w => ids.has(w.id));
    } else {
      allWords = words;
    }

    bcLink.textContent = topic.name;
    _topicName = topic.name;
    wordBadge.textContent = `${allWords.length} word${allWords.length !== 1 ? 's' : ''}`;
    practiceLoading.classList.add('hidden');

    if (allWords.length < 4) {
      practiceEmpty.classList.remove('hidden');
      document.querySelector('.mode-selector').style.display = 'none';
      return;
    }

    // Set back links
    const rcBack = document.getElementById('rc-btn-back');
    const tfBack = document.getElementById('tf-btn-back');
    if (rcBack) rcBack.href = `topic-detail.html?topicId=${topicId}`;
    if (tfBack) tfBack.href = `topic-detail.html?topicId=${topicId}`;

    document.getElementById('panel-comprehension').classList.add('active');
    startMode('comprehension');

  } catch (err) {
    console.error('Init error:', err);
    practiceLoading.classList.add('hidden');
    showToast('Failed to load data. ' + (err.message || ''), 'error');
  }
})();
