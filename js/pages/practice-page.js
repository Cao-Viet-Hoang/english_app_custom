/* ============================================================
   PRACTICE PAGE CONTROLLER
   Auth, 7 practice modes, mode switching, streak.
   ============================================================ */

import { guardAuth, logout, getQueryParam, navigateTo } from '../core/router.js';
import { initFirebase } from '../core/firebase.js';
import { getTopic } from '../features/topics.js';
import { loadWords } from '../features/vocabulary.js';
import { showToast, escapeHtml } from '../ui/index.js';
import { loadStreak } from '../features/streak.js';
import { initChatWidget } from '../chat/chat-ui.js';
import { shuffle } from '../shared/shuffle.js';
import { speakText } from '../shared/tts.js';
import { buildResultHtml } from '../shared/result-builder.js';
import { handleStreakRecord } from '../shared/streak-handler.js';

// ---- Auth & Firebase ----
const session = guardAuth();
initFirebase(session.firebase);

document.getElementById('nav-username').textContent = session.username;
document.getElementById('nav-avatar').textContent = session.username.charAt(0).toUpperCase();
document.getElementById('btn-logout').addEventListener('click', logout);

// ---- Chat widget ----
let chatPracticeWord = null;
let chatPracticeTopicName = '';
initChatWidget(() => ({
  word:       chatPracticeWord?.english    || null,
  wordType:   chatPracticeWord?.wordType   || null,
  vietnamese: chatPracticeWord?.vietnamese || null,
  topic:      chatPracticeTopicName,
  page:       'Practice',
  words:      allWords,
}));

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
const practiceEmpty   = document.getElementById('practice-empty');
const wordBadge       = document.getElementById('detail-word-badge');

// ---- State ----
let allWords = [];
const WORD_TYPE_LABELS = {
  noun: 'Noun', verb: 'Verb', adj: 'Adjective',
  adv: 'Adverb', phrase: 'Phrase', other: 'Other',
};

// ============================================================
// MODE SWITCHING
// ============================================================
let currentMode = 'flashcard';

document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (allWords.length < 4) return;
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.practice-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    currentMode = btn.dataset.mode;
    document.getElementById(`panel-${currentMode}`).classList.add('active');
    startMode(currentMode);
  });
});

function startMode(mode) {
  if (mode === 'flashcard') initFlashcard();
  else if (mode === 'quiz') initQuiz();
  else if (mode === 'matching') initMatching();
  else if (mode === 'listening') initListening();
  else if (mode === 'fillblank') initFillBlank();
  else if (mode === 'speedtype') initSpeedType();
  else if (mode === 'unscramble') initUnscramble();
}

// ============================================================
// FLASHCARD
// ============================================================
let fcWords = [], fcIndex = 0, fcKnown = 0, fcUnknown = 0;
let fcOriginalTotal = 0;
let fcRetryCount = new Map();
let fcDontKnowSet = new Set();
const FC_MAX_RETRY = 2;

const fcCard       = document.getElementById('fc-card');
const fcContainer  = document.getElementById('fc-container');
const fcResult     = document.getElementById('fc-result');
const fcFrontWord  = document.getElementById('fc-front-word');
const fcFrontIpa   = document.getElementById('fc-front-ipa');
const fcFrontType  = document.getElementById('fc-front-type');
const fcBackMeaning= document.getElementById('fc-back-meaning');
const fcBackDesc   = document.getElementById('fc-back-desc');
const fcCurrent    = document.getElementById('fc-current');
const fcTotal      = document.getElementById('fc-total');
const fcProgress   = document.getElementById('fc-progress');
const fcProgressTxt= document.getElementById('fc-progress-text');
const fcKnownEl    = document.getElementById('fc-known');
const fcUnknownEl  = document.getElementById('fc-unknown');
const fcSpeak      = document.getElementById('fc-speak');
const fcReviewBadge= document.getElementById('fc-review-badge');

function initFlashcard() {
  fcWords = shuffle(allWords);
  fcIndex = 0;
  fcKnown = 0;
  fcUnknown = 0;
  fcOriginalTotal = fcWords.length;
  fcRetryCount = new Map();
  fcDontKnowSet = new Set();
  fcContainer.classList.remove('hidden');
  fcResult.classList.add('hidden');
  showFlashcard();
}

function fcHandleKnow() {
  fcKnown++;
  fcIndex++;
  showFlashcard();
}

function fcHandleDontKnow() {
  const w = fcWords[fcIndex];
  const retries = fcRetryCount.get(w.id) || 0;
  fcDontKnowSet.add(w.id);

  if (retries < FC_MAX_RETRY) {
    fcWords.push(w);
    fcRetryCount.set(w.id, retries + 1);
  } else {
    fcUnknown++;
  }

  fcIndex++;
  showFlashcard();
}

function showFlashcard() {
  if (fcIndex >= fcWords.length) {
    fcUnknown = fcOriginalTotal - fcKnown;
    fcProgress.style.width = '100%';
    fcProgressTxt.textContent = '100%';

    fcContainer.classList.add('hidden');
    fcResult.classList.remove('hidden');
    fcResult.innerHTML = buildFlashcardResultHtml(fcKnown, fcOriginalTotal, fcDontKnowSet);

    const pct = Math.round((fcKnown / fcOriginalTotal) * 100);
    if (pct >= 50) handleStreakRecord();
    return;
  }

  const w = fcWords[fcIndex];
  chatPracticeWord = w;
  const isReview = fcRetryCount.has(w.id) && fcRetryCount.get(w.id) > 0;

  fcCard.classList.remove('flipped');
  fcFrontWord.textContent = w.english;
  fcFrontIpa.textContent = w.ipaUS || w.ipa || '';
  fcFrontType.textContent = WORD_TYPE_LABELS[w.wordType] || w.wordType || '';
  fcBackMeaning.textContent = w.vietnamese;
  fcBackDesc.textContent = w.description || '';

  if (isReview) {
    fcReviewBadge.classList.remove('hidden');
  } else {
    fcReviewBadge.classList.add('hidden');
  }

  fcCurrent.textContent = fcKnown + fcUnknown + 1;
  fcTotal.textContent = fcOriginalTotal;
  fcKnownEl.textContent = fcKnown;
  fcUnknownEl.textContent = fcUnknown;
  const pct = Math.round((fcKnown / fcOriginalTotal) * 100);
  fcProgress.style.width = pct + '%';
  fcProgressTxt.textContent = pct + '%';
}

