/* ============================================================
   TOPIC DETAIL PAGE CONTROLLER
   Auth, tabs, vocabulary CRUD, paragraphs, AI insights, swipe.
   ============================================================ */

import { guardAuth, logout, getQueryParam, navigateTo } from '../core/router.js';
import { initFirebase } from '../core/firebase.js';
import { getTopic } from '../features/topics.js';
import { loadWords, addWord, updateWord, deleteWord, saveWordInsights, toggleWordLearned, findDuplicateWords } from '../features/vocabulary.js';
import { loadParagraphs, saveParagraph, deleteParagraph } from '../features/paragraphs.js';
import { generateParagraph, generateWordInfo, generateBulkWordInfo, generateWordInsights } from '../ai/word-ai.js';
import {
  showModal, closeModal, setupModalClose,
  showToast, confirmDialog, confirmDialogHtml, formatDate, escapeHtml
} from '../ui/index.js';
import { loadStreak } from '../features/streak.js';
import { initChatWidget } from '../chat/chat-ui.js';

// ---- Auth & Firebase ----
const session = guardAuth();
initFirebase(session.firebase);

document.getElementById('nav-username').textContent = session.username;
document.getElementById('nav-avatar').textContent = session.username.charAt(0).toUpperCase();
document.getElementById('btn-logout').addEventListener('click', logout);

// ---- Chat widget ----
// chatFocusWord is updated whenever the user interacts with a word (row click / insights)
let chatFocusWord = null;
initChatWidget(() => ({
  word:        chatFocusWord?.english    || null,
  wordType:    chatFocusWord?.wordType   || null,
  vietnamese:  chatFocusWord?.vietnamese || null,
  topic:       topicName,
  page:        'Topic Detail',
  words:       allWords,
}));

// ---- Navbar streak badge ----
function updateStreakBadge() {
  loadStreak().then(data => {
    const el = document.getElementById('navbar-streak');
    const countEl = document.getElementById('navbar-streak-count');
    if (data.currentStreak > 0 || data.isActiveToday) {
      countEl.textContent = data.currentStreak;
      el.style.display = '';
    } else {
      el.style.display = 'none';
    }
  }).catch(() => {});
}
updateStreakBadge();

// ---- Topic ID from URL ----
const topicId = getQueryParam('topicId');
if (!topicId) {
  navigateTo('topics.html');
  throw new Error('No topicId');
}

// Practice button -> open word selection modal
document.getElementById('btn-practice').addEventListener('click', (e) => {
  e.preventDefault();
  openPracticeSelectModal();
});

// Writing button -> open writing word selection modal
document.getElementById('btn-writing').addEventListener('click', (e) => {
  e.preventDefault();
  openWritingSelectModal();
});

// Reading button -> open reading word selection modal
document.getElementById('btn-reading').addEventListener('click', (e) => {
  e.preventDefault();
  openReadingSelectModal();
});

// ---- DOM Refs ----
// Header
const breadcrumbTopic = document.getElementById('breadcrumb-topic');
const detailTitle     = document.getElementById('detail-title-text');
const detailWordBadge = document.getElementById('detail-word-badge');

// Vocab
const vocabLoading   = document.getElementById('vocab-loading');
const vocabEmpty     = document.getElementById('vocab-empty');
const vocabWrapper   = document.getElementById('vocab-table-wrapper');
const vocabTbody     = document.getElementById('vocab-tbody');
const vocabSearch    = document.getElementById('vocab-search-input');
const btnAddWord     = document.getElementById('btn-add-word');
const learnedProgressEl   = document.getElementById('learned-progress');
const learnedProgressFill = document.getElementById('learned-progress-fill');
const learnedProgressText = document.getElementById('learned-progress-text');

// Paragraphs
const paraLoading    = document.getElementById('para-loading');
const paraEmpty      = document.getElementById('para-empty');
const paraList       = document.getElementById('para-list');
const paraCount      = document.getElementById('para-count');
const btnGenerateAI  = document.getElementById('btn-generate-ai');
const aiGeneratingEl = document.getElementById('ai-generating');

// Word modal
const modalWordOverlay = document.getElementById('modal-word');
const modalWordTitle   = document.getElementById('modal-word-title');
const formWord         = document.getElementById('form-word');
const inputEnglish     = document.getElementById('input-english');
const inputVietnamese  = document.getElementById('input-vietnamese');
const inputIpaUS      = document.getElementById('input-ipa-us');
const inputIpaUK      = document.getElementById('input-ipa-uk');
const inputWordType    = document.getElementById('input-word-type');
const inputDescription = document.getElementById('input-description');
const btnWordSave      = document.getElementById('btn-word-save');
const btnAiFill        = document.getElementById('btn-ai-fill');

const englishLowercaseWarn = document.getElementById('english-lowercase-warn');
const bulkLowercaseWarn   = document.getElementById('bulk-lowercase-warn');

inputEnglish.addEventListener('input', () => {
  const hasUpper = /[A-Z]/.test(inputEnglish.value);
  englishLowercaseWarn.classList.toggle('hidden', !hasUpper);
});

setupModalClose('#modal-word');
setupModalClose('#modal-word-select');
setupModalClose('#modal-practice-select');
setupModalClose('#modal-writing-select');
setupModalClose('#modal-reading-select');
setupModalClose('#modal-bulk-add');

// ---- Word Selection Modal refs ----
const modalWordSelect  = document.getElementById('modal-word-select');
const wsListEl         = document.getElementById('ws-list');
const wsCounter        = document.getElementById('ws-counter');
const wsBtnGenerate    = document.getElementById('ws-btn-generate');
const wsSelectAll      = document.getElementById('ws-select-all');
const wsDeselectAll    = document.getElementById('ws-deselect-all');
const wsCustomInstruction = document.getElementById('ws-custom-instruction');

function openWordSelectModal() {
  if (allWords.length === 0) {
    showToast('Add some vocabulary words first before generating a paragraph.', 'warning');
    return;
  }
  wsListEl.innerHTML = allWords.map((w, i) => `
    <label class="ws-item">
      <input type="checkbox" value="${escapeHtml(w.english)}" checked />
      <span class="ws-word">${escapeHtml(w.english)}</span>
      <span class="ws-word-vi">${escapeHtml(w.vietnamese)}</span>
    </label>
  `).join('');
  wsCustomInstruction.value = '';
  updateWordSelectCounter();
  showModal(modalWordSelect);
}

function getSelectedWords() {
  return Array.from(wsListEl.querySelectorAll('input[type=checkbox]:checked')).map(cb => cb.value);
}

function updateWordSelectCounter() {
  const checked = wsListEl.querySelectorAll('input[type=checkbox]:checked').length;
  const total = wsListEl.querySelectorAll('input[type=checkbox]').length;
  wsCounter.textContent = `${checked} / ${total} selected`;
  wsBtnGenerate.disabled = checked === 0;
}

wsListEl.addEventListener('change', updateWordSelectCounter);
wsSelectAll.addEventListener('click', () => {
  wsListEl.querySelectorAll('input[type=checkbox]').forEach(cb => cb.checked = true);
  updateWordSelectCounter();
});
wsDeselectAll.addEventListener('click', () => {
  wsListEl.querySelectorAll('input[type=checkbox]').forEach(cb => cb.checked = false);
  updateWordSelectCounter();
});

// ---- Practice Word Selection Modal ----
const modalPracticeSelect = document.getElementById('modal-practice-select');
const psListEl            = document.getElementById('ps-list');
const psCounter           = document.getElementById('ps-counter');
const psBtnStart          = document.getElementById('ps-btn-start');
const psSelectAll         = document.getElementById('ps-select-all');
const psDeselectAll       = document.getElementById('ps-deselect-all');

