/* ============================================================
   REVIEW PAGE CONTROLLER
   Global spaced-repetition review: a due-words dashboard plus a
   self-graded flashcard session (SM-2 ratings: Again/Hard/Good/Easy).
   ============================================================ */

import { initProtectedPage } from '../shared/page-init.js';
import { loadDueWords, getReviewStats, submitReview, getTodayDateString } from '../features/review.js';
import { RATING, scheduleReview } from '../features/srs-logic.js';
import { shuffle } from '../shared/shuffle.js';
import { speakText } from '../shared/tts.js';
import { buildResultHtml } from '../shared/result-builder.js';
import { handleStreakRecord } from '../shared/streak-handler.js';
import { showToast } from '../ui/index.js';
import { initChatWidget } from '../chat/chat-ui.js';

// ---- Bootstrap (auth, Firebase, navbar, streak badge) ----
initProtectedPage();

// ---- State ----
const today = getTodayDateString();
let dueWords = [];          // full due queue loaded on entry
let queue = [];             // shuffled session queue
let index = 0;              // current card index in the session
let sessionTotal = 0;       // cards in the current session
let passed = 0;             // cards rated Hard/Good/Easy (q >= 3)
let lapsed = 0;             // cards rated Again (q < 3)

// ---- Chat widget ----
initChatWidget(() => ({
  page: 'Review',
  words: dueWords.map((w) => ({ english: w.english || '', vietnamese: w.vietnamese || '' })),
}));

// ---- DOM refs ----
const loadingEl   = document.getElementById('rv-loading');
const contentEl   = document.getElementById('rv-content');
const dashboardEl = document.getElementById('rv-dashboard');
const startEl     = document.getElementById('rv-start');
const emptyEl     = document.getElementById('rv-empty');
const sessionEl   = document.getElementById('rv-session');
const resultsEl   = document.getElementById('rv-results');

const statDue      = document.getElementById('rv-stat-due');
const statTomorrow = document.getElementById('rv-stat-tomorrow');
const statUpcoming = document.getElementById('rv-stat-upcoming');
const statLearned  = document.getElementById('rv-stat-learned');
const startCount   = document.getElementById('rv-start-count');

const card         = document.getElementById('rv-card');
const speakBtn     = document.getElementById('rv-speak-btn');
const actionsEl    = document.getElementById('rv-actions');
const progressFill = document.getElementById('rv-progress-fill');
const progressText = document.getElementById('rv-progress-text');

const frontWord  = document.getElementById('rv-front-word');
const frontTopic = document.getElementById('rv-front-topic');
const backWord   = document.getElementById('rv-back-word');
const backType   = document.getElementById('rv-back-type');
const backIpa    = document.getElementById('rv-back-ipa');
const backMean   = document.getElementById('rv-back-meaning');
const backDesc   = document.getElementById('rv-back-desc');

const tipEls = {
  [RATING.AGAIN]: document.getElementById('rv-tip-again'),
  [RATING.HARD]:  document.getElementById('rv-tip-hard'),
  [RATING.GOOD]:  document.getElementById('rv-tip-good'),
  [RATING.EASY]:  document.getElementById('rv-tip-easy'),
};

// What each rating means; the concrete interval is appended per card.
const RATE_MEANING = {
  [RATING.AGAIN]: 'Forgot it — progress resets',
  [RATING.HARD]:  'Recalled with difficulty',
  [RATING.GOOD]:  'Recalled correctly',
  [RATING.EASY]:  'Recalled very easily',
};

/** Human-friendly interval, e.g. 1 → "tomorrow", 6 → "in 6 days". */
function formatInterval(days) {
  return days <= 1 ? 'tomorrow' : `in ${days} days`;
}

// ---- Initial load ----
loadDashboard();

async function loadDashboard() {
  try {
    const [due, stats] = await Promise.all([
      loadDueWords(today),
      getReviewStats(today),
    ]);
    dueWords = due;

    statDue.textContent      = String(due.length);
    statTomorrow.textContent = String(stats.dueTomorrow);
    statUpcoming.textContent = String(stats.upcoming7d);
    statLearned.textContent  = String(stats.learnedTotal);
    startCount.textContent   = String(due.length);

    startEl.classList.toggle('hidden', due.length === 0);
    emptyEl.classList.toggle('hidden', due.length !== 0);
  } catch (err) {
    console.error('Failed to load review data:', err);
    showToast('Failed to load review data.', 'error');
    emptyEl.classList.remove('hidden');
  } finally {
    loadingEl.classList.add('hidden');
    contentEl.classList.remove('hidden');
  }
}