function buildFlashcardResultHtml(correct, total, dontKnowSet) {
  let html = buildResultHtml(correct, total, { topicId });

  if (dontKnowSet.size > 0) {
    const reviewWords = allWords.filter(w => dontKnowSet.has(w.id));
    html += `
      <div class="fc-review-list">
        <h4 class="fc-review-list-title">Words to review</h4>
        <div class="fc-review-list-items">
          ${reviewWords.map(w => `
            <div class="fc-review-item">
              <span class="fc-review-item-word">${w.english}</span>
              <span class="fc-review-item-meaning">${w.vietnamese}</span>
            </div>
          `).join('')}
        </div>
      </div>`;
  }

  return html;
}

fcCard.addEventListener('click', (e) => {
  if (e.target.closest('.flashcard-speak-btn')) return;
  fcCard.classList.toggle('flipped');
});

fcSpeak.addEventListener('click', (e) => {
  e.stopPropagation();
  if (fcIndex < fcWords.length) speakText(fcWords[fcIndex].english);
});

document.getElementById('fc-btn-know').addEventListener('click', () => fcHandleKnow());

document.getElementById('fc-btn-dont-know').addEventListener('click', () => fcHandleDontKnow());

// Keyboard shortcuts for flashcard
document.addEventListener('keydown', (e) => {
  if (currentMode !== 'flashcard' || fcIndex >= fcWords.length) return;
  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault();
    fcCard.classList.toggle('flipped');
  }
  if (e.key === 'ArrowRight' || e.key === 'j') {
    fcHandleKnow();
  }
  if (e.key === 'ArrowLeft' || e.key === 'k') {
    fcHandleDontKnow();
  }
});

// ============================================================
// QUIZ
// ============================================================
let qzWords = [], qzIndex = 0, qzScore = 0, qzAnswered = false;
const qzContainer = document.getElementById('qz-container');
const qzResult    = document.getElementById('qz-result');
const qzWord      = document.getElementById('qz-word');
const qzIpa       = document.getElementById('qz-ipa');
const qzLabel     = document.getElementById('qz-label');
const qzOptions   = document.getElementById('qz-options');
const qzBtnNext   = document.getElementById('qz-btn-next');
const qzCurrent   = document.getElementById('qz-current');
const qzTotal     = document.getElementById('qz-total');
const qzScoreEl   = document.getElementById('qz-score');
const qzProgress  = document.getElementById('qz-progress');
const qzProgressTxt = document.getElementById('qz-progress-text');
const qzDirection = document.getElementById('quiz-direction');

function getDirection() {
  return qzDirection.value;
}

qzDirection.addEventListener('change', () => initQuiz());

function initQuiz() {
  qzWords = shuffle(allWords);
  qzIndex = 0;
  qzScore = 0;
  qzAnswered = false;
  qzContainer.classList.remove('hidden');
  qzResult.classList.add('hidden');
  showQuizQuestion();
}

function showQuizQuestion() {
  if (qzIndex >= qzWords.length) {
    qzProgress.style.width = '100%';
    qzProgressTxt.textContent = '100%';
    qzContainer.classList.add('hidden');
    qzResult.classList.remove('hidden');
    qzResult.innerHTML = buildResultHtml(qzScore, qzWords.length, { topicId });

    const pct = Math.round((qzScore / qzWords.length) * 100);
    if (pct >= 50) handleStreakRecord();
    return;
  }

  qzAnswered = false;
  qzBtnNext.disabled = true;
  const dir = getDirection();
  const w = qzWords[qzIndex];

  if (dir === 'en-vi') {
    qzLabel.textContent = 'What does this word mean?';
    qzWord.textContent = w.english;
    qzIpa.textContent = w.ipaUS || w.ipa || '';
  } else {
    qzLabel.textContent = 'Which English word matches?';
    qzWord.textContent = w.vietnamese;
    qzIpa.textContent = '';
  }

  const others = allWords.filter(x => x.id !== w.id);
  const wrongPicks = shuffle(others).slice(0, 3);
  const options = shuffle([w, ...wrongPicks]);

  const keys = ['A', 'B', 'C', 'D'];
  qzOptions.innerHTML = options.map((opt, i) => {
    const text = dir === 'en-vi' ? opt.vietnamese : opt.english;
    return `
      <button class="quiz-option" data-id="${opt.id}">
        <span class="option-key">${keys[i]}</span>
        <span>${escapeHtml(text)}</span>
      </button>
    `;
  }).join('');

  qzCurrent.textContent = qzIndex + 1;
  qzTotal.textContent = qzWords.length;
  qzScoreEl.textContent = qzScore;
  const pct = Math.round((qzIndex / qzWords.length) * 100);
  qzProgress.style.width = pct + '%';
  qzProgressTxt.textContent = pct + '%';
}

qzOptions.addEventListener('click', (e) => {
  const btn = e.target.closest('.quiz-option');
  if (!btn || qzAnswered) return;
  qzAnswered = true;

  const selectedId = btn.dataset.id;
  const correctId = qzWords[qzIndex].id;
  const isCorrect = selectedId === correctId;

  if (isCorrect) {
    btn.classList.add('correct');
    qzScore++;
    qzScoreEl.textContent = qzScore;
  } else {
    btn.classList.add('wrong');
    qzOptions.querySelector(`[data-id="${correctId}"]`).classList.add('correct');
  }

  qzOptions.querySelectorAll('.quiz-option').forEach(o => o.classList.add('disabled'));
  qzBtnNext.disabled = false;
});

qzBtnNext.addEventListener('click', () => {
  qzIndex++;
  showQuizQuestion();
});

// Keyboard shortcuts for quiz
document.addEventListener('keydown', (e) => {
  if (currentMode !== 'quiz') return;
  if (qzIndex >= qzWords.length) return;

  const keyMap = { '1': 0, '2': 1, '3': 2, '4': 3, 'a': 0, 'b': 1, 'c': 2, 'd': 3 };
  const idx = keyMap[e.key.toLowerCase()];

  if (!qzAnswered && idx !== undefined) {
    const btns = qzOptions.querySelectorAll('.quiz-option');
    if (btns[idx]) btns[idx].click();
  }

  if (qzAnswered && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault();
    qzBtnNext.click();
  }
});