function openPracticeSelectModal() {
  if (allWords.length < 4) {
    showToast('Add at least 4 vocabulary words to start practicing.', 'warning');
    return;
  }
  psListEl.innerHTML = allWords.map(w => `
    <label class="ws-item">
      <input type="checkbox" value="${w.id}" checked />
      <span class="ws-word">${escapeHtml(w.english)}</span>
      <span class="ws-word-vi">${escapeHtml(w.vietnamese)}</span>
    </label>
  `).join('');
  updatePracticeSelectCounter();
  showModal(modalPracticeSelect);
}

function updatePracticeSelectCounter() {
  const checked = psListEl.querySelectorAll('input[type=checkbox]:checked').length;
  const total = psListEl.querySelectorAll('input[type=checkbox]').length;
  psCounter.textContent = `${checked} / ${total} selected`;
  psBtnStart.disabled = checked < 4;
}

psListEl.addEventListener('change', updatePracticeSelectCounter);
psSelectAll.addEventListener('click', () => {
  psListEl.querySelectorAll('input[type=checkbox]').forEach(cb => cb.checked = true);
  updatePracticeSelectCounter();
});
psDeselectAll.addEventListener('click', () => {
  psListEl.querySelectorAll('input[type=checkbox]').forEach(cb => cb.checked = false);
  updatePracticeSelectCounter();
});

psBtnStart.addEventListener('click', () => {
  const selectedIds = Array.from(psListEl.querySelectorAll('input[type=checkbox]:checked')).map(cb => cb.value);
  const total = psListEl.querySelectorAll('input[type=checkbox]').length;
  let url = `practice.html?topicId=${topicId}`;
  if (selectedIds.length < total) {
    url += `&words=${selectedIds.join(',')}`;
  }
  navigateTo(url);
});

// ---- Writing Word Selection Modal ----
const modalWritingSelect = document.getElementById('modal-writing-select');
const wrsListEl          = document.getElementById('wrs-list');
const wrsCounter         = document.getElementById('wrs-counter');
const wrsBtnStart        = document.getElementById('wrs-btn-start');
const wrsSelectAll       = document.getElementById('wrs-select-all');
const wrsDeselectAll     = document.getElementById('wrs-deselect-all');

function openWritingSelectModal() {
  if (allWords.length < 1) {
    showToast('Add at least 1 vocabulary word to start writing practice.', 'warning');
    return;
  }
  wrsListEl.innerHTML = allWords.map(w => `
    <label class="ws-item">
      <input type="checkbox" value="${w.id}" checked />
      <span class="ws-word">${escapeHtml(w.english)}</span>
      <span class="ws-word-vi">${escapeHtml(w.vietnamese)}</span>
    </label>
  `).join('');
  updateWritingSelectCounter();
  showModal(modalWritingSelect);
}

function updateWritingSelectCounter() {
  const checked = wrsListEl.querySelectorAll('input[type=checkbox]:checked').length;
  const total = wrsListEl.querySelectorAll('input[type=checkbox]').length;
  wrsCounter.textContent = `${checked} / ${total} selected`;
  wrsBtnStart.disabled = checked < 1;
}

wrsListEl.addEventListener('change', updateWritingSelectCounter);
wrsSelectAll.addEventListener('click', () => {
  wrsListEl.querySelectorAll('input[type=checkbox]').forEach(cb => cb.checked = true);
  updateWritingSelectCounter();
});
wrsDeselectAll.addEventListener('click', () => {
  wrsListEl.querySelectorAll('input[type=checkbox]').forEach(cb => cb.checked = false);
  updateWritingSelectCounter();
});

wrsBtnStart.addEventListener('click', () => {
  const selectedIds = Array.from(wrsListEl.querySelectorAll('input[type=checkbox]:checked')).map(cb => cb.value);
  const total = wrsListEl.querySelectorAll('input[type=checkbox]').length;
  let url = `writing.html?topicId=${topicId}`;
  if (selectedIds.length < total) {
    url += `&words=${selectedIds.join(',')}`;
  }
  navigateTo(url);
});

// ---- Reading Word Selection Modal ----
const modalReadingSelect = document.getElementById('modal-reading-select');
const rdsListEl          = document.getElementById('rds-list');
const rdsCounter         = document.getElementById('rds-counter');
const rdsBtnStart        = document.getElementById('rds-btn-start');
const rdsSelectAll       = document.getElementById('rds-select-all');
const rdsDeselectAll     = document.getElementById('rds-deselect-all');

function openReadingSelectModal() {
  if (allWords.length < 4) {
    showToast('Add at least 4 vocabulary words to start reading practice.', 'warning');
    return;
  }
  rdsListEl.innerHTML = allWords.map(w => `
    <label class="ws-item">
      <input type="checkbox" value="${w.id}" checked />
      <span class="ws-word">${escapeHtml(w.english)}</span>
      <span class="ws-word-vi">${escapeHtml(w.vietnamese)}</span>
    </label>
  `).join('');
  updateReadingSelectCounter();
  showModal(modalReadingSelect);
}

function updateReadingSelectCounter() {
  const checked = rdsListEl.querySelectorAll('input[type=checkbox]:checked').length;
  const total = rdsListEl.querySelectorAll('input[type=checkbox]').length;
  rdsCounter.textContent = `${checked} / ${total} selected`;
  rdsBtnStart.disabled = checked < 4;
}

rdsListEl.addEventListener('change', updateReadingSelectCounter);
rdsSelectAll.addEventListener('click', () => {
  rdsListEl.querySelectorAll('input[type=checkbox]').forEach(cb => cb.checked = true);
  updateReadingSelectCounter();
});
rdsDeselectAll.addEventListener('click', () => {
  rdsListEl.querySelectorAll('input[type=checkbox]').forEach(cb => cb.checked = false);
  updateReadingSelectCounter();
});

rdsBtnStart.addEventListener('click', () => {
  const selectedIds = Array.from(rdsListEl.querySelectorAll('input[type=checkbox]:checked')).map(cb => cb.value);
  const total = rdsListEl.querySelectorAll('input[type=checkbox]').length;
  let url = `reading.html?topicId=${topicId}`;
  if (selectedIds.length < total) {
    url += `&words=${selectedIds.join(',')}`;
  }
  navigateTo(url);
});

// ---- AI Auto-fill word fields ----
btnAiFill.addEventListener('click', async () => {
  const word = inputEnglish.value.trim();
  if (!word) {
    showToast('Please enter an English word first.', 'warning');
    inputEnglish.focus();
    return;
  }
  btnAiFill.disabled = true;
  btnAiFill.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24"
         fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
         class="spin">
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
    Generating…
  `;
  try {
    const info = await generateWordInfo(word, topicName, {
      wordType:   inputWordType.value,
      vietnamese: inputVietnamese.value.trim(),
    });
    inputVietnamese.value  = info.vietnamese;
    inputIpaUS.value       = info.ipaUS;
    inputIpaUK.value       = info.ipaUK;
    inputWordType.value    = info.wordType;
    inputDescription.value = info.description;
    if (info.correctedWord && info.correctedWord.toLowerCase() !== word.toLowerCase()) {
      inputEnglish.value = info.correctedWord;
      showToast(`Spelling corrected: "${word}" → "${info.correctedWord}"`, 'warning', 5000);
    } else {
      showToast('Fields filled by AI!', 'success');
    }
  } catch (err) {
    console.error(err);
    showToast('AI generation failed. ' + (err.message || ''), 'error');
  } finally {
    btnAiFill.disabled = false;
    btnAiFill.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24"
           fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
      </svg>
      Generate with AI
    `;
  }
});

