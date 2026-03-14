/* ============================================================
   WRITING PAGE CONTROLLER
   Init, auth, data loading, mode switching, results, streak.
   ============================================================ */

import { guardAuth, logout, getQueryParam, navigateTo } from './router.js';
import { initFirebase } from './firebase.js';
import { getTopic } from './topics.js';
import { loadWords } from './vocabulary.js';
import { showToast, escapeHtml, showMilestoneModal } from './ui.js';
import { loadStreak, recordActivity, getMilestoneMessage } from './streak.js';
import {
  initSentenceMode,
  initParagraphMode,
  initTranslationMode,
  initDictationMode,
} from './writing-modes.js';

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
const WORD_TYPE_LABELS = {
  noun: 'Noun', verb: 'Verb', adj: 'Adjective',
  adv: 'Adverb', phrase: 'Phrase', other: 'Other',
};

// ---- Utility ----
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---- TTS ----
const TTS_PREFERRED_VOICES = [
  'Google US English',
  'Microsoft Aria Online (Natural) - English (United States)',
  'Microsoft David - English (United States)',
  'Microsoft Zira - English (United States)',
  'Samantha',
];
let _ttsVoice = null;
let _ttsReady = false;

function _loadTTSVoice() {
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return;
  for (const name of TTS_PREFERRED_VOICES) {
    const v = voices.find(v => v.name === name);
    if (v) { _ttsVoice = v; _ttsReady = true; return; }
  }
  _ttsVoice = voices.find(v => v.lang === 'en-US') || null;
  _ttsReady = true;
}

_loadTTSVoice();
if ('speechSynthesis' in window) {
  window.speechSynthesis.addEventListener('voiceschanged', _loadTTSVoice);
}

function speakText(text, rate = 0.85) {
  if (!('speechSynthesis' in window)) return;
  function _doSpeak() {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.rate = rate;
    if (_ttsVoice) u.voice = _ttsVoice;
    window.speechSynthesis.speak(u);
  }
  if (_ttsReady) {
    _doSpeak();
  } else {
    window.speechSynthesis.addEventListener('voiceschanged', function _once() {
      window.speechSynthesis.removeEventListener('voiceschanged', _once);
      _loadTTSVoice();
      _doSpeak();
    });
    _loadTTSVoice();
    if (_ttsReady) _doSpeak();
  }
}

// ---- Result builder ----
function buildResultHtml(score, total, label) {
  const pct = Math.round((score / total) * 100);
  let iconClass, iconSvg, resultLabel;

  if (pct >= 80) {
    iconClass = 'great';
    iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
    resultLabel = 'Excellent!';
  } else if (pct >= 50) {
    iconClass = 'good';
    iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
    resultLabel = 'Good effort! Keep practicing.';
  } else {
    iconClass = 'needs-work';
    iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
    resultLabel = 'Keep going! Practice makes perfect.';
  }

  return `
    <div class="result-icon ${iconClass}">${iconSvg}</div>
    <div class="result-score">${label || pct + '%'}</div>
    <div class="result-label">${resultLabel}</div>
    <div class="result-actions">
      <button class="btn btn-primary" onclick="window._restartMode()">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
        Play Again
      </button>
      <a class="btn btn-ghost" href="topic-detail.html?topicId=${topicId}">Back to Topic</a>
    </div>
  `;
}

// ---- Streak helper ----
async function handleStreakRecord() {
  try {
    const { milestone } = await recordActivity();
    if (milestone) {
      const msg = getMilestoneMessage(milestone);
      await showMilestoneModal(msg);
    }
    // Refresh badge
    const data = await loadStreak(true);
    const el = document.getElementById('navbar-streak');
    const countEl = document.getElementById('navbar-streak-count');
    if (data.currentStreak > 0 || data.isActiveToday) {
      countEl.textContent = data.currentStreak;
      el.style.display = '';
    }
  } catch (err) {
    console.warn('Streak update failed:', err);
  }
}

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
  if (mode === 'sentence') initSentenceMode(allWords, { shuffle, escapeHtml, buildResultHtml, showToast, WORD_TYPE_LABELS, topicId, handleStreakRecord });
  else if (mode === 'paragraph') initParagraphMode(allWords, { shuffle, escapeHtml, buildResultHtml, showToast, WORD_TYPE_LABELS, topicId, handleStreakRecord });
  else if (mode === 'translation') initTranslationMode(allWords, { shuffle, escapeHtml, showToast, topicId, handleStreakRecord });
  else if (mode === 'dictation') initDictationMode(allWords, { shuffle, escapeHtml, buildResultHtml, showToast, speakText, topicId, handleStreakRecord });
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