// ============================================================
// MATCHING
// ============================================================
let mtMatchCount = 6;
let mtWords = [], mtSelected = null, mtMatched = 0, mtAttempts = 0;
const mtContainer = document.getElementById('mt-container');
const mtResult    = document.getElementById('mt-result');
const mtColEn     = document.getElementById('mt-col-en');
const mtColVi     = document.getElementById('mt-col-vi');
const mtMatchedEl = document.getElementById('mt-matched');
const mtTotalEl   = document.getElementById('mt-total');
const mtAttemptsEl= document.getElementById('mt-attempts');
const mtProgress  = document.getElementById('mt-progress');
const mtCountOpts = document.getElementById('mt-count-options');

// Count selector
mtCountOpts.addEventListener('click', (e) => {
  const btn = e.target.closest('.mt-count-btn');
  if (!btn || btn.classList.contains('disabled')) return;
  mtCountOpts.querySelectorAll('.mt-count-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  mtMatchCount = btn.dataset.count === 'all' ? Infinity : Number(btn.dataset.count);
  initMatching();
});

function updateCountBtnStates() {
  mtCountOpts.querySelectorAll('.mt-count-btn').forEach(btn => {
    const val = btn.dataset.count === 'all' ? 0 : Number(btn.dataset.count);
    btn.classList.toggle('disabled', val > allWords.length && val !== 0);
  });
}

function initMatching() {
  updateCountBtnStates();
  const count = Math.min(mtMatchCount, allWords.length);
  mtWords = shuffle(allWords).slice(0, count);
  mtMatched = 0;
  mtAttempts = 0;
  mtSelected = null;
  mtContainer.classList.remove('hidden');
  mtResult.classList.add('hidden');

  mtTotalEl.textContent = count;
  mtMatchedEl.textContent = 0;
  mtAttemptsEl.textContent = 0;
  mtProgress.style.width = '0%';

  const enOrder = shuffle(mtWords);
  const viOrder = shuffle(mtWords);

  mtColEn.innerHTML = enOrder.map(w =>
    `<div class="match-card" data-id="${w.id}" data-lang="en">${escapeHtml(w.english)}</div>`
  ).join('');

  mtColVi.innerHTML = viOrder.map(w =>
    `<div class="match-card" data-id="${w.id}" data-lang="vi">${escapeHtml(w.vietnamese)}</div>`
  ).join('');
}

function handleMatchClick(card) {
  if (card.classList.contains('matched') || card.classList.contains('disabled')) return;

  const lang = card.dataset.lang;
  const id = card.dataset.id;

  if (!mtSelected) {
    mtSelected = { card, lang, id };
    card.classList.add('selected');
    return;
  }

  if (mtSelected.lang === lang) {
    mtSelected.card.classList.remove('selected');
    mtSelected = { card, lang, id };
    card.classList.add('selected');
    return;
  }

  mtAttempts++;
  mtAttemptsEl.textContent = mtAttempts;

  if (mtSelected.id === id) {
    card.classList.add('matched');
    mtSelected.card.classList.remove('selected');
    mtSelected.card.classList.add('matched');
    mtMatched++;
    mtMatchedEl.textContent = mtMatched;
    mtProgress.style.width = Math.round((mtMatched / mtWords.length) * 100) + '%';

    mtSelected = null;

    if (mtMatched >= mtWords.length) {
      setTimeout(() => {
        mtContainer.classList.add('hidden');
        mtResult.classList.remove('hidden');
        const optimal = mtWords.length;
        const efficiency = Math.max(0, Math.round((optimal / mtAttempts) * 100));
        const score = Math.min(mtWords.length, Math.round(mtWords.length * (efficiency / 100)));
        mtResult.innerHTML = buildResultHtml(score, mtWords.length, { topicId });
        if (efficiency >= 50) handleStreakRecord();
      }, 500);
    }
  } else {
    card.classList.add('wrong-flash');
    mtSelected.card.classList.remove('selected');
    mtSelected.card.classList.add('wrong-flash');

    const prevCard = mtSelected.card;
    setTimeout(() => {
      card.classList.remove('wrong-flash');
      prevCard.classList.remove('wrong-flash');
    }, 500);

    mtSelected = null;
  }
}

mtColEn.addEventListener('click', (e) => {
  const card = e.target.closest('.match-card');
  if (card) handleMatchClick(card);
});

mtColVi.addEventListener('click', (e) => {
  const card = e.target.closest('.match-card');
  if (card) handleMatchClick(card);
});

// ============================================================
// LISTENING
// ============================================================
let lsWords = [], lsIndex = 0, lsScore = 0, lsAnswered = false;
let lsSubMode = 'choose'; // 'choose' or 'type'
const lsContainer   = document.getElementById('ls-container');
const lsResult      = document.getElementById('ls-result');
const lsOptions     = document.getElementById('ls-options');
const lsBtnNext     = document.getElementById('ls-btn-next');
const lsCurrent     = document.getElementById('ls-current');
const lsTotal       = document.getElementById('ls-total');
const lsScoreEl     = document.getElementById('ls-score');
const lsProgress    = document.getElementById('ls-progress');
const lsProgressTxt = document.getElementById('ls-progress-text');
const lsPlayBtn     = document.getElementById('ls-play-btn');
const lsAnswerType  = document.getElementById('listen-answer-type');
const lsPromptLabel = document.getElementById('ls-prompt-label');
const lsChooseOpts  = document.getElementById('ls-choose-options');
const lsTypeArea    = document.getElementById('ls-type-area');
const lsTypeInput   = document.getElementById('ls-type-input');
const lsLetterHint  = document.getElementById('ls-letter-hint');
const lsTypeFeedback = document.getElementById('ls-type-feedback');

// Sub-mode toggle
document.querySelectorAll('.ls-submode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.ls-submode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    lsSubMode = btn.dataset.submode;

    if (lsSubMode === 'choose') {
      lsChooseOpts.classList.remove('hidden');
      lsPromptLabel.textContent = 'Listen and choose the correct answer';
    } else {
      lsChooseOpts.classList.add('hidden');
      lsPromptLabel.textContent = 'Listen and type the English word';
    }

    initListening();
  });
});

lsAnswerType.addEventListener('change', () => initListening());

