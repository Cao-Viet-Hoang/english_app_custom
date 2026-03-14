/* ============================================================
   READING PAGE CONTROLLER
   Init, auth, data loading, mode switching, results, streak.
   ============================================================ */

import { guardAuth, logout, getQueryParam, navigateTo } from './router.js';
import { initFirebase } from './firebase.js';
import { getTopic } from './topics.js';
import { loadWords } from './vocabulary.js';
import { showToast, escapeHtml, showMilestoneModal } from './ui.js';
import { loadStreak, recordActivity, getMilestoneMessage } from './streak.js';
import {
  initComprehensionMode,
  initTrueFalseMode,
} from './reading-modes.js';

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

// ---- Utility ----
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---- Result builder ----
function buildResultHtml(correct, total) {
  const pct = Math.round((correct / total) * 100);
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
    <div class="result-score">${pct}%</div>
    <div class="result-label">${resultLabel}</div>
    <div class="result-details">
      <div class="result-detail-item">
        <div class="num green">${correct}</div>
        <div class="lbl">Correct</div>
      </div>
      <div class="result-detail-item">
        <div class="num red">${total - correct}</div>
        <div class="lbl">Wrong</div>
      </div>
    </div>
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
  const ctx = { shuffle, escapeHtml, buildResultHtml, showToast, topicId, handleStreakRecord };
  if (mode === 'comprehension') initComprehensionMode(allWords, ctx);
  else if (mode === 'truefalse') initTrueFalseMode(allWords, ctx);
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