// ---- Bulk Add refs & logic ----
const modalBulkAdd        = document.getElementById('modal-bulk-add');
const bulkWordsInput      = document.getElementById('bulk-words-input');
const bulkStepInput       = document.getElementById('bulk-step-input');
const bulkStepPreview     = document.getElementById('bulk-step-preview');
const bulkLoading         = document.getElementById('bulk-loading');
const bulkLoadingText     = document.getElementById('bulk-loading-text');
const bulkProgressBarWrap = document.getElementById('bulk-progress-bar-wrap');
const bulkProgressFill    = document.getElementById('bulk-progress-fill');
const bulkProgressCount   = document.getElementById('bulk-progress-count');
const bulkAdding          = document.getElementById('bulk-adding');
const bulkAddingText      = document.getElementById('bulk-adding-text');
const bulkPreviewTbody    = document.getElementById('bulk-preview-tbody');
const bulkCounter         = document.getElementById('bulk-counter');
const bulkBtnGenerate     = document.getElementById('bulk-btn-generate');
const bulkBtnAdd          = document.getElementById('bulk-btn-add');
const bulkSelectAll       = document.getElementById('bulk-select-all');
const bulkDeselectAll     = document.getElementById('bulk-deselect-all');
const bulkModalTitle      = document.getElementById('bulk-modal-title');
const btnBulkAdd          = document.getElementById('btn-bulk-add');

const GENERATE_BTN_HTML = bulkBtnGenerate.innerHTML;

bulkWordsInput.addEventListener('input', () => {
  const hasUpper = /[A-Z]/.test(bulkWordsInput.value);
  bulkLowercaseWarn.classList.toggle('hidden', !hasUpper);
});

let bulkResults = [];

function parseBulkInput(text) {
  const raw = [...new Set(
    text.split(/[,\n]+/)
      .map(w => w.trim())
      .filter(w => w.length > 0)
  )];
  const lowered = raw.map(w => w.toLowerCase());
  if (raw.some((w, i) => w !== lowered[i])) {
    bulkWordsInput.value = lowered.join(', ');
    showToast('Converted to lowercase.', 'info');
  }
  return [...new Set(lowered)];
}

function updateBulkCounter() {
  const checked = bulkPreviewTbody.querySelectorAll('input[type=checkbox]:checked').length;
  const total = bulkPreviewTbody.querySelectorAll('input[type=checkbox]').length;
  bulkCounter.textContent = `${checked} / ${total} selected`;
  bulkBtnAdd.disabled = checked === 0;
}

const bulkCorrectionNotice = document.getElementById('bulk-correction-notice');

let bulkDuplicatesMap = new Map();

function renderBulkPreview(results, duplicatesMap = new Map()) {
  bulkResults = results;
  bulkDuplicatesMap = duplicatesMap;

  // Build correction list
  const corrections = results.filter(r =>
    r.correctedWord && r.originalWord &&
    r.correctedWord.toLowerCase() !== r.originalWord.toLowerCase()
  );

  if (corrections.length > 0) {
    const list = corrections
      .map(r => `<strong><s>${escapeHtml(r.originalWord)}</s> → ${escapeHtml(r.correctedWord)}</strong>`)
      .join(', ');
    bulkCorrectionNotice.innerHTML =
      `⚠ Spelling auto-corrected for ${corrections.length} word${corrections.length > 1 ? 's' : ''}: ${list}`;
    bulkCorrectionNotice.classList.remove('hidden');
  } else {
    bulkCorrectionNotice.classList.add('hidden');
  }

  bulkPreviewTbody.innerHTML = results.map((r, i) => {
    const wasCorrected = r.correctedWord && r.originalWord &&
      r.correctedWord.toLowerCase() !== r.originalWord.toLowerCase();
    const dupeLocations = duplicatesMap.get(r.english.toLowerCase());
    const dupeHtml = dupeLocations
      ? `<br><small class="bulk-dupe-warn" style="color:var(--color-warning,#F2D07A);">Exists in: ${dupeLocations.map(l => escapeHtml(l.topicName) + (l.isCurrent ? ' (this topic)' : '')).join(', ')}</small>`
      : '';
    return `
    <tr${dupeLocations ? ' class="bulk-dupe-row"' : ''}>
      <td><input type="checkbox" data-index="${i}" checked /></td>
      <td class="vocab-english">${escapeHtml(r.english)}${wasCorrected ? `<br><small style="color:var(--color-warning,#F2D07A);"><s>${escapeHtml(r.originalWord)}</s> → corrected</small>` : ''}${dupeHtml}</td>
      <td>${escapeHtml(r.vietnamese)}</td>
      <td class="vocab-ipa">${escapeHtml(r.ipaUS)}</td>
      <td><span class="${badgeClass(r.wordType)}">${WORD_TYPE_LABELS[r.wordType] || r.wordType}</span></td>
    </tr>`;
  }).join('');
  updateBulkCounter();
}

function resetBulkModal() {
  bulkWordsInput.value = '';
  bulkStepInput.classList.remove('hidden');
  bulkStepPreview.classList.add('hidden');
  bulkLoading.classList.add('hidden');
  bulkProgressBarWrap.classList.add('hidden');
  bulkAdding.classList.add('hidden');
  bulkCorrectionNotice.classList.add('hidden');
  bulkCorrectionNotice.innerHTML = '';
  bulkBtnGenerate.classList.remove('hidden');
  bulkBtnGenerate.disabled = false;
  bulkBtnGenerate.innerHTML = GENERATE_BTN_HTML;
  bulkBtnAdd.classList.add('hidden');
  bulkModalTitle.textContent = 'Bulk Add Words';
  bulkResults = [];
  bulkDuplicatesMap = new Map();
}

btnBulkAdd.addEventListener('click', () => {
  resetBulkModal();
  showModal(modalBulkAdd);
});

bulkPreviewTbody.addEventListener('change', updateBulkCounter);
bulkPreviewTbody.addEventListener('click', (e) => {
  if (e.target.type === 'checkbox') return;
  const row = e.target.closest('tr');
  if (!row) return;
  const cb = row.querySelector('input[type=checkbox]');
  if (cb) {
    cb.checked = !cb.checked;
    updateBulkCounter();
  }
});

bulkSelectAll.addEventListener('click', () => {
  bulkPreviewTbody.querySelectorAll('input[type=checkbox]').forEach(cb => cb.checked = true);
  updateBulkCounter();
});
bulkDeselectAll.addEventListener('click', () => {
  bulkPreviewTbody.querySelectorAll('input[type=checkbox]').forEach(cb => cb.checked = false);
  updateBulkCounter();
});