function initListening() {
  lsWords = shuffle(allWords);
  lsIndex = 0;
  lsScore = 0;
  lsAnswered = false;
  lsContainer.classList.remove('hidden');
  lsResult.classList.add('hidden');

  if (lsSubMode === 'choose') {
    lsOptions.classList.remove('hidden');
    lsTypeArea.classList.add('hidden');
  } else {
    lsOptions.classList.add('hidden');
    lsTypeArea.classList.remove('hidden');
  }

  showListeningQuestion();
}

function showListeningQuestion() {
  if (lsIndex >= lsWords.length) {
    lsProgress.style.width = '100%';
    lsProgressTxt.textContent = '100%';
    lsContainer.classList.add('hidden');
    lsResult.classList.remove('hidden');
    lsResult.innerHTML = buildResultHtml(lsScore, lsWords.length, { topicId });

    const pct = Math.round((lsScore / lsWords.length) * 100);
    if (pct >= 50) handleStreakRecord();
    return;
  }

  lsAnswered = false;
  lsBtnNext.disabled = true;
  const w = lsWords[lsIndex];

  speakText(w.english);

  if (lsSubMode === 'choose') {
    const ansType = lsAnswerType.value;
    const others = allWords.filter(x => x.id !== w.id);
    const wrongPicks = shuffle(others).slice(0, 3);
    const options = shuffle([w, ...wrongPicks]);

    const keys = ['A', 'B', 'C', 'D'];
    lsOptions.innerHTML = options.map((opt, i) => {
      const text = ansType === 'vi' ? opt.vietnamese : opt.english;
      return `
        <button class="quiz-option" data-id="${opt.id}">
          <span class="option-key">${keys[i]}</span>
          <span>${escapeHtml(text)}</span>
        </button>
      `;
    }).join('');
  } else {
    lsTypeInput.value = '';
    lsTypeInput.disabled = false;
    lsTypeInput.classList.remove('ls-input-correct', 'ls-input-wrong');
    lsTypeFeedback.classList.add('hidden');
    lsTypeFeedback.textContent = '';
    const eng = w.english;
    lsLetterHint.textContent = `${eng.length} letter${eng.length !== 1 ? 's' : ''} \u2014 starts with \u201c${eng.charAt(0)}\u201d`;
    setTimeout(() => lsTypeInput.focus(), 100);
  }

  lsCurrent.textContent = lsIndex + 1;
  lsTotal.textContent = lsWords.length;
  lsScoreEl.textContent = lsScore;
  const pct = Math.round((lsIndex / lsWords.length) * 100);
  lsProgress.style.width = pct + '%';
  lsProgressTxt.textContent = pct + '%';
}

lsPlayBtn.addEventListener('click', () => {
  if (lsIndex < lsWords.length) speakText(lsWords[lsIndex].english);
});

// Choose mode: option click
lsOptions.addEventListener('click', (e) => {
  const btn = e.target.closest('.quiz-option');
  if (!btn || lsAnswered) return;
  lsAnswered = true;

  const selectedId = btn.dataset.id;
  const correctId = lsWords[lsIndex].id;
  const isCorrect = selectedId === correctId;

  if (isCorrect) {
    btn.classList.add('correct');
    lsScore++;
    lsScoreEl.textContent = lsScore;
  } else {
    btn.classList.add('wrong');
    lsOptions.querySelector(`[data-id="${correctId}"]`).classList.add('correct');
  }

  lsOptions.querySelectorAll('.quiz-option').forEach(o => o.classList.add('disabled'));
  lsBtnNext.disabled = false;
});

// Type mode: check answer
function lsCheckTyping() {
  if (lsAnswered) return;
  lsAnswered = true;

  const w = lsWords[lsIndex];
  const userAnswer = lsTypeInput.value.trim();
  const isCorrect = userAnswer.toLowerCase() === w.english.toLowerCase();

  lsTypeInput.disabled = true;

  if (isCorrect) {
    lsScore++;
    lsScoreEl.textContent = lsScore;
    lsTypeInput.classList.add('ls-input-correct');
    lsTypeFeedback.className = 'ls-type-feedback ls-feedback-correct';
    lsTypeFeedback.textContent = 'Correct!';
  } else {
    lsTypeInput.classList.add('ls-input-wrong');
    lsTypeFeedback.className = 'ls-type-feedback ls-feedback-wrong';
    lsTypeFeedback.innerHTML = `<span class="ls-feedback-your">Your answer: <strong>${escapeHtml(userAnswer || '(empty)')}</strong></span><span class="ls-feedback-correct-answer">Correct: <strong>${escapeHtml(w.english)}</strong></span>`;
  }

  lsTypeFeedback.classList.remove('hidden');
  lsBtnNext.disabled = false;
  setTimeout(() => lsBtnNext.focus(), 150);
}

lsTypeInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    e.stopPropagation();
    if (!lsAnswered) lsCheckTyping();
    else lsBtnNext.click();
  }
});

lsBtnNext.addEventListener('click', () => {
  lsIndex++;
  showListeningQuestion();
});

// Keyboard shortcuts for listening
document.addEventListener('keydown', (e) => {
  if (currentMode !== 'listening') return;
  if (lsIndex >= lsWords.length) return;

  // Don't intercept keys when typing in the input
  if (lsSubMode === 'type' && document.activeElement === lsTypeInput && !lsAnswered) return;

  // R to replay audio
  if (e.key.toLowerCase() === 'r') {
    speakText(lsWords[lsIndex].english);
    return;
  }

  // Choose mode shortcuts (1-4, A-D)
  if (lsSubMode === 'choose') {
    const keyMap = { '1': 0, '2': 1, '3': 2, '4': 3, 'a': 0, 'b': 1, 'c': 2, 'd': 3 };
    const idx = keyMap[e.key.toLowerCase()];

    if (!lsAnswered && idx !== undefined) {
      const btns = lsOptions.querySelectorAll('.quiz-option');
      if (btns[idx]) btns[idx].click();
    }
  }

  if (lsAnswered && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault();
    lsBtnNext.click();
  }
});

// ============================================================
// FILL IN THE BLANK
// ============================================================
let fbWords = [], fbIndex = 0, fbScore = 0, fbAnswered = false;
const fbContainer = document.getElementById('fb-container');
const fbResult    = document.getElementById('fb-result');
const fbWordEl    = document.getElementById('fb-word');
const fbVietnamese= document.getElementById('fb-vietnamese');
const fbBtnCheck  = document.getElementById('fb-btn-check');
const fbBtnNext   = document.getElementById('fb-btn-next');
const fbFeedback  = document.getElementById('fb-feedback');
const fbCurrent   = document.getElementById('fb-current');
const fbTotal     = document.getElementById('fb-total');
const fbScoreEl   = document.getElementById('fb-score');
const fbProgress  = document.getElementById('fb-progress');
const fbProgressTxt = document.getElementById('fb-progress-text');

