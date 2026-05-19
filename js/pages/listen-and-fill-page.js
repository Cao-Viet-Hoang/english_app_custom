/* ============================================================
   LISTEN AND FILL PAGE CONTROLLER
   AI-generated dictation passage with hybrid audio (full + per-sentence)
   and case-insensitive exact-match scoring.
   ============================================================ */

import { initProtectedPage } from '../shared/page-init.js';
import { generateListenAndFillPassage } from '../ai/writing-ai.js';
import { speakText } from '../shared/tts.js';
import { handleStreakRecord } from '../shared/streak-handler.js';
import { buildResultHtml } from '../shared/result-builder.js';
import { showToast, escapeHtml } from '../ui/index.js';
import { initChatWidget } from '../chat/chat-ui.js';

// ---- Auth, Firebase, navbar, streak ----
initProtectedPage();

// ---- DOM Refs ----
const setupEl       = document.getElementById('lf-setup');
const loadingEl     = document.getElementById('lf-loading');
const practiceEl    = document.getElementById('lf-practice');
const resultEl      = document.getElementById('lf-result');

const levelGroup    = document.getElementById('lf-level-group');
const topicGroup    = document.getElementById('lf-topic-group');
const lengthGroup   = document.getElementById('lf-length-group');
const customTopicEl = document.getElementById('lf-custom-topic');
const btnStart      = document.getElementById('lf-btn-start');

const passageBadge  = document.getElementById('lf-passage-badge');
const statLevel     = document.getElementById('lf-stat-level');
const statTopic     = document.getElementById('lf-stat-topic');
const statBlanks    = document.getElementById('lf-stat-blanks');

const btnPlay       = document.getElementById('lf-btn-play');
const speedSelect   = document.getElementById('lf-speed');
const btnRestart    = document.getElementById('lf-btn-restart');

const passageTitle  = document.getElementById('lf-passage-title');
const passageEl     = document.getElementById('lf-passage');
const btnCheck      = document.getElementById('lf-btn-check');

const resultSummary = document.getElementById('lf-result-summary');
const resultTitle   = document.getElementById('lf-result-title');
const resultPassage = document.getElementById('lf-result-passage');
const btnRetry      = document.getElementById('lf-btn-retry');
const btnNew        = document.getElementById('lf-btn-new');

// ---- State ----
let selectedLevel  = 'A2';
let selectedTopic  = '';   // empty string = "Surprise me"
let selectedLength = 'medium';
let currentPassage = null; // { title, topic, level, sentences: [{ text, blanks }] }
let resultMode     = false;

// ---- Chat widget ----
initChatWidget(() => ({
  page: 'Listen and Fill',
  topic: currentPassage?.topic || selectedTopic || '',
  level: currentPassage?.level || selectedLevel,
}));

// ============================================================
// SETUP — chip selection
// ============================================================

function bindRadioChips(group, onSelect) {
  group.addEventListener('click', (e) => {
    const chip = e.target.closest('.lf-chip');
    if (!chip || !group.contains(chip)) return;
    group.querySelectorAll('.lf-chip').forEach(c => {
      c.classList.remove('active');
      c.setAttribute('aria-checked', 'false');
      c.setAttribute('aria-pressed', 'false');
    });
    chip.classList.add('active');
    chip.setAttribute('aria-checked', 'true');
    chip.setAttribute('aria-pressed', 'true');
    onSelect(chip);
  });
}

bindRadioChips(levelGroup, (chip) => { selectedLevel = chip.dataset.level || 'A2'; });
bindRadioChips(lengthGroup, (chip) => { selectedLength = chip.dataset.length || 'medium'; });
bindRadioChips(topicGroup, (chip) => {
  selectedTopic = chip.dataset.topic || '';
  // Clear custom topic when picking a chip
  if (customTopicEl) customTopicEl.value = '';
});

// Custom topic — typing deactivates topic chips (user is overriding)
if (customTopicEl) {
  customTopicEl.addEventListener('input', () => {
    const v = customTopicEl.value.trim();
    if (v.length > 0) {
      topicGroup.querySelectorAll('.lf-chip').forEach(c => {
        c.classList.remove('active');
        c.setAttribute('aria-pressed', 'false');
      });
      selectedTopic = v;
    } else {
      // Empty input — default back to "Surprise me"
      const randomChip = topicGroup.querySelector('[data-topic-key="random"]');
      if (randomChip) {
        randomChip.classList.add('active');
        randomChip.setAttribute('aria-pressed', 'true');
      }
      selectedTopic = '';
    }
  });
}

// ============================================================
// GENERATE PASSAGE
// ============================================================