// ---- Start session ----
document.getElementById('btn-start-review')?.addEventListener('click', () => {
  queue = shuffle([...dueWords]);
  index = 0;
  sessionTotal = queue.length;
  passed = 0;
  lapsed = 0;
  if (sessionTotal === 0) return;

  dashboardEl.classList.add('hidden');
  resultsEl.classList.add('hidden');
  sessionEl.classList.remove('hidden');
  document.addEventListener('keydown', onKeyDown);
  showCard();
});

// ---- Card interaction ----
card.addEventListener('click', () => flip());

speakBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  speakText(queue[index]?.english || '');
});

actionsEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.rv-rate');
  if (!btn) return;
  rate(btn.dataset.rating);
});

function onKeyDown(e) {
  if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
  if (e.code === 'Space' || e.code === 'Enter') {
    e.preventDefault();
    flip();
  } else if (card.classList.contains('flipped')) {
    const map = { Digit1: RATING.AGAIN, Digit2: RATING.HARD, Digit3: RATING.GOOD, Digit4: RATING.EASY };
    const rating = map[e.code];
    if (rating) {
      e.preventDefault();
      rate(rating);
    }
  }
}

function flip() {
  const flipped = card.classList.toggle('flipped');
  actionsEl.classList.toggle('hidden', !flipped);
}

function showCard() {
  card.classList.remove('flipped');
  actionsEl.classList.add('hidden');

  if (index >= queue.length) {
    finishSession();
    return;
  }

  const w = queue[index];
  frontWord.textContent = w.english || '';
  frontTopic.textContent = w.topicName || '';
  frontTopic.classList.toggle('hidden', !w.topicName);

  backWord.textContent = w.english || '';
  const type = (w.wordType || '').trim();
  backType.textContent = type;
  backType.classList.toggle('hidden', !type || type === 'other');
  backIpa.textContent = w.ipaUS || w.ipaUK || '';
  backMean.textContent = w.vietnamese || '';
  backDesc.textContent = w.description || '';

  // Update each rating tooltip with its meaning + the interval it would produce.
  const state = { interval: w.srsInterval, easeFactor: w.srsEaseFactor, repetitions: w.srsRepetitions };
  for (const rating of [RATING.AGAIN, RATING.HARD, RATING.GOOD, RATING.EASY]) {
    const tip = tipEls[rating];
    if (!tip) continue;
    const { interval } = scheduleReview(state, rating);
    tip.textContent = `${RATE_MEANING[rating]} · next review ${formatInterval(interval)}`;
  }

  const done = index;
  progressText.textContent = `${done} / ${sessionTotal}`;
  progressFill.style.width = `${Math.round((done / sessionTotal) * 100)}%`;
}

async function rate(rating) {
  if (!card.classList.contains('flipped')) return;
  const w = queue[index];
  if (!w) return;

  // Guard against double-submit while the write is in flight.
  setActionsDisabled(true);
  try {
    await submitReview(w, rating, today);
  } catch (err) {
    console.error('Failed to save review:', err);
    showToast('Failed to save your review. Try again.', 'error');
    setActionsDisabled(false);
    return;
  }
  setActionsDisabled(false);

  if (rating === RATING.AGAIN) lapsed++;
  else passed++;

  index++;
  showCard();
}

function setActionsDisabled(disabled) {
  actionsEl.querySelectorAll('.rv-rate').forEach((b) => { b.disabled = disabled; });
}

function finishSession() {
  document.removeEventListener('keydown', onKeyDown);
  sessionEl.classList.add('hidden');
  resultsEl.classList.remove('hidden');
  resultsEl.innerHTML = `
    <div class="practice-result">
      ${buildResultHtml(passed, sessionTotal, {
        backHref: 'topics.html',
        backLabel: 'Back to Topics',
        label: `${passed} / ${sessionTotal}`,
      })}
    </div>
  `;

  // Count the completed session as practice activity for the streak.
  if (sessionTotal > 0) handleStreakRecord('vocabulary');
}

// Restart hook used by the shared result screen's "Play Again" button.
window._restartMode = () => {
  resultsEl.classList.add('hidden');
  dashboardEl.classList.remove('hidden');
  loadingEl.classList.remove('hidden');
  contentEl.classList.add('hidden');
  loadDashboard();
};