function initFillBlank() {
  fbWords = shuffle(allWords);
  fbIndex = 0;
  fbScore = 0;
  fbAnswered = false;
  fbContainer.classList.remove('hidden');
  fbResult.classList.add('hidden');
  showFillBlank();
}

function generateBlanks(word) {
  const tokens = word.split('');
  const letterIndices = [];
  tokens.forEach((ch, i) => {
    if (ch !== ' ') letterIndices.push(i);
  });

  const blankCount = Math.max(1, Math.round(letterIndices.length * 0.4));
  const blankedPositions = new Set();
  const shuffledIndices = shuffle(letterIndices);
  for (let i = 0; i < blankCount; i++) {
    blankedPositions.add(shuffledIndices[i]);
  }

  let html = '';
  tokens.forEach((ch, i) => {
    if (ch === ' ') {
      html += '<span class="fb-space">&nbsp;</span>';
    } else if (blankedPositions.has(i)) {
      html += `<input type="text" class="fb-char-input" data-answer="${ch.toLowerCase()}" maxlength="1" autocomplete="off" spellcheck="false" />`;
    } else {
      html += `<span class="fb-char">${ch}</span>`;
    }
  });
  return html;
}

function showFillBlank() {
  if (fbIndex >= fbWords.length) {
    fbProgress.style.width = '100%';
    fbProgressTxt.textContent = '100%';
    fbContainer.classList.add('hidden');
    fbResult.classList.remove('hidden');
    fbResult.innerHTML = buildResultHtml(fbScore, fbWords.length, { topicId });

    const pct = Math.round((fbScore / fbWords.length) * 100);
    if (pct >= 50) handleStreakRecord();
    return;
  }

  fbAnswered = false;
  fbBtnCheck.disabled = false;
  fbBtnNext.disabled = true;
  fbFeedback.classList.add('hidden');
  fbFeedback.textContent = '';

  const w = fbWords[fbIndex];
  fbVietnamese.textContent = w.vietnamese;
  const fbWordType = document.getElementById('fb-word-type');
  fbWordType.textContent = WORD_TYPE_LABELS[w.wordType] || w.wordType || '';
  fbWordType.style.display = fbWordType.textContent ? '' : 'none';
  fbWordEl.innerHTML = generateBlanks(w.english);

  fbCurrent.textContent = fbIndex + 1;
  fbTotal.textContent = fbWords.length;
  fbScoreEl.textContent = fbScore;
  const pct = Math.round((fbIndex / fbWords.length) * 100);
  fbProgress.style.width = pct + '%';
  fbProgressTxt.textContent = pct + '%';

  const firstInput = fbWordEl.querySelector('.fb-char-input');
  if (firstInput) firstInput.focus();
}

// Auto-advance to next input on typing
fbWordEl.addEventListener('input', (e) => {
  if (e.target.classList.contains('fb-char-input') && e.target.value.length === 1) {
    const inputs = [...fbWordEl.querySelectorAll('.fb-char-input')];
    const idx = inputs.indexOf(e.target);
    if (idx < inputs.length - 1) inputs[idx + 1].focus();
  }
});

// Allow backspace to go to previous input
fbWordEl.addEventListener('keydown', (e) => {
  if (e.target.classList.contains('fb-char-input')) {
    if (e.key === 'Backspace' && e.target.value === '') {
      const inputs = [...fbWordEl.querySelectorAll('.fb-char-input')];
      const idx = inputs.indexOf(e.target);
      if (idx > 0) {
        inputs[idx - 1].focus();
        inputs[idx - 1].value = '';
      }
    }
    if (e.key === 'Enter') {
      if (!fbAnswered) {
        fbCheckAnswer();
        e.preventDefault();
      } else {
        fbIndex++; showFillBlank();
      }
    }
  }
});

function fbCheckAnswer() {
  if (fbAnswered) return;
  fbAnswered = true;
  const inputs = fbWordEl.querySelectorAll('.fb-char-input');
  let allCorrect = true;

  inputs.forEach(inp => {
    const answer = inp.dataset.answer;
    const val = inp.value.toLowerCase();
    inp.disabled = true;
    if (val === answer) {
      inp.classList.add('correct');
    } else {
      inp.classList.add('wrong');
      const wrapper = document.createElement('span');
      wrapper.classList.add('fb-wrong-wrapper');
      wrapper.setAttribute('data-correct', answer);
      inp.parentNode.insertBefore(wrapper, inp);
      wrapper.appendChild(inp);
      allCorrect = false;
    }
  });

  if (allCorrect) {
    fbScore++;
    fbScoreEl.textContent = fbScore;
    fbFeedback.textContent = 'Correct!';
    fbFeedback.className = 'fillblank-feedback fb-correct';
  } else {
    fbFeedback.textContent = `Answer: ${fbWords[fbIndex].english}`;
    fbFeedback.className = 'fillblank-feedback fb-wrong';
  }
  fbFeedback.classList.remove('hidden');
  fbBtnCheck.disabled = true;
  fbBtnNext.disabled = false;
  setTimeout(() => fbBtnNext.focus(), 150);
}

fbBtnCheck.addEventListener('click', fbCheckAnswer);
fbBtnNext.addEventListener('click', () => { fbIndex++; showFillBlank(); });

// ============================================================
// SPEED TYPING
// ============================================================
let stWords = [], stIndex = 0, stScore = 0, stTimer = null, stTimeLeft = 60, stTotalAttempted = 0;
let stNoTimer = false, stElapsedTime = 0, stElapsedTimer = null;
let stRevealed = 0;
const ST_REVEAL_PENALTY = 5; // seconds
const stContainer  = document.getElementById('st-container');
const stResult     = document.getElementById('st-result');
const stInput      = document.getElementById('st-input');
const stVietnamese = document.getElementById('st-vietnamese');
const stEnglishHint= document.getElementById('st-english-hint');
const stTimerEl    = document.getElementById('st-timer');
const stTimerStat  = document.getElementById('st-timer-stat');
const stProgressStat = document.getElementById('st-progress-stat');
const stScoreEl    = document.getElementById('st-score');
const stTotalEl    = document.getElementById('st-total');
const stProgressEl = document.getElementById('st-progress');
const stStartOverlay = document.getElementById('st-start-overlay');
const stBtnStart   = document.getElementById('st-btn-start');
const stTimeSelect = document.getElementById('st-time-select');
const stStopWrapper = document.getElementById('st-stop-wrapper');
const stBtnStop    = document.getElementById('st-btn-stop');
const stBtnReveal  = document.getElementById('st-btn-reveal');
const stRevealRow  = document.getElementById('st-reveal-row');