bulkBtnGenerate.addEventListener('click', async () => {
  const words = parseBulkInput(bulkWordsInput.value);
  if (words.length === 0) {
    showToast('Please enter at least one English word.', 'warning');
    bulkWordsInput.focus();
    return;
  }

  bulkBtnGenerate.disabled = true;
  bulkBtnGenerate.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
         fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
         class="spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
    Generating…
  `;
  bulkStepInput.classList.add('hidden');
  bulkLoading.classList.remove('hidden');
  bulkProgressBarWrap.classList.add('hidden');
  bulkProgressFill.style.width = '0%';
  bulkLoadingText.textContent = `AI is generating details for ${words.length} word${words.length > 1 ? 's' : ''}…`;

  let progressBarShown = false;

  try {
    const results = await generateBulkWordInfo(words, (done, total) => {
      if (done < total) {
        if (!progressBarShown) {
          bulkProgressBarWrap.classList.remove('hidden');
          progressBarShown = true;
        }
        const pct = Math.round((done / total) * 100);
        bulkProgressFill.style.width = `${pct}%`;
        bulkProgressCount.textContent = `${done} / ${total} words`;
      }
    }, topicName);
    // Check for duplicates across all topics
    bulkLoadingText.textContent = 'Checking for duplicates…';
    let duplicatesMap = new Map();
    try {
      duplicatesMap = await findDuplicateWords(results.map(r => r.english), topicId);
    } catch (dupErr) {
      console.warn('Duplicate check failed:', dupErr);
    }

    bulkLoading.classList.add('hidden');
    bulkProgressBarWrap.classList.add('hidden');
    bulkStepPreview.classList.remove('hidden');
    bulkBtnGenerate.classList.add('hidden');
    bulkBtnAdd.classList.remove('hidden');
    bulkModalTitle.textContent = `Review ${results.length} Words`;
    renderBulkPreview(results, duplicatesMap);
  } catch (err) {
    console.error(err);
    showToast('AI generation failed. ' + (err.message || ''), 'error');
    bulkLoading.classList.add('hidden');
    bulkProgressBarWrap.classList.add('hidden');
    bulkStepInput.classList.remove('hidden');
    bulkBtnGenerate.disabled = false;
    bulkBtnGenerate.innerHTML = GENERATE_BTN_HTML;
  }
});

bulkBtnAdd.addEventListener('click', async () => {
  const selectedIndices = Array.from(
    bulkPreviewTbody.querySelectorAll('input[type=checkbox]:checked')
  ).map(cb => parseInt(cb.dataset.index));

  if (selectedIndices.length === 0) return;

  const toAdd = selectedIndices.map(i => bulkResults[i]);

  // Check if any selected words are duplicates
  const selectedDupes = new Map();
  for (const word of toAdd) {
    const key = word.english.toLowerCase();
    if (bulkDuplicatesMap.has(key)) {
      selectedDupes.set(key, bulkDuplicatesMap.get(key));
    }
  }
  if (selectedDupes.size > 0) {
    const ok = await confirmDialogHtml(buildDuplicateWarningHtml(selectedDupes), {
      title: `${selectedDupes.size} Duplicate Word${selectedDupes.size > 1 ? 's' : ''} Found`,
      confirmText: 'Add Anyway',
      cancelText: 'Go Back',
      confirmClass: 'btn-warning',
    });
    if (!ok) return;
  }

  bulkBtnAdd.disabled = true;
  bulkStepPreview.classList.add('hidden');
  bulkAdding.classList.remove('hidden');

  let added = 0;
  for (const word of toAdd) {
    bulkAddingText.textContent = `Adding words… ${added + 1} / ${toAdd.length}`;
    try {
      await addWord(topicId, word);
      added++;
    } catch (err) {
      console.error(`Failed to add "${word.english}":`, err);
    }
  }

  bulkAdding.classList.add('hidden');
  closeModal(modalBulkAdd);

  if (added > 0) {
    showToast(`${added} word${added > 1 ? 's' : ''} added!`, 'success');
    renderVocabulary();
  }
  if (added < toAdd.length) {
    showToast(`${toAdd.length - added} word(s) failed to add.`, 'error');
  }
});

// ---- State ----
let allWords = [];
let editingWordId = null;
let topicName = '';

const sortWordsSelect = document.getElementById('sort-words');

function sortWords(words) {
  const val = sortWordsSelect.value;
  const arr = [...words];
  if (val === 'name-az') {
    arr.sort((a, b) => a.english.localeCompare(b.english));
  } else if (val === 'name-za') {
    arr.sort((a, b) => b.english.localeCompare(a.english));
  } else if (val === 'newest') {
    arr.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
  } else if (val === 'oldest') {
    arr.sort((a, b) => (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0));
  }
  // 'input-order' keeps default order from loadWords()
  return arr;
}

sortWordsSelect.addEventListener('change', renderFilteredWords);

// ============================================================
// TABS
// ============================================================
document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`panel-${btn.dataset.tab}`).classList.add('active');

    // Lazy-load paragraphs the first time
    if (btn.dataset.tab === 'paragraphs' && !parasLoaded) {
      renderParagraphs();
    }
  });
});

// ============================================================
// LOAD TOPIC INFO
// ============================================================
async function loadTopicInfo() {
  try {
    const topic = await getTopic(topicId);
    if (!topic) {
      showToast('Topic not found.', 'error');
      navigateTo('topics.html');
      return;
    }
    topicName = topic.name;
    breadcrumbTopic.textContent = topic.name;
    detailTitle.textContent = topic.name;
    document.title = `WordCraft — ${topic.name}`;
  } catch (err) {
    console.error(err);
    showToast('Failed to load topic info.', 'error');
  }
}

// ============================================================
// VOCABULARY
// ============================================================
const WORD_TYPE_LABELS = {
  noun: 'Noun', verb: 'Verb', adj: 'Adjective',
  adv: 'Adverb', phrase: 'Phrase', other: 'Other',
};

function badgeClass(type) {
  return `badge badge-${type || 'other'}`;
}

async function renderVocabulary() {
  vocabLoading.classList.remove('hidden');
  vocabEmpty.classList.add('hidden');
  vocabWrapper.classList.add('hidden');

  try {
    allWords = await loadWords(topicId);
    vocabLoading.classList.add('hidden');

    // Update word count badge in header
    detailWordBadge.textContent = `${allWords.length} word${allWords.length !== 1 ? 's' : ''}`;
    detailWordBadge.classList.remove('hidden');

    renderFilteredWords();
    updateLearnedProgress();
  } catch (err) {
    console.error(err);
    vocabLoading.classList.add('hidden');
    showToast('Failed to load vocabulary.', 'error');
  }
}

function renderFilteredWords() {
  const query = vocabSearch.value.trim().toLowerCase();
  const filtered = query
    ? allWords.filter((w) =>
        w.english.toLowerCase().includes(query) ||
        w.vietnamese.toLowerCase().includes(query)
      )
    : allWords;
  const sorted = sortWords(filtered);

  if (sorted.length === 0) {
    vocabEmpty.classList.remove('hidden');
    vocabWrapper.classList.add('hidden');
    return;
  }

  vocabEmpty.classList.add('hidden');
  vocabWrapper.classList.remove('hidden');

  vocabTbody.innerHTML = sorted.map((w) => {
    const ipaUS = w.ipaUS || w.ipa || '';
    const ipaUK = w.ipaUK || '';
    const ipaHtml = (ipaUS || ipaUK)
      ? `<span class="ipa-us" title="US">${escapeHtml(ipaUS)}</span>`
        + (ipaUK ? `<span class="ipa-uk" title="UK">${escapeHtml(ipaUK)}</span>` : '')
      : '<span class="vocab-missing">—</span>';
    const isLearned = !!w.learned;
    return `
    <tr data-id="${w.id}" class="swipe-row${isLearned ? ' word-learned' : ''}">
      <td style="text-align:center">
        <button class="btn-learned${isLearned ? ' learned' : ''}" data-word-id="${w.id}" title="${isLearned ? 'Mark as not learned' : 'Mark as learned'}" type="button">
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24"
               fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </button>
      </td>
      <td class="vocab-english">
        <div class="vocab-english-inner">
          <span class="vocab-english-word">${escapeHtml(w.english)}</span>
          <button class="btn-speak" data-word="${escapeHtml(w.english)}" title="Listen (US)" type="button">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24"
                 fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
            </svg>
          </button>
          <button class="btn-ai-insights" data-word-id="${w.id}" title="AI Insights" type="button">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24"
                 fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.582a.5.5 0 0 1 0 .963L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
              <path d="M20 3v4"/><path d="M22 5h-4"/>
            </svg>
          </button>
        </div>
      </td>
      <td class="vocab-ipa">${ipaHtml}</td>
      <td class="vocab-vietnamese">${escapeHtml(w.vietnamese)}</td>
      <td class="vocab-desc" title="${escapeHtml(w.description || '')}">${w.description ? escapeHtml(w.description) : '<span class="vocab-missing">—</span>'}</td>
      <td><span class="${badgeClass(w.wordType)}">${WORD_TYPE_LABELS[w.wordType] || w.wordType}</span></td>
      <td class="swipe-delete-cell">
        <div class="swipe-delete-btn">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
               fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6"/><path d="M14 11v6"/>
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
          </svg>
          Delete
        </div>
      </td>
    </tr>
  `;
  }).join('');

  // Re-attach swipe handlers after re-render
  initSwipeHandlers();
}

// ---- Learned progress display ----
function updateLearnedProgress() {
  if (allWords.length === 0) {
    learnedProgressEl.classList.add('hidden');
    return;
  }
  const learnedCount = allWords.filter(w => !!w.learned).length;
  const total = allWords.length;
  const pct = Math.round((learnedCount / total) * 100);
  learnedProgressFill.style.width = `${pct}%`;
  learnedProgressText.textContent = `${learnedCount}/${total} learned`;
  learnedProgressEl.classList.remove('hidden');
  if (learnedCount === total) {
    learnedProgressEl.classList.add('completed');
  } else {
    learnedProgressEl.classList.remove('completed');
  }
}

// ---- Learned toggle handler ----
vocabTbody.addEventListener('click', async (e) => {
  const btn = e.target.closest('.btn-learned');
  if (!btn) return;
  e.stopPropagation();
  const wordId = btn.dataset.wordId;
  const word = allWords.find(w => w.id === wordId);
  if (!word) return;

  const newLearned = !word.learned;
  // Optimistic UI update
  word.learned = newLearned;
  btn.classList.toggle('learned', newLearned);
  btn.title = newLearned ? 'Mark as not learned' : 'Mark as learned';
  const row = btn.closest('tr');
  if (row) row.classList.toggle('word-learned', newLearned);
  updateLearnedProgress();

  try {
    await toggleWordLearned(topicId, wordId, newLearned);
    updateStreakBadge();
    // Show daily encouragement toast on first activity of the day
    const encourage = sessionStorage.getItem('streak_daily_encourage');
    if (encourage) {
      sessionStorage.removeItem('streak_daily_encourage');
      showToast(encourage, 'success', 3000);
    }
  } catch (err) {
    console.error('Failed to toggle learned:', err);
    // Revert
    word.learned = !newLearned;
    btn.classList.toggle('learned', !newLearned);
    if (row) row.classList.toggle('word-learned', !newLearned);
    updateLearnedProgress();
    showToast('Failed to update word status.', 'error');
  }
});

// Search
vocabSearch.addEventListener('input', renderFilteredWords);

// ---- TTS (Text-to-Speech) ----
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
window.speechSynthesis.addEventListener('voiceschanged', _loadTTSVoice);

function speakWord(word) {
  if (!('speechSynthesis' in window)) {
    showToast('Text-to-speech is not supported in this browser.', 'warning');
    return;
  }
  function _doSpeak() {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    if (_ttsVoice) utterance.voice = _ttsVoice;
    window.speechSynthesis.speak(utterance);
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

// Speak button delegation
vocabTbody.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn-speak');
  if (!btn) return;
  e.stopPropagation();
  speakWord(btn.dataset.word);
});

// ---- AI Insights Panel ----
function renderInsightsPanel(word) {
  const ins = word.aiInsights;
  if (!ins) return '<div class="insights-panel"><p>No insights available.</p></div>';

  const escHtml = (s) => escapeHtml(s || '');

  const registerLabel = { formal: 'Formal', informal: 'Informal', neutral: 'Neutral' };
  const registerClass = { formal: 'tag-formal', informal: 'tag-informal', neutral: 'tag-neutral' };

  let html = '<div class="insights-panel">';

  // Header with register badge + usage note
  html += '<div class="insights-header">';
  html += `<span class="insights-register ${registerClass[ins.register] || 'tag-neutral'}">${registerLabel[ins.register] || 'Neutral'}</span>`;
  if (ins.countability) {
    html += `<span class="insights-tag">${escHtml(ins.countability)}</span>`;
  }
  if (ins.usageNote) {
    html += `<p class="insights-usage-note">${escHtml(ins.usageNote)}</p>`;
  }
  html += '</div>';

  html += '<div class="insights-grid">';

  // Synonyms
  if (ins.synonyms?.length) {
    html += '<div class="insights-section"><h4>Synonyms</h4><div class="insights-tags">';
    ins.synonyms.forEach(s => {
      html += `<span class="insights-tag" title="${escHtml(s.vietnamese)}">${escHtml(s.word)} <small>${escHtml(s.vietnamese)}</small></span>`;
    });
    html += '</div></div>';
  }

  // Antonyms
  if (ins.antonyms?.length) {
    html += '<div class="insights-section"><h4>Antonyms</h4><div class="insights-tags">';
    ins.antonyms.forEach(s => {
      html += `<span class="insights-tag tag-antonym" title="${escHtml(s.vietnamese)}">${escHtml(s.word)} <small>${escHtml(s.vietnamese)}</small></span>`;
    });
    html += '</div></div>';
  }

  // Collocations
  if (ins.collocations?.length) {
    html += '<div class="insights-section"><h4>Collocations</h4><div class="insights-tags">';
    ins.collocations.forEach(c => {
      html += `<span class="insights-tag tag-collocation">${escHtml(c)}</span>`;
    });
    html += '</div></div>';
  }

  // Word Family
  if (ins.wordFamily?.length) {
    html += '<div class="insights-section"><h4>Word Family</h4><div class="insights-tags">';
    ins.wordFamily.forEach(w => {
      html += `<span class="insights-tag tag-family"><strong>${escHtml(w.word)}</strong> <small>(${escHtml(w.wordType)}) ${escHtml(w.vietnamese)}</small></span>`;
    });
    html += '</div></div>';
  }

  // Example Sentences
  if (ins.exampleSentences?.length) {
    html += '<div class="insights-section insights-section-full"><h4>Example Sentences</h4>';
    ins.exampleSentences.forEach(ex => {
      html += `<div class="insights-example">
        <span class="insights-level">${escHtml(ex.level)}</span>
        <p class="insights-example-en">${escHtml(ex.english)}</p>
        <p class="insights-example-vi">${escHtml(ex.vietnamese)}</p>
      </div>`;
    });
    html += '</div>';
  }

  // Grammar Patterns
  if (ins.grammarPatterns?.length) {
    html += '<div class="insights-section"><h4>Grammar Patterns</h4><div class="insights-tags">';
    ins.grammarPatterns.forEach(p => {
      html += `<span class="insights-tag tag-grammar">${escHtml(p)}</span>`;
    });
    html += '</div></div>';
  }

  // Phrasal Verbs
  if (ins.phrasalVerbs?.length) {
    html += '<div class="insights-section"><h4>Phrasal Verbs</h4><div class="insights-tags">';
    ins.phrasalVerbs.forEach(p => {
      html += `<span class="insights-tag tag-phrasal">${escHtml(p.phrase)} <small>${escHtml(p.meaning)}</small></span>`;
    });
    html += '</div></div>';
  }

  // Common Mistakes
  if (ins.commonMistakes?.length) {
    html += '<div class="insights-section insights-section-full"><h4>Common Mistakes</h4>';
    ins.commonMistakes.forEach(m => {
      html += `<div class="insights-mistake">
        <span class="mistake-wrong">${escHtml(m.wrong)}</span>
        <span class="mistake-arrow">→</span>
        <span class="mistake-correct">${escHtml(m.correct)}</span>
        <p class="mistake-explanation">${escHtml(m.explanation)}</p>
      </div>`;
    });
    html += '</div>';
  }

  // Confused With
  if (ins.confusedWith?.length) {
    html += '<div class="insights-section"><h4>Confused With</h4>';
    ins.confusedWith.forEach(c => {
      html += `<div class="insights-confused">
        <strong>${escHtml(c.word)}</strong>
        <p>${escHtml(c.difference)}</p>
      </div>`;
    });
    html += '</div>';
  }

  html += '</div>'; // close grid

  // Cached timestamp + refresh
  if (word.aiInsightsGeneratedAt) {
    const date = word.aiInsightsGeneratedAt.toDate
      ? word.aiInsightsGeneratedAt.toDate()
      : new Date(word.aiInsightsGeneratedAt);
    html += `<div class="insights-footer">
      <span class="insights-cached-time">Generated ${date.toLocaleDateString()}</span>
      <button class="btn-insights-refresh" data-word-id="${word.id}" type="button">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24"
             fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
        </svg>
        Refresh
      </button>
    </div>`;
  }

  html += '</div>';
  return html;
}

function createInsightsRow(word) {
  const tr = document.createElement('tr');
  tr.className = 'insights-row';
  tr.dataset.insightsFor = word.id;
  tr.innerHTML = `<td colspan="7">${renderInsightsPanel(word)}</td>`;
  return tr;
}

function createLoadingInsightsRow(wordId) {
  const tr = document.createElement('tr');
  tr.className = 'insights-row';
  tr.dataset.insightsFor = wordId;
  tr.innerHTML = `<td colspan="7">
    <div class="insights-panel insights-loading">
      <div class="insights-skeleton"></div>
      <div class="insights-skeleton short"></div>
      <div class="insights-skeleton"></div>
      <div class="insights-skeleton shorter"></div>
    </div>
  </td>`;
  return tr;
}

function closeAllInsightsRows() {
  vocabTbody.querySelectorAll('.insights-row').forEach(r => r.remove());
  vocabTbody.querySelectorAll('.btn-ai-insights.active').forEach(b => b.classList.remove('active'));
}

async function handleInsightsClick(wordId, btn, forceRefresh = false) {
  const word = allWords.find(w => w.id === wordId);
  if (!word) return;

  // Update chat context to reflect the word the user is inspecting
  chatFocusWord = word;

  // Toggle off if already open and not forcing refresh
  const existing = vocabTbody.querySelector(`.insights-row[data-insights-for="${wordId}"]`);
  if (existing && !forceRefresh) {
    existing.remove();
    btn.classList.remove('active');
    return;
  }

  // Close any other open insights
  closeAllInsightsRows();
  btn.classList.add('active');

  const wordRow = vocabTbody.querySelector(`tr[data-id="${wordId}"]`);
  if (!wordRow) return;

  // If cached and not refreshing, show immediately
  if (word.aiInsights && !forceRefresh) {
    const insRow = createInsightsRow(word);
    wordRow.after(insRow);
    return;
  }

  // Show loading
  const loadingRow = createLoadingInsightsRow(wordId);
  wordRow.after(loadingRow);
  btn.querySelector('svg').classList.add('spin');

  try {
    const insights = await generateWordInsights(word, topicName);
    await saveWordInsights(topicId, wordId, insights);

    // Update local cache
    word.aiInsights = insights;
    word.aiInsightsGeneratedAt = new Date();

    // Replace loading with actual content
    const currentLoading = vocabTbody.querySelector(`.insights-row[data-insights-for="${wordId}"]`);
    if (currentLoading) {
      const insRow = createInsightsRow(word);
      currentLoading.replaceWith(insRow);
    }
  } catch (err) {
    console.error('Failed to generate insights:', err);
    showToast('Failed to generate AI insights. ' + (err.message || ''), 'error');
    const currentLoading = vocabTbody.querySelector(`.insights-row[data-insights-for="${wordId}"]`);
    if (currentLoading) currentLoading.remove();
    btn.classList.remove('active');
  } finally {
    btn.querySelector('svg').classList.remove('spin');
  }
}

// AI Insights button delegation
vocabTbody.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn-ai-insights');
  if (!btn) return;
  e.stopPropagation();
  handleInsightsClick(btn.dataset.wordId, btn);
});

// Refresh button inside insights panel
vocabTbody.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn-insights-refresh');
  if (!btn) return;
  e.stopPropagation();
  const wordId = btn.dataset.wordId;
  const sparkleBtn = vocabTbody.querySelector(`.btn-ai-insights[data-word-id="${wordId}"]`);
  if (sparkleBtn) handleInsightsClick(wordId, sparkleBtn, true);
});

// Flag to suppress click-to-edit after any drag gesture
let swipeDragOccurred = false;

// Row click → open edit modal
vocabTbody.addEventListener('click', (e) => {
  // Ignore clicks on action buttons, insights rows, or delete buttons
  if (e.target.closest('.btn-speak') || e.target.closest('.btn-ai-insights') || e.target.closest('.btn-learned') || e.target.closest('.insights-row') || e.target.closest('.swipe-delete-btn')) return;
  // Suppress if a drag just happened
  if (swipeDragOccurred) { swipeDragOccurred = false; return; }
  const row = e.target.closest('tr[data-id]');
  if (!row) return;
  // Don't open modal if the row was swiped
  if (row.classList.contains('swiped')) return;
  const id = row.dataset.id;
  const word = allWords.find((w) => w.id === id);
  if (!word) return;
  chatFocusWord = word;
  editingWordId = id;
  modalWordTitle.textContent = 'Edit Word';
  btnWordSave.textContent = 'Save';
  inputEnglish.value     = word.english;
  inputVietnamese.value  = word.vietnamese;
  inputIpaUS.value       = word.ipaUS || word.ipa || '';
  inputIpaUK.value       = word.ipaUK || '';
  inputWordType.value    = word.wordType || 'other';
  inputDescription.value = word.description || '';
  showModal(modalWordOverlay);
});

// ---- Swipe-to-delete gesture ----
function initSwipeHandlers() {
  const rows = vocabTbody.querySelectorAll('.swipe-row:not(.insights-row)');
  rows.forEach(row => {
    let startX = 0, currentX = 0, isSwiping = false;
    const SWIPE_THRESHOLD = 70;

    const deleteBtn = row.querySelector('.swipe-delete-btn');

    // Delete action
    deleteBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = row.dataset.id;
      const word = allWords.find(w => w.id === id);
      const name = word ? word.english : '';
      const ok = await confirmDialog(
        `Delete the word "${name}"?`,
        { title: 'Delete Word', confirmText: 'Delete' }
      );
      if (!ok) {
        resetSwipe(row);
        return;
      }
      try {
        await deleteWord(topicId, id, !!word?.learned);
        showToast('Word deleted.', 'success');
        renderVocabulary();
      } catch (err) {
        console.error(err);
        showToast('Failed to delete word.', 'error');
      }
    });

    // Touch events
    row.addEventListener('touchstart', (e) => {
      vocabTbody.querySelectorAll('.swipe-row.swiped').forEach(r => {
        if (r !== row) resetSwipe(r);
      });
      startX = e.touches[0].clientX;
      currentX = startX;
      isSwiping = true;
      row.style.transition = 'none';
    }, { passive: true });

    row.addEventListener('touchmove', (e) => {
      if (!isSwiping) return;
      currentX = e.touches[0].clientX;
      const diff = startX - currentX;
      if (Math.abs(startX - currentX) > 5) swipeDragOccurred = true;
      if (diff > 0) {
        const shift = Math.min(diff, 100);
        setCellsTransform(row, -shift);
      } else if (!row.classList.contains('swiped')) {
        setCellsTransform(row, 0);
      }
    }, { passive: true });

    row.addEventListener('touchend', () => {
      if (!isSwiping) return;
      isSwiping = false;
      const diff = startX - currentX;
      row.style.transition = '';
      if (diff >= SWIPE_THRESHOLD) {
        row.classList.add('swiped');
        setCellsTransform(row, -80);
      } else {
        resetSwipe(row);
      }
    });

    // Mouse events for desktop
    let mouseDown = false;
    row.addEventListener('mousedown', (e) => {
      if (e.target.closest('.btn-speak') || e.target.closest('.swipe-delete-btn')) return;
      vocabTbody.querySelectorAll('.swipe-row.swiped').forEach(r => {
        if (r !== row) resetSwipe(r);
      });
      startX = e.clientX;
      currentX = startX;
      mouseDown = true;
      isSwiping = false;
      row.style.transition = 'none';
    });

    row.addEventListener('mousemove', (e) => {
      if (!mouseDown) return;
      currentX = e.clientX;
      const diff = startX - currentX;
      if (Math.abs(diff) > 5) { isSwiping = true; swipeDragOccurred = true; }
      if (diff > 0) {
        const shift = Math.min(diff, 100);
        setCellsTransform(row, -shift);
      } else if (!row.classList.contains('swiped')) {
        setCellsTransform(row, 0);
      }
    });

    row.addEventListener('mouseup', () => {
      if (!mouseDown) return;
      mouseDown = false;
      const diff = startX - currentX;
      row.style.transition = '';
      if (diff >= SWIPE_THRESHOLD) {
        row.classList.add('swiped');
        setCellsTransform(row, -80);
      } else {
        resetSwipe(row);
      }
    });

    row.addEventListener('mouseleave', () => {
      if (mouseDown) {
        mouseDown = false;
        const diff = startX - currentX;
        row.style.transition = '';
        if (diff >= SWIPE_THRESHOLD) {
          row.classList.add('swiped');
          setCellsTransform(row, -80);
        } else {
          resetSwipe(row);
        }
      }
    });
  });
}

function setCellsTransform(row, px) {
  row.querySelectorAll('td:not(.swipe-delete-cell)').forEach(td => {
    td.style.transform = `translateX(${px}px)`;
    td.style.transition = px === 0 || Math.abs(px) === 80 ? 'transform 0.25s ease' : 'none';
  });
  const delBtn = row.querySelector('.swipe-delete-btn');
  if (delBtn) {
    delBtn.style.opacity = Math.min(Math.abs(px) / 60, 1);
  }
}

function resetSwipe(row) {
  row.classList.remove('swiped');
  setCellsTransform(row, 0);
}

// Close swiped rows when clicking elsewhere
document.addEventListener('click', (e) => {
  if (!e.target.closest('.vocab-table')) {
    vocabTbody.querySelectorAll('.swipe-row.swiped').forEach(r => resetSwipe(r));
  }
});

// Add word button
btnAddWord.addEventListener('click', () => {
  editingWordId = null;
  modalWordTitle.textContent = 'Add Word';
  btnWordSave.textContent = 'Add';
  formWord.reset();
  showModal(modalWordOverlay);
});

// ---- Duplicate word warning helpers ----
function buildDuplicateWarningHtml(duplicatesMap) {
  let html = '<div style="font-size:0.9rem;line-height:1.7">';
  html += '<p style="margin-bottom:10px">The following word(s) already exist:</p>';
  html += '<ul style="list-style:none;padding:0;margin:0 0 10px 0">';
  for (const [word, locations] of duplicatesMap) {
    const locs = locations.map(l => {
      const label = l.isCurrent ? `<strong>${escapeHtml(l.topicName)}</strong> (this topic)` : `<strong>${escapeHtml(l.topicName)}</strong>`;
      return label;
    }).join(', ');
    html += `<li style="padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.06)">` +
      `<span style="color:var(--color-warning,#F2D07A);font-weight:600">${escapeHtml(word)}</span> — ${locs}</li>`;
  }
  html += '</ul>';
  html += '<p style="color:var(--color-text-light)">Do you still want to add?</p>';
  html += '</div>';
  return html;
}

// Word form submit
formWord.addEventListener('submit', async (e) => {
  e.preventDefault();
  const rawEnglish = inputEnglish.value.trim();
  const data = {
    english:     rawEnglish.toLowerCase(),
    vietnamese:  inputVietnamese.value.trim(),
    ipaUS:       inputIpaUS.value.trim(),
    ipaUK:       inputIpaUK.value.trim(),
    wordType:    inputWordType.value,
    description: inputDescription.value.trim(),
  };

  if (rawEnglish !== data.english) {
    inputEnglish.value = data.english;
    showToast('Converted to lowercase.', 'info');
  }

  if (!data.english || !data.vietnamese) {
    showToast('English and Vietnamese fields are required.', 'warning');
    return;
  }

  const originalSaveText = btnWordSave.textContent;
  btnWordSave.disabled = true;
  btnWordSave.textContent = editingWordId ? 'Saving…' : 'Adding…';
  try {
    // Check for duplicates when adding a new word (not editing)
    if (!editingWordId) {
      btnWordSave.textContent = 'Checking…';
      const dupes = await findDuplicateWords([data.english], topicId);
      if (dupes.size > 0) {
        btnWordSave.disabled = false;
        btnWordSave.textContent = originalSaveText;
        const ok = await confirmDialogHtml(buildDuplicateWarningHtml(dupes), {
          title: 'Duplicate Word Found',
          confirmText: 'Add Anyway',
          cancelText: 'Cancel',
          confirmClass: 'btn-warning',
        });
        if (!ok) return;
        btnWordSave.disabled = true;
        btnWordSave.textContent = 'Adding…';
      }
    }

    if (editingWordId) {
      await updateWord(topicId, editingWordId, data);
      showToast('Word updated.', 'success');
    } else {
      await addWord(topicId, data);
      showToast('Word added!', 'success');
    }
    closeModal(modalWordOverlay);
    renderVocabulary();
  } catch (err) {
    console.error(err);
    showToast('Operation failed.', 'error');
  } finally {
    btnWordSave.disabled = false;
    btnWordSave.textContent = originalSaveText;
  }
});

// ============================================================
// PARAGRAPH HELPERS
// ============================================================

/** Split text into sentences (by . ! ?) */
function splitSentences(text) {
  const result = text.match(/[^.!?]*[.!?]+[\s]*/g);
  if (!result) return [text];
  const joined = result.join('');
  if (joined.length < text.length) {
    const remaining = text.slice(joined.length).trim();
    if (remaining) result.push(remaining);
  }
  return result.map(s => s.trim()).filter(s => s.length > 0);
}

/** Highlight vocabulary words in raw text, returning safe HTML. */
function highlightVocabWords(text, words) {
  if (!words || words.length === 0) return escapeHtml(text);
  const sorted = [...words].sort((a, b) => b.length - a.length);
  const escaped = sorted.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(`\\b(${escaped.join('|')})\\b`, 'gi');
  let result = '';
  let lastIndex = 0;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    result += escapeHtml(text.slice(lastIndex, match.index));
    result += `<strong class="vocab-highlight">${escapeHtml(match[0])}</strong>`;
    lastIndex = pattern.lastIndex;
  }
  result += escapeHtml(text.slice(lastIndex));
  return result;
}

/** Build sentence-wrapped HTML for English text with vocab highlights. */
function buildEnglishHtml(text, wordsToHighlight) {
  const vocabWords = Array.isArray(wordsToHighlight) && wordsToHighlight.length > 0
    ? wordsToHighlight
    : allWords.map(w => w.english);
  const sentences = splitSentences(text);
  return sentences.map((s, i) =>
    `<span class="para-sentence" data-sentence="${i}">${highlightVocabWords(s, vocabWords)}</span>`
  ).join(' ');
}

/** Build sentence-wrapped HTML for Vietnamese text. */
function buildVietnameseHtml(text) {
  const sentences = splitSentences(text);
  return sentences.map((s, i) =>
    `<span class="para-sentence-vi" data-sentence="${i}">${escapeHtml(s)}</span>`
  ).join(' ');
}

// ============================================================
// PARAGRAPHS
// ============================================================
let parasLoaded = false;

async function renderParagraphs() {
  paraLoading.classList.remove('hidden');
  paraEmpty.classList.add('hidden');
  paraList.classList.add('hidden');

  try {
    const paragraphs = await loadParagraphs(topicId);
    parasLoaded = true;
    paraLoading.classList.add('hidden');

    paraCount.textContent = paragraphs.length
      ? `${paragraphs.length} paragraph${paragraphs.length !== 1 ? 's' : ''}`
      : '';

    if (paragraphs.length === 0) {
      paraEmpty.classList.remove('hidden');
      return;
    }

    paraList.innerHTML = paragraphs.map((p) => {
      // Build word badges if usedWords was saved
      let wordBadgesHtml = '';
      if (Array.isArray(p.usedWords) && p.usedWords.length > 0) {
        const badges = p.usedWords.map(w => {
          const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const found = new RegExp(`\\b${escaped}\\b`, 'i').test(p.englishText);
          const cls = found ? 'badge-word-used' : 'badge-word-missed';
          const wordObj = allWords.find(aw => aw.english.toLowerCase() === w.toLowerCase());
          const meaning = wordObj ? escapeHtml(wordObj.vietnamese) : '';
          return `<span class="para-word-badge ${cls}" data-meaning="${meaning}">${escapeHtml(w)}</span>`;
        }).join('');
        wordBadgesHtml = `<div class="para-words-row">${badges}</div>`;
      }

      return `
      <div class="card para-card" data-id="${p.id}">
        <div class="para-card-header">
          <span>${p.createdAt ? formatDate(p.createdAt) : 'Just now'}</span>
          <button class="btn-icon" data-action="delete-para" data-id="${p.id}" title="Delete paragraph">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24"
                 fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6"/><path d="M14 11v6"/>
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
          </button>
        </div>${wordBadgesHtml}
        <div class="para-card-body">
          <div class="para-section">
            <div class="para-section-label">English</div>
            <p class="para-english">${buildEnglishHtml(p.englishText, p.usedWords)}</p>
          </div>
          <div class="para-section">
            <div class="para-section-label">Vietnamese</div>
            <p class="para-vietnamese">${buildVietnameseHtml(p.vietnameseText)}</p>
          </div>
        </div>
      </div>
    `;
    }).join('');

    paraList.classList.remove('hidden');

  } catch (err) {
    console.error(err);
    paraLoading.classList.add('hidden');
    showToast('Failed to load paragraphs.', 'error');
  }
}

// Word badge click → show Vietnamese meaning popover
paraList.addEventListener('click', (e) => {
  const badge = e.target.closest('.para-word-badge[data-meaning]');
  const existing = paraList.querySelector('.badge-popover');
  if (existing) existing.remove();
  if (!badge || !badge.dataset.meaning) return;
  const pop = document.createElement('span');
  pop.className = 'badge-popover';
  pop.textContent = badge.dataset.meaning;
  badge.appendChild(pop);
  const dismiss = () => { pop.remove(); document.removeEventListener('click', onOutside); };
  const onOutside = (ev) => { if (!badge.contains(ev.target)) dismiss(); };
  setTimeout(() => document.addEventListener('click', onOutside), 0);
  setTimeout(dismiss, 4000);
});

// Paragraph delegation
paraList.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-action="delete-para"]');
  if (!btn) return;

  const id = btn.dataset.id;
  const ok = await confirmDialog(
    'Delete this paragraph?',
    { title: 'Delete Paragraph', confirmText: 'Delete' }
  );
  if (!ok) return;

  try {
    await deleteParagraph(topicId, id);
    showToast('Paragraph deleted.', 'success');
    renderParagraphs();
  } catch (err) {
    console.error(err);
    showToast('Failed to delete paragraph.', 'error');
  }
});

// Sentence click → highlight corresponding Vietnamese sentence
paraList.addEventListener('click', (e) => {
  const sentenceEl = e.target.closest('.para-sentence');
  if (!sentenceEl) return;

  const card = sentenceEl.closest('.para-card');
  const idx = sentenceEl.dataset.sentence;

  const wasActive = sentenceEl.classList.contains('en-active');

  card.querySelectorAll('.para-sentence').forEach(el => el.classList.remove('en-active'));
  card.querySelectorAll('.para-sentence-vi').forEach(el => el.classList.remove('vi-active'));

  if (!wasActive) {
    sentenceEl.classList.add('en-active');
    const viEl = card.querySelector(`.para-sentence-vi[data-sentence="${idx}"]`);
    if (viEl) viEl.classList.add('vi-active');
  }
});

// Generate with AI — open word selection modal
btnGenerateAI.addEventListener('click', () => openWordSelectModal());

// Confirm generation from modal
wsBtnGenerate.addEventListener('click', async () => {
  const selectedWords = getSelectedWords();
  if (selectedWords.length === 0) return;
  const customInstruction = (wsCustomInstruction.value || '').trim();

  const selectedWordObjects = selectedWords.map(w => {
    const found = allWords.find(a => a.english === w);
    return { word: w, wordType: found?.wordType || 'other' };
  });

  closeModal(modalWordSelect);
  btnGenerateAI.disabled = true;
  aiGeneratingEl.classList.remove('hidden');

  try {
    const result = await generateParagraph(selectedWordObjects, customInstruction, topicName);

    await saveParagraph(topicId, {
      englishText:    result.english,
      vietnameseText: result.vietnamese,
      usedWords:      selectedWords,
      customInstruction,
    });

    showToast('Paragraph generated and saved!', 'success');
    renderParagraphs();

  } catch (err) {
    console.error(err);
    showToast(err.message || 'Failed to generate paragraph.', 'error');
  } finally {
    btnGenerateAI.disabled = false;
    aiGeneratingEl.classList.add('hidden');
  }
});

// ============================================================
// INIT
// ============================================================
loadTopicInfo();
renderVocabulary();