async function generatePassage() {
  const customTopic = customTopicEl ? customTopicEl.value.trim() : '';
  const topic = customTopic || selectedTopic;

  setupEl.classList.add('hidden');
  practiceEl.classList.add('hidden');
  resultEl.classList.add('hidden');
  loadingEl.classList.remove('hidden');

  try {
    const passage = await generateListenAndFillPassage({
      level: selectedLevel,
      topic,
      length: selectedLength,
    });

    if (!passage.sentences || passage.sentences.length === 0) {
      throw new Error('AI returned no sentences');
    }

    const totalBlanks = passage.sentences.reduce((sum, s) => sum + s.blanks.length, 0);
    if (totalBlanks === 0) {
      throw new Error('AI returned no blanks');
    }

    currentPassage = passage;
    showPractice();
  } catch (err) {
    console.error('Listen and Fill generation error:', err);
    showToast('Failed to generate passage. ' + (err.message || ''), 'error');
    loadingEl.classList.add('hidden');
    setupEl.classList.remove('hidden');
  }
}

if (btnStart) btnStart.addEventListener('click', generatePassage);

// ============================================================
// PRACTICE — render passage with inline inputs
// ============================================================

function getSpeed() {
  return parseFloat(speedSelect.value) || 0.9;
}

function buildSentenceText(sentence) {
  // Reconstruct full sentence by replacing {i} with the actual word
  return sentence.text.replace(/\{(\d+)\}/g, (_, idx) => sentence.blanks[Number(idx)] ?? '');
}

function buildFullPassageText(passage) {
  return passage.sentences.map(buildSentenceText).join(' ');
}