function initSpeedType() {
  stWords = shuffle(allWords);
  stIndex = 0;
  stScore = 0;
  stTotalAttempted = 0;
  if (stTimer) clearInterval(stTimer);
  if (stElapsedTimer) clearInterval(stElapsedTimer);
  stTimer = null;
  stElapsedTimer = null;
  stElapsedTime = 0;
  stRevealed = 0;
  stNoTimer = parseInt(stTimeSelect.value) === 0;
  stContainer.classList.remove('hidden');
  stResult.classList.add('hidden');
  stStartOverlay.classList.remove('hidden');
  stStopWrapper.classList.add('hidden');
  stRevealRow.classList.add('hidden');
  stInput.value = '';
  stInput.disabled = true;

  if (stNoTimer) {
    stTimerStat.innerHTML = 'Time: <strong id="st-timer">∞</strong>';
    stProgressStat.style.display = 'none';
  } else {
    stTimeLeft = parseInt(stTimeSelect.value);
    stTimerStat.innerHTML = 'Time: <strong id="st-timer">' + stTimeLeft + '</strong>s';
    stProgressStat.style.display = '';
    stProgressEl.style.width = '100%';
  }

  stScoreEl.textContent = '0';
  stTotalEl.textContent = '0';
  stTimerEl.style.color = '';
  showSpeedTypeWord();
}

function showSpeedTypeWord() {
  if (stIndex >= stWords.length) { stWords = shuffle(stWords); stIndex = 0; }
  const w = stWords[stIndex];
  stVietnamese.textContent = w.vietnamese;
  const eng = w.english;
  stEnglishHint.textContent = `${eng.length} letters — starts with "${eng.charAt(0)}"`;
}

function stRevealWord() {
  if (!stTimer) return;
  const w = stWords[stIndex];

  // Apply time penalty
  if (stNoTimer) {
    stElapsedTime += ST_REVEAL_PENALTY;
  } else {
    stTimeLeft = Math.max(0, stTimeLeft - ST_REVEAL_PENALTY);
    document.getElementById('st-timer').textContent = stTimeLeft;
    const totalTime = parseInt(stTimeSelect.value);
    stProgressEl.style.width = Math.round((stTimeLeft / totalTime) * 100) + '%';
    if (stTimeLeft <= 10) {
      document.getElementById('st-timer').style.color = 'var(--color-danger)';
    }
    if (stTimeLeft <= 0) {
      clearInterval(stTimer);
      stTimer = null;
      stInput.disabled = true;
      stRevealRow.classList.add('hidden');
      stContainer.classList.add('hidden');
      stResult.classList.remove('hidden');
      stResult.innerHTML = buildSpeedTypeResultHtml(stScore, stTotalAttempted, totalTime);
      return;
    }
  }

  // Pause timer while showing answer
  if (!stNoTimer) {
    clearInterval(stTimer);
  } else if (stElapsedTimer) {
    clearInterval(stElapsedTimer);
  }

  // Show answer, count as wrong + revealed
  stRevealed++;
  stTotalAttempted++;
  stTotalEl.textContent = stTotalAttempted;
  stInput.value = w.english;
  stInput.disabled = true;
  stInput.classList.add('st-flash-reveal');

  setTimeout(() => {
    stInput.classList.remove('st-flash-reveal');
    stInput.value = '';
    stInput.disabled = false;
    stInput.focus();
    stIndex++;
    showSpeedTypeWord();

    // Resume timer
    if (!stNoTimer) {
      const totalTime = parseInt(stTimeSelect.value);
      stTimer = setInterval(() => {
        stTimeLeft--;
        document.getElementById('st-timer').textContent = stTimeLeft;
        stProgressEl.style.width = Math.round((stTimeLeft / totalTime) * 100) + '%';
        if (stTimeLeft <= 10) {
          document.getElementById('st-timer').style.color = 'var(--color-danger)';
        }
        if (stTimeLeft <= 0) {
          clearInterval(stTimer);
          stTimer = null;
          stInput.disabled = true;
          stRevealRow.classList.add('hidden');
          stContainer.classList.add('hidden');
          stResult.classList.remove('hidden');
          stResult.innerHTML = buildSpeedTypeResultHtml(stScore, stTotalAttempted, totalTime);
          document.getElementById('st-timer').style.color = '';
        }
      }, 1000);
    } else {
      stElapsedTimer = setInterval(() => {
        stElapsedTime++;
      }, 1000);
    }
  }, 1200);
}

function startSpeedTypeTimer() {
  stStartOverlay.classList.add('hidden');
  stRevealRow.classList.remove('hidden');
  stInput.disabled = false;
  stInput.focus();

  if (stNoTimer) {
    stElapsedTime = 0;
    stStopWrapper.classList.remove('hidden');
    const timerRef = document.getElementById('st-timer');
    stElapsedTimer = setInterval(() => {
      stElapsedTime++;
    }, 1000);
    stTimer = true;
    return;
  }

  const totalTime = stTimeLeft;

  stTimer = setInterval(() => {
    stTimeLeft--;
    document.getElementById('st-timer').textContent = stTimeLeft;
    stProgressEl.style.width = Math.round((stTimeLeft / totalTime) * 100) + '%';

    if (stTimeLeft <= 10) {
      document.getElementById('st-timer').style.color = 'var(--color-danger)';
    }

    if (stTimeLeft <= 0) {
      clearInterval(stTimer);
      stTimer = null;
      stInput.disabled = true;
      stRevealRow.classList.add('hidden');
      stContainer.classList.add('hidden');
      stResult.classList.remove('hidden');
      stResult.innerHTML = buildSpeedTypeResultHtml(stScore, stTotalAttempted, totalTime);
      document.getElementById('st-timer').style.color = '';
    }
  }, 1000);
}