function renderPassageInputs() {
  passageTitle.textContent = currentPassage.title;
  passageEl.innerHTML = '';

  const totalBlanks = currentPassage.sentences.reduce((sum, s) => sum + s.blanks.length, 0);
  passageBadge.textContent = `${totalBlanks} blank${totalBlanks !== 1 ? 's' : ''}`;
  passageBadge.classList.remove('hidden');

  statLevel.textContent = currentPassage.level;
  statTopic.textContent = currentPassage.topic || 'Random';
  statBlanks.textContent = totalBlanks;

  currentPassage.sentences.forEach((sentence, sIdx) => {
    const wrap = document.createElement('span');
    wrap.className = 'lf-sentence-wrap';

    // Per-sentence replay button (icon)
    const replayBtn = document.createElement('button');
    replayBtn.type = 'button';
    replayBtn.className = 'lf-sentence-replay';
    replayBtn.title = `Replay sentence ${sIdx + 1}`;
    replayBtn.dataset.sentenceIdx = String(sIdx);
    replayBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="5 3 19 12 5 21 5 3"/>
      </svg>`;
    wrap.appendChild(replayBtn);

    // Sentence body — text + inline inputs
    const body = document.createElement('span');
    body.className = 'lf-sentence';

    // Split sentence.text on {i} placeholders, interleaving plain text + inputs.
    const parts = sentence.text.split(/(\{\d+\})/g);
    parts.forEach(part => {
      const m = part.match(/^\{(\d+)\}$/);
      if (m) {
        const blankIdx = Number(m[1]);
        const answer = sentence.blanks[blankIdx] ?? '';
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'lf-blank';
        input.autocomplete = 'off';
        input.spellcheck = false;
        input.dataset.sentenceIdx = String(sIdx);
        input.dataset.blankIdx = String(blankIdx);
        input.dataset.answer = answer;
        // Approximate width by answer length
        input.style.minWidth = `${Math.max(answer.length, 3) * 12}px`;
        input.placeholder = '____';
        body.appendChild(input);
      } else if (part.length > 0) {
        body.appendChild(document.createTextNode(part));
      }
    });

    wrap.appendChild(body);
    passageEl.appendChild(wrap);
    // Trailing space between sentences
    passageEl.appendChild(document.createTextNode(' '));
  });
}

function showPractice() {
  resultMode = false;
  loadingEl.classList.add('hidden');
  setupEl.classList.add('hidden');
  resultEl.classList.add('hidden');
  practiceEl.classList.remove('hidden');

  renderPassageInputs();

  // Auto-play once on first render — small delay so the DOM is painted
  setTimeout(() => {
    playFull();
    // Focus first blank
    const firstInput = passageEl.querySelector('input.lf-blank');
    if (firstInput) firstInput.focus();
  }, 150);
}

// ============================================================
// AUDIO PLAYBACK
// ============================================================

function playFull() {
  if (!currentPassage) return;
  const text = buildFullPassageText(currentPassage);
  speakText(text, getSpeed());
}

function playSentence(sIdx) {
  const sentence = currentPassage?.sentences?.[sIdx];
  if (!sentence) return;
  speakText(buildSentenceText(sentence), getSpeed());

  // Visual feedback — pulse the icon briefly
  const btn = passageEl.querySelector(`.lf-sentence-replay[data-sentence-idx="${sIdx}"]`);
  if (btn) {
    btn.classList.add('lf-playing');
    setTimeout(() => btn.classList.remove('lf-playing'), 1800);
  }
}

if (btnPlay) btnPlay.addEventListener('click', playFull);

if (passageEl) {
  passageEl.addEventListener('click', (e) => {
    const replayBtn = e.target.closest('.lf-sentence-replay');
    if (!replayBtn) return;
    const idx = Number(replayBtn.dataset.sentenceIdx);
    playSentence(idx);
  });
}

// ============================================================
// CHECK ANSWERS — case-insensitive exact match
// ============================================================

function normalize(s) {
  return String(s || '').trim().toLowerCase().replace(/[.,!?;:'"]/g, '');
}

function checkAnswers() {
  if (!currentPassage || resultMode) return;
  resultMode = true;

  const inputs = passageEl.querySelectorAll('input.lf-blank');
  let correctCount = 0;
  let totalCount = 0;

  inputs.forEach(input => {
    totalCount++;
    const user = normalize(input.value);
    const answer = normalize(input.dataset.answer);
    const isCorrect = user === answer && user.length > 0;
    input.classList.remove('lf-correct', 'lf-wrong');
    input.classList.add(isCorrect ? 'lf-correct' : 'lf-wrong');
    input.disabled = true;
    if (isCorrect) correctCount++;
  });

  showResult(correctCount, totalCount);
}

if (btnCheck) btnCheck.addEventListener('click', checkAnswers);

// ============================================================
// RESULT SCREEN
// ============================================================

function buildResultPassageHtml() {
  // Build the passage with corrections shown inline.
  // Correct → green; Wrong/empty → strike-through with the correct answer next to it.
  const parts = [];

  currentPassage.sentences.forEach((sentence, sIdx) => {
    const inputs = Array.from(
      passageEl.querySelectorAll(`input.lf-blank[data-sentence-idx="${sIdx}"]`)
    );

    const segments = sentence.text.split(/(\{\d+\})/g);
    let html = '';
    segments.forEach(seg => {
      const m = seg.match(/^\{(\d+)\}$/);
      if (m) {
        const blankIdx = Number(m[1]);
        const input = inputs.find(i => Number(i.dataset.blankIdx) === blankIdx);
        const userValue = input ? input.value : '';
        const answer = sentence.blanks[blankIdx] || '';
        const isCorrect = normalize(userValue) === normalize(answer) && userValue.trim().length > 0;
        if (isCorrect) {
          html += `<span class="lf-correction">${escapeHtml(answer)}</span>`;
        } else {
          const userPart = userValue.trim()
            ? `<span class="lf-blank lf-wrong" style="min-width:auto;display:inline-block">${escapeHtml(userValue)}</span>`
            : `<span class="lf-blank lf-wrong" style="min-width:auto;display:inline-block">____</span>`;
          html += `${userPart}<span class="lf-correction">${escapeHtml(answer)}</span>`;
        }
      } else {
        html += escapeHtml(seg);
      }
    });
    parts.push(html);
  });

  return parts.join(' ');
}

function showResult(correct, total) {
  practiceEl.classList.add('hidden');
  resultEl.classList.remove('hidden');

  resultSummary.innerHTML = buildResultHtml(correct, total, { label: `${correct} / ${total}` });

  resultTitle.textContent = currentPassage.title;
  resultPassage.innerHTML = buildResultPassageHtml();

  // Record streak — completing a Listen and Fill counts as practice
  handleStreakRecord('vocabulary');
}

// ============================================================
// RESTART / RETRY
// ============================================================

function goToSetup() {
  currentPassage = null;
  resultMode = false;
  practiceEl.classList.add('hidden');
  resultEl.classList.add('hidden');
  loadingEl.classList.add('hidden');
  passageBadge.classList.add('hidden');
  setupEl.classList.remove('hidden');
}

function retrySamePassage() {
  if (!currentPassage) {
    goToSetup();
    return;
  }
  showPractice();
}

if (btnRestart) btnRestart.addEventListener('click', goToSetup);
if (btnNew)     btnNew.addEventListener('click', goToSetup);
if (btnRetry)   btnRetry.addEventListener('click', retrySamePassage);

// Result screen "Play Again" hook used by buildResultHtml
window._restartMode = retrySamePassage;

// ============================================================
// KEYBOARD SHORTCUTS
// ============================================================

document.addEventListener('keydown', (e) => {
  // Don't fire when typing in custom topic field on setup
  const tag = (document.activeElement?.tagName || '').toLowerCase();

  // Ctrl/Cmd+Enter → Check answers (only on practice screen)
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    if (!practiceEl.classList.contains('hidden') && !resultMode) {
      e.preventDefault();
      checkAnswers();
    }
    return;
  }

  // R → Play full (only on practice screen, not while typing in inputs)
  if (e.key === 'r' || e.key === 'R') {
    if (tag === 'input' || tag === 'textarea') return;
    if (!practiceEl.classList.contains('hidden')) {
      playFull();
    }
  }
});