function finishSpeedTypeNoTimer() {
  if (stElapsedTimer) clearInterval(stElapsedTimer);
  stElapsedTimer = null;
  stTimer = null;
  stInput.disabled = true;
  stStopWrapper.classList.add('hidden');
  stRevealRow.classList.add('hidden');
  stContainer.classList.add('hidden');
  stResult.classList.remove('hidden');
  stResult.innerHTML = buildSpeedTypeResultHtml(stScore, stTotalAttempted, stElapsedTime + 's (no limit)');
}

function buildSpeedTypeResultHtml(correct, total, timeDisplay) {
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  let iconClass, iconSvg, label;

  if (correct >= 10) {
    iconClass = 'great';
    iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
    label = 'Speed Demon! Excellent!';
  } else if (correct >= 5) {
    iconClass = 'good';
    iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
    label = 'Good speed! Keep practicing.';
  } else {
    iconClass = 'needs-work';
    iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
    label = 'Keep going! You\'ll get faster.';
  }

  const timeStr = typeof timeDisplay === 'string' ? timeDisplay : timeDisplay + 's';

  if (correct >= 5) handleStreakRecord();

  return `
    <div class="result-icon ${iconClass}">${iconSvg}</div>
    <div class="result-score">${correct} words</div>
    <div class="result-label">${label}</div>
    <div class="result-details">
      <div class="result-detail-item">
        <div class="num green">${correct}</div>
        <div class="lbl">Correct</div>
      </div>
      <div class="result-detail-item">
        <div class="num red">${total - correct - stRevealed}</div>
        <div class="lbl">Wrong</div>
      </div>
      ${stRevealed > 0 ? `<div class="result-detail-item">
        <div class="num" style="color:var(--color-warning)">${stRevealed}</div>
        <div class="lbl">Revealed</div>
      </div>` : ''}
      <div class="result-detail-item">
        <div class="num" style="color:var(--color-primary)">${timeStr}</div>
        <div class="lbl">Time</div>
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

stBtnStart.addEventListener('click', startSpeedTypeTimer);
stBtnStop.addEventListener('click', finishSpeedTypeNoTimer);
stBtnReveal.addEventListener('click', stRevealWord);

stInput.addEventListener('input', () => {
  if (!stTimer) return;
  const val = stInput.value.trim().toLowerCase();
  const w = stWords[stIndex];
  const correct = w.english.toLowerCase();

  if (val === correct) {
    stScore++;
    stTotalAttempted++;
    stScoreEl.textContent = stScore;
    stTotalEl.textContent = stTotalAttempted;
    stInput.value = '';
    stInput.classList.add('st-flash-correct');
    setTimeout(() => stInput.classList.remove('st-flash-correct'), 300);
    stIndex++;
    showSpeedTypeWord();
  }
});

stInput.addEventListener('keydown', (e) => {
  if (e.key === 'Tab' && stTimer && !stInput.disabled) {
    e.preventDefault();
    stRevealWord();
    return;
  }
  if (e.key === 'Escape' && stTimer) {
    stTotalAttempted++;
    stTotalEl.textContent = stTotalAttempted;
    stInput.value = '';
    stInput.classList.add('st-flash-wrong');
    setTimeout(() => stInput.classList.remove('st-flash-wrong'), 300);
    stIndex++;
    showSpeedTypeWord();
  }
});

stTimeSelect.addEventListener('change', () => {
  if (!stTimer) initSpeedType();
});

// ============================================================
// UNSCRAMBLE (Drag & Drop)
// ============================================================
let usWords = [], usIndex = 0, usScore = 0, usAnswered = false;
const usContainer = document.getElementById('us-container');
const usResult    = document.getElementById('us-result');
const usDropzone  = document.getElementById('us-dropzone');
const usSource    = document.getElementById('us-source');
const usVietnamese= document.getElementById('us-vietnamese');
const usBtnCheck  = document.getElementById('us-btn-check');
const usBtnNext   = document.getElementById('us-btn-next');
const usBtnReset  = document.getElementById('us-btn-reset');
const usFeedback  = document.getElementById('us-feedback');
const usCurrent   = document.getElementById('us-current');
const usTotal     = document.getElementById('us-total');
const usScoreEl   = document.getElementById('us-score');
const usProgress  = document.getElementById('us-progress');
const usProgressTxt = document.getElementById('us-progress-text');

function initUnscramble() {
  usWords = shuffle(allWords);
  usIndex = 0;
  usScore = 0;
  usAnswered = false;
  usContainer.classList.remove('hidden');
  usResult.classList.add('hidden');
  showUnscramble();
}

function showUnscramble() {
  if (usIndex >= usWords.length) {
    usProgress.style.width = '100%';
    usProgressTxt.textContent = '100%';
    usContainer.classList.add('hidden');
    usResult.classList.remove('hidden');
    usResult.innerHTML = buildResultHtml(usScore, usWords.length, { topicId });

    const pct = Math.round((usScore / usWords.length) * 100);
    if (pct >= 50) handleStreakRecord();
    return;
  }

  usAnswered = false;
  usBtnCheck.disabled = false;
  usBtnNext.disabled = true;
  usFeedback.classList.add('hidden');

  const w = usWords[usIndex];
  usVietnamese.textContent = w.vietnamese;
  const usWordType = document.getElementById('us-word-type');
  usWordType.textContent = WORD_TYPE_LABELS[w.wordType] || w.wordType || '';
  usWordType.style.display = usWordType.textContent ? '' : 'none';

  const english = w.english;
  const chars = [];
  for (let i = 0; i < english.length; i++) {
    chars.push({ char: english[i], isSpace: english[i] === ' ', origIndex: i });
  }

  let dropHtml = '';
  chars.forEach((c, i) => {
    if (c.isSpace) {
      dropHtml += '<div class="us-slot us-space-slot" data-index="' + i + '"></div>';
    } else {
      dropHtml += '<div class="us-slot" data-index="' + i + '"></div>';
    }
  });
  usDropzone.innerHTML = dropHtml;

  const nonSpaceChars = chars.filter(c => !c.isSpace);
  const scrambled = shuffle(nonSpaceChars);
  usSource.innerHTML = scrambled.map((c, i) =>
    `<div class="us-tile" draggable="true" data-char="${c.char}" data-tile-id="${i}">${c.char}</div>`
  ).join('');

  usCurrent.textContent = usIndex + 1;
  usTotal.textContent = usWords.length;
  usScoreEl.textContent = usScore;
  const pct = Math.round((usIndex / usWords.length) * 100);
  usProgress.style.width = pct + '%';
  usProgressTxt.textContent = pct + '%';

  setupDragAndDrop();
}

let usDraggedTile = null;

function setupDragAndDrop() {
  usSource.querySelectorAll('.us-tile').forEach(tile => {
    tile.addEventListener('dragstart', (e) => {
      usDraggedTile = tile;
      tile.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    tile.addEventListener('dragend', () => {
      tile.classList.remove('dragging');
      usDraggedTile = null;
    });
    tile.addEventListener('click', () => {
      if (usAnswered) return;
      handleTileClick(tile);
    });
  });

  usDropzone.querySelectorAll('.us-slot:not(.us-space-slot)').forEach(slot => {
    slot.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      slot.classList.add('drag-over');
    });
    slot.addEventListener('dragleave', () => {
      slot.classList.remove('drag-over');
    });
    slot.addEventListener('drop', (e) => {
      e.preventDefault();
      slot.classList.remove('drag-over');
      if (!usDraggedTile) return;
      placeTileInSlot(usDraggedTile, slot);
    });
    slot.addEventListener('click', () => {
      if (usAnswered) return;
      returnTileFromSlot(slot);
    });
  });

  usDropzone.querySelectorAll('.us-slot').forEach(slot => {
    slot.addEventListener('dragstart', (e) => {
      const tile = slot.querySelector('.us-tile');
      if (tile) {
        usDraggedTile = tile;
        tile.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      }
    });
  });

  usSource.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  });
  usSource.addEventListener('drop', (e) => {
    e.preventDefault();
    if (!usDraggedTile) return;
    const parentSlot = usDraggedTile.closest('.us-slot');
    if (parentSlot) {
      parentSlot.classList.remove('filled');
    }
    usSource.appendChild(usDraggedTile);
    usDraggedTile.classList.remove('dragging');
    usDraggedTile = null;
  });
}

let usSelectedTile = null;

function handleTileClick(tile) {
  if (tile.parentElement === usSource || tile.closest('#us-source')) {
    const emptySlot = usDropzone.querySelector('.us-slot:not(.us-space-slot):not(.filled)');
    if (emptySlot) placeTileInSlot(tile, emptySlot);
  }
}

function placeTileInSlot(tile, slot) {
  if (slot.classList.contains('filled')) {
    const existingTile = slot.querySelector('.us-tile');
    if (existingTile) usSource.appendChild(existingTile);
  }
  slot.appendChild(tile);
  slot.classList.add('filled');
  tile.classList.remove('dragging');
}

function returnTileFromSlot(slot) {
  const tile = slot.querySelector('.us-tile');
  if (tile) {
    usSource.appendChild(tile);
    slot.classList.remove('filled');
  }
}

function usCheckAnswer() {
  if (usAnswered) return;
  usAnswered = true;

  const w = usWords[usIndex];
  const english = w.english;
  const slots = usDropzone.querySelectorAll('.us-slot');
  let answer = '';

  slots.forEach((slot, i) => {
    if (slot.classList.contains('us-space-slot')) {
      answer += ' ';
    } else {
      const tile = slot.querySelector('.us-tile');
      answer += tile ? tile.dataset.char : '';
    }
  });

  const isCorrect = answer.toLowerCase() === english.toLowerCase();

  if (isCorrect) {
    usScore++;
    usScoreEl.textContent = usScore;
    usFeedback.textContent = 'Correct!';
    usFeedback.className = 'unscramble-feedback us-correct';
    usDropzone.classList.add('us-correct-highlight');
  } else {
    usFeedback.textContent = `Answer: ${english}`;
    usFeedback.className = 'unscramble-feedback us-wrong';
    usDropzone.classList.add('us-wrong-highlight');
  }

  usFeedback.classList.remove('hidden');
  usBtnCheck.disabled = true;
  usBtnNext.disabled = false;
  setTimeout(() => usBtnNext.focus(), 150);

  usSource.querySelectorAll('.us-tile').forEach(t => t.setAttribute('draggable', 'false'));
  usDropzone.querySelectorAll('.us-tile').forEach(t => t.setAttribute('draggable', 'false'));
}

usBtnCheck.addEventListener('click', usCheckAnswer);
usBtnNext.addEventListener('click', () => {
  usDropzone.classList.remove('us-correct-highlight', 'us-wrong-highlight');
  usIndex++;
  showUnscramble();
});
usBtnReset.addEventListener('click', () => {
  if (usAnswered) return;
  usDropzone.querySelectorAll('.us-slot.filled').forEach(slot => {
    const tile = slot.querySelector('.us-tile');
    if (tile) usSource.appendChild(tile);
    slot.classList.remove('filled');
  });
});

// Keyboard: Enter to check/next in unscramble
document.addEventListener('keydown', (e) => {
  if (currentMode !== 'unscramble') return;
  if (e.key === 'Enter') {
    e.preventDefault();
    if (!usAnswered) usCheckAnswer();
    else { usDropzone.classList.remove('us-correct-highlight', 'us-wrong-highlight'); usIndex++; showUnscramble(); }
  }
});

// ============================================================
// INIT
// ============================================================
async function init() {
  try {
    const [topic, words] = await Promise.all([
      getTopic(topicId),
      loadWords(topicId),
    ]);

    practiceLoading.classList.add('hidden');

    if (!topic) {
      showToast('Topic not found.', 'error');
      navigateTo('topics.html');
      return;
    }

    bcLink.textContent = topic.name;
    chatPracticeTopicName = topic.name;
    document.title = `WordCraft — Practice: ${topic.name}`;

    const selectedWordIds = getQueryParam('words');
    allWords = selectedWordIds
      ? words.filter(w => selectedWordIds.split(',').includes(w.id))
      : words;
    wordBadge.textContent = `${allWords.length} word${allWords.length !== 1 ? 's' : ''}`;

    if (allWords.length < 4) {
      practiceEmpty.classList.remove('hidden');
      document.querySelector('.mode-selector').style.display = 'none';
      return;
    }

    // Start default mode
    document.getElementById('panel-flashcard').classList.add('active');
    initFlashcard();

  } catch (err) {
    console.error(err);
    practiceLoading.classList.add('hidden');
    showToast('Failed to load words.', 'error');
  }
}

window._restartMode = () => startMode(currentMode);

init();
