/* ============================================================
   SENTENCE TOPIC DETAIL PAGE CONTROLLER
   Sentence table CRUD, swipe-to-delete, bulk add (AI),
   and an EN<->VI translation practice session.
   ============================================================ */

import { initProtectedPage } from '../shared/page-init.js';
import {
  getSentenceTopic,
  loadSentences,
  addSentence,
  updateSentence,
  deleteSentence,
  toggleSentenceLearned,
  findDuplicateSentences,
  saveSentenceInsights,
} from '../features/sentence-topics.js';
import { generateSentenceInfo, generateBulkSentenceInfo, generateSentenceInsights } from '../ai/sentence-ai.js';
import { isExactMatch, calculateAccuracy } from '../features/sentence-grading.js';
import { getMilestoneMessage } from '../features/streak.js';
import {
  showModal, closeModal, setupModalClose,
  showToast, confirmDialog, confirmDialogHtml, escapeHtml, showMilestoneModal,
} from '../ui/index.js';
import {
  updateBulkCounter,
  setupBulkPreviewHandlers,
  buildDupeRowHtml,
  buildDuplicateWarningHtml,
} from '../shared/bulk-add-utils.js';
import { handleStreakRecord } from '../shared/streak-handler.js';
import { loadStreak } from '../features/streak.js';
import { maybeNotifyFreezeUsed } from '../shared/streak-handler.js';
import { initChatWidget } from '../chat/chat-ui.js';
import { speakText } from '../shared/tts.js';
import { shuffle } from '../shared/shuffle.js';
import { buildResultHtml } from '../shared/result-builder.js';

// ---- Auth, Firebase, navbar, topicId ----
const { topicId } = initProtectedPage({ requireTopicId: true });

// ---- Chat widget ----
initChatWidget(() => ({
  page: 'Sentence Patterns',
  words: allSentences.map(s => ({ english: s.english, vietnamese: s.vietnamese })),
}));

// ---- Navbar streak badge refresh (mirrors word-forms-page.js's updateStreakBadge) ----
function updateStreakBadge() {
  loadStreak().then(data => {
    const el = document.getElementById('navbar-streak');
    const countEl = document.getElementById('navbar-streak-count');
    if (el && countEl) {
      if (data.currentStreak > 0 || data.isActiveToday) {
        countEl.textContent = data.currentStreak;
        el.style.display = '';
      } else {
        el.style.display = 'none';
      }
    }
    maybeNotifyFreezeUsed(data);
  }).catch(() => {});
}

// ---- Modal close setup ----
setupModalClose('#modal-sentence');
setupModalClose('#modal-bulk-sp');

// ---- DOM refs: header ----
const spTopicNameCrumb  = document.getElementById('sp-topic-name-crumb');
const spTopicName       = document.getElementById('sp-topic-name');
const spSentenceBadge   = document.getElementById('sp-sentence-badge');
const spLearnedProgress = document.getElementById('sp-learned-progress');
const spLearnedFill     = document.getElementById('sp-learned-fill');
const spLearnedText     = document.getElementById('sp-learned-text');

// ---- DOM refs: loading/content ----
const spLoading = document.getElementById('sp-loading');
const spContent = document.getElementById('sp-content');

// ---- DOM refs: table tab ----
const spEmpty         = document.getElementById('sp-empty');
const spTableWrapper  = document.getElementById('sp-table-wrapper');
const spTbody         = document.getElementById('sp-tbody');
const spSearchInput   = document.getElementById('sp-search-input');
const spSortSelect    = document.getElementById('sp-sort-select');
const btnAddSentence  = document.getElementById('btn-add-sentence');
const btnBulkSentence = document.getElementById('btn-bulk-sentence');
const btnAddSentenceEmpty = document.getElementById('btn-add-sentence-empty');

// ---- DOM refs: add/edit modal ----
const modalSentence   = document.getElementById('modal-sentence');
const modalSpTitle    = document.getElementById('modal-sp-title');
const formSentence    = document.getElementById('form-sentence');
const inputSpSource   = document.getElementById('input-sp-source');
const btnSpAiFill     = document.getElementById('btn-sp-ai-fill');
const inputSpEnglish  = document.getElementById('input-sp-english');
const inputSpVietnamese = document.getElementById('input-sp-vietnamese');
const inputSpPattern  = document.getElementById('input-sp-pattern');
const inputSpLevel    = document.getElementById('input-sp-level');
const btnSpSave       = document.getElementById('btn-sp-save');

// ---- DOM refs: bulk add modal ----
const modalBulkSp          = document.getElementById('modal-bulk-sp');
const bulkSpInput           = document.getElementById('bulk-sp-input');
const bulkSpStepInput       = document.getElementById('bulk-sp-step-input');
const bulkSpStepPreview     = document.getElementById('bulk-sp-step-preview');
const bulkSpLoading         = document.getElementById('bulk-sp-loading');
const bulkSpLoadingText     = document.getElementById('bulk-sp-loading-text');
const bulkSpProgressWrap    = document.getElementById('bulk-sp-progress-wrap');
const bulkSpProgressFill    = document.getElementById('bulk-sp-progress-fill');
const bulkSpProgressCount   = document.getElementById('bulk-sp-progress-count');
const bulkSpAdding          = document.getElementById('bulk-sp-adding');
const bulkSpAddingText      = document.getElementById('bulk-sp-adding-text');
const bulkSpPreviewTbody    = document.getElementById('bulk-sp-preview-tbody');
const bulkSpCounter         = document.getElementById('bulk-sp-counter');
const bulkSpBtnGenerate     = document.getElementById('bulk-sp-btn-generate');
const bulkSpBtnAdd          = document.getElementById('bulk-sp-btn-add');
const bulkSpSelectAll       = document.getElementById('bulk-sp-select-all');
const bulkSpDeselectAll     = document.getElementById('bulk-sp-deselect-all');

// ---- DOM refs: practice tab ----
const spPracticeEmpty  = document.getElementById('sp-practice-empty');
const spPracticeSetup  = document.getElementById('sp-practice-setup');
const spPracticeArea   = document.getElementById('sp-practice-area');
const spResults        = document.getElementById('sp-results');
const spDirectionGroup = document.getElementById('sp-direction-group');
const spScopeGroup     = document.getElementById('sp-scope-group');
const spShuffleToggle  = document.getElementById('sp-shuffle-toggle');
const spCountSelect    = document.getElementById('sp-count-select');
const btnSpStartPractice = document.getElementById('btn-sp-start-practice');
const spProgressFill   = document.getElementById('sp-progress-fill');
const spProgressText   = document.getElementById('sp-progress-text');
const spPracticeCard   = document.getElementById('sp-practice-card');
const spPracticeActions = document.getElementById('sp-practice-actions');

// ---- State ----
let currentTopic = null;
let allSentences = [];
let filteredSentences = [];
let editingSentenceId = null;
let bulkSpResults = [];
let bulkSpDuplicatesMap = new Map();

// Practice setup state
let selectedDirection = 'en-vi';
let selectedScope = 'all';
let selectedShuffle = true;
let selectedCount = 'all';

// Practice session state
let sessionQueue = [];
let sessionIndex = 0;
let sessionScore = 0;
let sessionWrong = [];

// ============================================================
// ICONS
// ============================================================

const CHECKMARK_SVG = `
  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24"
       fill="none" stroke="currentColor" stroke-width="3"
       stroke-linecap="round" stroke-linejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>`;

const SPEAKER_SVG = `
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
       fill="none" stroke="currentColor" stroke-width="2"
       stroke-linecap="round" stroke-linejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
  </svg>`;

const TRASH_SVG = `
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
       fill="none" stroke="currentColor" stroke-width="2"
       stroke-linecap="round" stroke-linejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6"/><path d="M14 11v6"/>
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>`;

const SPARKLE_SVG = `
  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24"
       fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.582a.5.5 0 0 1 0 .963L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
    <path d="M20 3v4"/><path d="M22 5h-4"/>
  </svg>`;

const REFRESH_SVG = `
  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24"
       fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
  </svg>`;

// ============================================================
// SENTENCE-SPECIFIC BULK INPUT PARSER
// (parseBulkInput from bulk-add-utils.js splits on commas AND lowercases —
//  both are wrong for sentences: sentences contain internal commas and must
//  preserve their original case. Custom newline-only parser instead.)
// ============================================================

function parseBulkSentenceLines(text) {
  return [...new Set(
    String(text || '')
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
  )];
}

// ============================================================
// HEADER
// ============================================================

function updateHeader() {
  const total = allSentences.length;
  const learned = allSentences.filter(s => s.learned).length;

  if (spTopicName) spTopicName.textContent = currentTopic?.name || '';
  if (spTopicNameCrumb) spTopicNameCrumb.textContent = currentTopic?.name || '';

  if (spSentenceBadge) {
    spSentenceBadge.textContent = `${total} sentence${total !== 1 ? 's' : ''}`;
    spSentenceBadge.classList.toggle('hidden', total === 0);
  }

  if (!spLearnedProgress) return;

  if (total === 0) {
    spLearnedProgress.classList.add('hidden');
    return;
  }

  const pct = Math.round((learned / total) * 100);
  if (spLearnedFill) spLearnedFill.style.width = `${pct}%`;
  if (spLearnedText) spLearnedText.textContent = `${learned}/${total} learned`;
  spLearnedProgress.classList.remove('hidden');
  spLearnedProgress.classList.toggle('completed', learned === total && total > 0);
}

// ============================================================
// TABS
// ============================================================

document.querySelectorAll('[data-tab]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    if (btn.dataset.tab === 'practice') {
      refreshPracticeTab();
    }
  });
});

// ============================================================
// TABLE RENDERING
// ============================================================

function buildSentenceRowHtml(sentence) {
  return `
    <tr class="swipe-row${sentence.learned ? ' learned-row' : ''}" data-id="${sentence.id}">
      <td>
        <button class="btn-learned${sentence.learned ? ' learned' : ''}"
                data-action="toggle-learned" data-id="${sentence.id}"
                title="${sentence.learned ? 'Mark as not learned' : 'Mark as learned'}"
                type="button">
          ${CHECKMARK_SVG}
        </button>
      </td>
      <td class="vocab-english">
        ${escapeHtml(sentence.english) || '<span class="vocab-missing">—</span>'}
        <button class="btn-speak" data-action="speak" data-word="${escapeHtml(sentence.english)}" title="Listen" type="button">
          ${SPEAKER_SVG}
        </button>
        <button class="btn-ai-insights" data-id="${sentence.id}" title="AI Insights" type="button">
          ${SPARKLE_SVG}
        </button>
      </td>
      <td class="vocab-vietnamese">${sentence.vietnamese ? escapeHtml(sentence.vietnamese) : '<span class="vocab-missing">—</span>'}</td>
      <td class="sp-pattern-cell">${sentence.pattern ? escapeHtml(sentence.pattern) : '<span class="vocab-missing">—</span>'}</td>
      <td>${sentence.level ? `<span class="sp-level-badge">${escapeHtml(sentence.level)}</span>` : '<span class="vocab-missing">—</span>'}</td>
      <td class="swipe-delete-cell">
        <button class="swipe-delete-btn" data-action="delete"
                data-id="${sentence.id}" data-learned="${sentence.learned}" type="button">
          ${TRASH_SVG}
          Delete
        </button>
      </td>
    </tr>
  `;
}

function computeFilteredSentences() {
  const query = spSearchInput ? spSearchInput.value.trim().toLowerCase() : '';
  const sort = spSortSelect ? spSortSelect.value : 'input-order';

  let result = allSentences.filter(s => {
    return !query ||
      (s.english    || '').toLowerCase().includes(query) ||
      (s.vietnamese || '').toLowerCase().includes(query) ||
      (s.pattern    || '').toLowerCase().includes(query);
  });

  if (sort === 'name-az') {
    result = [...result].sort((a, b) => (a.english || '').localeCompare(b.english || ''));
  } else if (sort === 'name-za') {
    result = [...result].sort((a, b) => (b.english || '').localeCompare(a.english || ''));
  } else if (sort === 'learned') {
    result = [...result].sort((a, b) => Number(b.learned) - Number(a.learned));
  }

  return result;
}

function renderFilteredSentences() {
  filteredSentences = computeFilteredSentences();

  if (!spTbody) return;

  if (filteredSentences.length === 0) {
    if (spEmpty) {
      spEmpty.classList.remove('hidden');
      const hasFilter = spSearchInput && spSearchInput.value.trim();
      const emptyTitle = spEmpty.querySelector('h3');
      const emptyDesc = spEmpty.querySelector('p');
      const emptyBtn = spEmpty.querySelector('#btn-add-sentence-empty');
      if (hasFilter && allSentences.length > 0) {
        if (emptyTitle) emptyTitle.textContent = 'No Matching Sentences';
        if (emptyDesc) emptyDesc.textContent = 'Try a different search.';
        if (emptyBtn) emptyBtn.classList.add('hidden');
      } else {
        if (emptyTitle) emptyTitle.textContent = 'No Sentences Yet';
        if (emptyDesc) emptyDesc.textContent = 'Add sentences one by one or use Bulk Add with AI to get started.';
        if (emptyBtn) emptyBtn.classList.remove('hidden');
      }
    }
    if (spTableWrapper) spTableWrapper.classList.add('hidden');
    return;
  }

  if (spEmpty) spEmpty.classList.add('hidden');
  if (spTableWrapper) spTableWrapper.classList.remove('hidden');

  spTbody.innerHTML = filteredSentences.map(buildSentenceRowHtml).join('');
  initSwipeHandlers();
}

async function loadTopicAndSentences() {
  if (spLoading) spLoading.classList.remove('hidden');
  if (spContent) spContent.classList.add('hidden');

  try {
    const [topic, sentences] = await Promise.all([
      getSentenceTopic(topicId),
      loadSentences(topicId),
    ]);
    currentTopic = topic;
    allSentences = sentences;

    if (spLoading) spLoading.classList.add('hidden');
    if (spContent) spContent.classList.remove('hidden');

    updateHeader();
    renderFilteredSentences();
  } catch (err) {
    console.error('Failed to load sentence topic:', err);
    if (spLoading) spLoading.classList.add('hidden');
    showToast('Failed to load sentences. Please try again.', 'error');
  }
}

// ---- Search / sort ----
if (spSearchInput) spSearchInput.addEventListener('input', renderFilteredSentences);
if (spSortSelect)  spSortSelect.addEventListener('change', renderFilteredSentences);

// ============================================================
// SWIPE-TO-DELETE
// ============================================================

function setCellsTransform(row, px) {
  row.querySelectorAll('td:not(.swipe-delete-cell)').forEach(td => {
    td.style.transform = `translateX(${px}px)`;
    td.style.transition = (px === 0 || Math.abs(px) === 80) ? 'transform 0.25s ease' : 'none';
  });
  const delBtn = row.querySelector('.swipe-delete-btn');
  if (delBtn) {
    delBtn.style.opacity = String(Math.min(Math.abs(px) / 60, 1));
  }
}

function resetSwipe(row) {
  row.classList.remove('swiped');
  setCellsTransform(row, 0);
}

let swipeDragOccurred = false;

function initSwipeHandlers() {
  const rows = spTbody.querySelectorAll('.swipe-row');
  rows.forEach(row => {
    let startX = 0, currentX = 0, isSwiping = false;
    const SWIPE_THRESHOLD = 70;

    // Touch events
    row.addEventListener('touchstart', (e) => {
      spTbody.querySelectorAll('.swipe-row.swiped').forEach(r => {
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
      if (Math.abs(diff) > 5) swipeDragOccurred = true;
      if (diff > 0) {
        setCellsTransform(row, -Math.min(diff, 100));
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
      spTbody.querySelectorAll('.swipe-row.swiped').forEach(r => {
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
        setCellsTransform(row, -Math.min(diff, 100));
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
  });
}

// Close swiped rows when clicking outside the table
document.addEventListener('click', (e) => {
  if (!e.target.closest('.wf-table-wrapper')) {
    if (spTbody) {
      spTbody.querySelectorAll('.swipe-row.swiped').forEach(r => resetSwipe(r));
    }
  }
});

// ============================================================
// TABLE — EVENT DELEGATION
// ============================================================

if (spTbody) {
  // Speak button
  spTbody.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="speak"]');
    if (!btn) return;
    e.stopPropagation();
    speakText(btn.dataset.word);
  });

  // Learned toggle
  spTbody.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action="toggle-learned"]');
    if (!btn) return;
    e.stopPropagation();

    const sentenceId = btn.dataset.id;
    const sentence = allSentences.find(s => s.id === sentenceId);
    if (!sentence) return;

    const newLearned = !sentence.learned;

    // Optimistic UI update
    sentence.learned = newLearned;
    btn.classList.toggle('learned', newLearned);
    btn.title = newLearned ? 'Mark as not learned' : 'Mark as learned';
    const row = btn.closest('tr');
    if (row) row.classList.toggle('learned-row', newLearned);
    updateHeader();

    try {
      // toggleSentenceLearned() already records/removes streak activity internally.
      await toggleSentenceLearned(topicId, sentenceId, newLearned);
      if (currentTopic) {
        currentTopic.learnedCount = (currentTopic.learnedCount || 0) + (newLearned ? 1 : -1);
      }
      updateStreakBadge();

      const milestone = sessionStorage.getItem('streak_milestone');
      if (milestone) {
        sessionStorage.removeItem('streak_milestone');
        const msg = getMilestoneMessage(Number(milestone));
        if (msg) await showMilestoneModal(msg);
      }

      const encourage = sessionStorage.getItem('streak_daily_encourage');
      if (encourage) {
        sessionStorage.removeItem('streak_daily_encourage');
        showToast(encourage, 'success', 3000);
      }
    } catch (err) {
      console.error('Failed to toggle learned:', err);
      // Revert
      sentence.learned = !newLearned;
      btn.classList.toggle('learned', !newLearned);
      btn.title = !newLearned ? 'Mark as not learned' : 'Mark as learned';
      if (row) row.classList.toggle('learned-row', !newLearned);
      updateHeader();
      showToast('Failed to update sentence status.', 'error');
    }
  });

  // Delete button
  spTbody.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action="delete"]');
    if (!btn) return;
    e.stopPropagation();

    const sentenceId = btn.dataset.id;
    const sentence = allSentences.find(s => s.id === sentenceId);
    const name = sentence ? sentence.english : '';
    const ok = await confirmDialog(
      `Delete the sentence "${name}"?`,
      { title: 'Delete Sentence', confirmText: 'Delete' }
    );
    if (!ok) {
      const row = btn.closest('.swipe-row');
      if (row) resetSwipe(row);
      return;
    }

    try {
      await deleteSentence(topicId, sentenceId, !!sentence?.learned);
      showToast('Sentence deleted.', 'success');
      await loadTopicAndSentences();
    } catch (err) {
      console.error(err);
      showToast('Failed to delete sentence.', 'error');
    }
  });

  // AI Insights button
  spTbody.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-ai-insights');
    if (!btn) return;
    e.stopPropagation();
    handleSentenceInsightsClick(btn.dataset.id, btn);
  });

  // Refresh button inside insights panel
  spTbody.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-insights-refresh');
    if (!btn) return;
    e.stopPropagation();
    const sentenceId = btn.dataset.id;
    const sparkleBtn = spTbody.querySelector(`.btn-ai-insights[data-id="${sentenceId}"]`);
    if (sparkleBtn) handleSentenceInsightsClick(sentenceId, sparkleBtn, true);
  });

  // Row click — open edit modal
  spTbody.addEventListener('click', (e) => {
    if (e.target.closest('[data-action]')) return;
    if (e.target.closest('.btn-ai-insights') || e.target.closest('.insights-row')) return;
    if (swipeDragOccurred) { swipeDragOccurred = false; return; }
    const row = e.target.closest('tr[data-id]');
    if (!row || row.classList.contains('swiped')) return;

    const sentenceId = row.dataset.id;
    const sentence = allSentences.find(s => s.id === sentenceId);
    if (!sentence) return;

    openEditSentenceModal(sentence);
  });
}

// ============================================================
// AI INSIGHTS PANEL (lazy, per-row — mirrors vocabulary AI Insights)
// ============================================================

function renderSentenceInsightsPanel(sentence) {
  const registerLabel = { formal: 'Formal', informal: 'Informal', neutral: 'Neutral' };
  const registerClass = { formal: 'tag-formal', informal: 'tag-informal', neutral: 'tag-neutral' };

  let html = '<div class="insights-panel">';

  html += '<div class="insights-header">';
  html += `<span class="insights-register ${registerClass[sentence.register] || 'tag-neutral'}">${registerLabel[sentence.register] || 'Neutral'}</span>`;
  html += '</div>';

  html += '<div class="insights-grid">';

  if (sentence.usage) {
    html += `<div class="insights-section insights-section-full">
      <h4>Usage</h4>
      <p class="insights-usage-note">${escapeHtml(sentence.usage)}</p>
    </div>`;
  }

  if (sentence.notes) {
    html += `<div class="insights-section insights-section-full">
      <h4>Notes</h4>
      <p class="insights-usage-note">${escapeHtml(sentence.notes)}</p>
    </div>`;
  }

  if (sentence.variations?.length) {
    html += '<div class="insights-section insights-section-full"><h4>Variations</h4>';
    sentence.variations.forEach(v => {
      html += `<div class="insights-example"><p class="insights-example-en">${escapeHtml(v)}</p></div>`;
    });
    html += '</div>';
  }

  html += '</div>'; // close grid

  if (sentence.aiInsightsGeneratedAt) {
    const date = sentence.aiInsightsGeneratedAt.toDate
      ? sentence.aiInsightsGeneratedAt.toDate()
      : new Date(sentence.aiInsightsGeneratedAt);
    html += `<div class="insights-footer">
      <span class="insights-cached-time">Generated ${date.toLocaleDateString()}</span>
      <button class="btn-insights-refresh" data-id="${sentence.id}" type="button">
        ${REFRESH_SVG}
        Refresh
      </button>
    </div>`;
  }

  html += '</div>';
  return html;
}

function createSentenceInsightsRow(sentence) {
  const tr = document.createElement('tr');
  tr.className = 'insights-row';
  tr.dataset.insightsFor = sentence.id;
  tr.innerHTML = `<td colspan="6">${renderSentenceInsightsPanel(sentence)}</td>`;
  return tr;
}

function createLoadingSentenceInsightsRow(sentenceId) {
  const tr = document.createElement('tr');
  tr.className = 'insights-row';
  tr.dataset.insightsFor = sentenceId;
  tr.innerHTML = `<td colspan="6">
    <div class="insights-panel insights-loading">
      <div class="insights-skeleton"></div>
      <div class="insights-skeleton short"></div>
      <div class="insights-skeleton"></div>
    </div>
  </td>`;
  return tr;
}

function closeAllSentenceInsightsRows() {
  spTbody.querySelectorAll('.insights-row').forEach(r => r.remove());
  spTbody.querySelectorAll('.btn-ai-insights.active').forEach(b => b.classList.remove('active'));
}

async function handleSentenceInsightsClick(sentenceId, btn, forceRefresh = false) {
  const sentence = allSentences.find(s => s.id === sentenceId);
  if (!sentence) return;

  // Toggle off if already open and not forcing refresh
  const existing = spTbody.querySelector(`.insights-row[data-insights-for="${sentenceId}"]`);
  if (existing && !forceRefresh) {
    existing.remove();
    btn.classList.remove('active');
    return;
  }

  // Close any other open insights
  closeAllSentenceInsightsRows();
  btn.classList.add('active');

  const sentenceRow = spTbody.querySelector(`tr[data-id="${sentenceId}"]`);
  if (!sentenceRow) return;

  const hasInsights = sentence.usage || sentence.notes || sentence.variations?.length;
  if (hasInsights && !forceRefresh) {
    const insRow = createSentenceInsightsRow(sentence);
    sentenceRow.after(insRow);
    return;
  }

  const loadingRow = createLoadingSentenceInsightsRow(sentenceId);
  sentenceRow.after(loadingRow);
  btn.querySelector('svg').classList.add('spin');

  try {
    const insights = await generateSentenceInsights(sentence);
    await saveSentenceInsights(topicId, sentenceId, insights);

    sentence.usage = insights.usage;
    sentence.notes = insights.notes;
    sentence.register = insights.register;
    sentence.variations = insights.variations;
    sentence.aiInsightsGeneratedAt = new Date();

    const currentLoading = spTbody.querySelector(`.insights-row[data-insights-for="${sentenceId}"]`);
    if (currentLoading) {
      const insRow = createSentenceInsightsRow(sentence);
      currentLoading.replaceWith(insRow);
    }
  } catch (err) {
    console.error('Failed to generate sentence insights:', err);
    showToast('Failed to generate AI insights. ' + (err.message || ''), 'error');
    const currentLoading = spTbody.querySelector(`.insights-row[data-insights-for="${sentenceId}"]`);
    if (currentLoading) currentLoading.remove();
    btn.classList.remove('active');
  } finally {
    btn.querySelector('svg').classList.remove('spin');
  }
}

// ============================================================
// ADD / EDIT SENTENCE MODAL
// ============================================================

function openAddSentenceModal() {
  editingSentenceId = null;
  if (modalSpTitle) modalSpTitle.textContent = 'Add Sentence';
  if (btnSpSave) btnSpSave.textContent = 'Add';
  if (formSentence) formSentence.reset();
  showModal(modalSentence);
}

function openEditSentenceModal(sentence) {
  editingSentenceId = sentence.id;
  if (modalSpTitle) modalSpTitle.textContent = 'Edit Sentence';
  if (btnSpSave) btnSpSave.textContent = 'Save';
  if (inputSpSource) inputSpSource.value = '';
  if (inputSpEnglish) inputSpEnglish.value = sentence.english || '';
  if (inputSpVietnamese) inputSpVietnamese.value = sentence.vietnamese || '';
  if (inputSpPattern) inputSpPattern.value = sentence.pattern || '';
  if (inputSpLevel) inputSpLevel.value = sentence.level || '';
  showModal(modalSentence);
}

if (btnAddSentence) btnAddSentence.addEventListener('click', openAddSentenceModal);
if (btnAddSentenceEmpty) btnAddSentenceEmpty.addEventListener('click', openAddSentenceModal);

// AI fill button
if (btnSpAiFill) {
  btnSpAiFill.addEventListener('click', async () => {
    const source = inputSpSource ? inputSpSource.value.trim() : '';
    if (!source) {
      showToast('Please enter a sentence first.', 'warning');
      if (inputSpSource) inputSpSource.focus();
      return;
    }

    const ORIGINAL_HTML = btnSpAiFill.innerHTML;
    btnSpAiFill.disabled = true;
    btnSpAiFill.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24"
           fill="none" stroke="currentColor" stroke-width="2"
           stroke-linecap="round" stroke-linejoin="round" class="spin">
        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
      </svg>
      Generating…
    `;

    try {
      const info = await generateSentenceInfo(source);
      if (inputSpEnglish) inputSpEnglish.value = info.english || '';
      if (inputSpVietnamese) inputSpVietnamese.value = info.vietnamese || '';
      if (inputSpPattern) inputSpPattern.value = info.pattern || '';
      if (inputSpLevel) inputSpLevel.value = info.level || '';
      showToast('Fields filled by AI!', 'success');
    } catch (err) {
      console.error(err);
      showToast('AI generation failed. ' + (err.message || ''), 'error');
    } finally {
      btnSpAiFill.disabled = false;
      btnSpAiFill.innerHTML = ORIGINAL_HTML;
    }
  });
}

// Form submit
if (formSentence) {
  formSentence.addEventListener('submit', async (e) => {
    e.preventDefault();

    const english = inputSpEnglish ? inputSpEnglish.value.trim() : '';
    const vietnamese = inputSpVietnamese ? inputSpVietnamese.value.trim() : '';

    if (!english && !vietnamese) {
      showToast('Please fill in at least the English or Vietnamese sentence.', 'warning');
      return;
    }

    const originalText = btnSpSave ? btnSpSave.textContent : '';
    if (btnSpSave) {
      btnSpSave.disabled = true;
      btnSpSave.textContent = editingSentenceId ? 'Saving…' : 'Adding…';
    }

    try {
      const data = {
        english,
        vietnamese,
        pattern: inputSpPattern ? inputSpPattern.value.trim() : '',
        level:   inputSpLevel ? inputSpLevel.value.trim() : '',
      };

      if (editingSentenceId) {
        await updateSentence(topicId, editingSentenceId, data);
        showToast('Sentence updated.', 'success');
      } else {
        await addSentence(topicId, data);
        showToast('Sentence added!', 'success');
      }
      closeModal(modalSentence);
      await loadTopicAndSentences();
    } catch (err) {
      console.error(err);
      showToast('Operation failed.', 'error');
    } finally {
      if (btnSpSave) {
        btnSpSave.disabled = false;
        btnSpSave.textContent = originalText;
      }
    }
  });
}

// ============================================================
// BULK ADD MODAL
// ============================================================

const BULK_SP_GENERATE_BTN_HTML = bulkSpBtnGenerate ? bulkSpBtnGenerate.innerHTML : '';

function onBulkSpCountChange() {
  updateBulkCounter(bulkSpPreviewTbody, bulkSpCounter, bulkSpBtnAdd);
}

function renderBulkSpPreview(results, duplicatesMap = new Map()) {
  bulkSpResults = results;
  bulkSpDuplicatesMap = duplicatesMap;
  if (!bulkSpPreviewTbody) return;

  bulkSpPreviewTbody.innerHTML = results.map((r, i) => {
    const dupeLocations = duplicatesMap.get(r.english);
    const dupeHtml = buildDupeRowHtml(dupeLocations);
    return `
    <tr${dupeLocations ? ' class="bulk-dupe-row"' : ''}>
      <td><input type="checkbox" data-index="${i}" checked /></td>
      <td>${escapeHtml(r.english)}${dupeHtml}</td>
      <td>${escapeHtml(r.vietnamese || '')}</td>
      <td class="sp-pattern-cell">${escapeHtml(r.pattern || '')}</td>
      <td>${r.level ? `<span class="sp-level-badge">${escapeHtml(r.level)}</span>` : ''}</td>
    </tr>`;
  }).join('');

  onBulkSpCountChange();
}

function resetBulkSpModal() {
  if (bulkSpInput)        bulkSpInput.value = '';
  if (bulkSpStepInput)    bulkSpStepInput.classList.remove('hidden');
  if (bulkSpStepPreview)  bulkSpStepPreview.classList.add('hidden');
  if (bulkSpLoading)      bulkSpLoading.classList.add('hidden');
  if (bulkSpProgressWrap) bulkSpProgressWrap.classList.add('hidden');
  if (bulkSpAdding)       bulkSpAdding.classList.add('hidden');
  if (bulkSpBtnGenerate) {
    bulkSpBtnGenerate.classList.remove('hidden');
    bulkSpBtnGenerate.disabled = false;
    bulkSpBtnGenerate.innerHTML = BULK_SP_GENERATE_BTN_HTML;
  }
  if (bulkSpBtnAdd) bulkSpBtnAdd.classList.add('hidden');
  bulkSpResults = [];
  bulkSpDuplicatesMap = new Map();
}

if (btnBulkSentence) {
  btnBulkSentence.addEventListener('click', () => {
    resetBulkSpModal();
    showModal(modalBulkSp);
  });
}

setupBulkPreviewHandlers({
  tbodyEl: bulkSpPreviewTbody,
  selectAllBtn: bulkSpSelectAll,
  deselectAllBtn: bulkSpDeselectAll,
  onCountChange: onBulkSpCountChange,
});

if (bulkSpBtnGenerate) {
  bulkSpBtnGenerate.addEventListener('click', async () => {
    const lines = parseBulkSentenceLines(bulkSpInput ? bulkSpInput.value : '');
    if (lines.length === 0) {
      showToast('Please enter at least one sentence.', 'warning');
      if (bulkSpInput) bulkSpInput.focus();
      return;
    }

    bulkSpBtnGenerate.disabled = true;
    bulkSpBtnGenerate.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
           fill="none" stroke="currentColor" stroke-width="2"
           stroke-linecap="round" stroke-linejoin="round" class="spin">
        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
      </svg>
      Generating…
    `;
    if (bulkSpStepInput)  bulkSpStepInput.classList.add('hidden');
    if (bulkSpLoading)    bulkSpLoading.classList.remove('hidden');
    if (bulkSpProgressWrap) bulkSpProgressWrap.classList.add('hidden');
    if (bulkSpProgressFill) bulkSpProgressFill.style.width = '0%';
    if (bulkSpLoadingText)  bulkSpLoadingText.textContent =
      `AI is analyzing ${lines.length} sentence${lines.length > 1 ? 's' : ''}…`;

    let progressBarShown = false;

    try {
      const results = await generateBulkSentenceInfo(lines, (done, total) => {
        if (done < total) {
          if (!progressBarShown && bulkSpProgressWrap) {
            bulkSpProgressWrap.classList.remove('hidden');
            progressBarShown = true;
          }
          const pct = Math.round((done / total) * 100);
          if (bulkSpProgressFill) bulkSpProgressFill.style.width = `${pct}%`;
          if (bulkSpProgressCount) bulkSpProgressCount.textContent = `${done} / ${total} sentences`;
        }
      });

      // Check for duplicates
      if (bulkSpLoadingText) bulkSpLoadingText.textContent = 'Checking for duplicates…';
      let duplicatesMap = new Map();
      try {
        duplicatesMap = await findDuplicateSentences(topicId, results);
      } catch (dupErr) {
        console.warn('Duplicate check failed:', dupErr);
      }

      if (bulkSpLoading)      bulkSpLoading.classList.add('hidden');
      if (bulkSpProgressWrap) bulkSpProgressWrap.classList.add('hidden');
      if (bulkSpStepPreview)  bulkSpStepPreview.classList.remove('hidden');
      if (bulkSpBtnGenerate)  bulkSpBtnGenerate.classList.add('hidden');
      if (bulkSpBtnAdd)       bulkSpBtnAdd.classList.remove('hidden');

      renderBulkSpPreview(results, duplicatesMap);
    } catch (err) {
      console.error(err);
      showToast('AI generation failed. ' + (err.message || ''), 'error');
      if (bulkSpLoading)     bulkSpLoading.classList.add('hidden');
      if (bulkSpProgressWrap) bulkSpProgressWrap.classList.add('hidden');
      if (bulkSpStepInput)   bulkSpStepInput.classList.remove('hidden');
      if (bulkSpBtnGenerate) {
        bulkSpBtnGenerate.disabled = false;
        bulkSpBtnGenerate.innerHTML = BULK_SP_GENERATE_BTN_HTML;
      }
    }
  });
}

if (bulkSpBtnAdd) {
  bulkSpBtnAdd.addEventListener('click', async () => {
    if (!bulkSpPreviewTbody) return;

    const selectedIndices = Array.from(
      bulkSpPreviewTbody.querySelectorAll('input[type=checkbox]:checked')
    ).map(cb => parseInt(cb.dataset.index));

    if (selectedIndices.length === 0) return;

    const toAdd = selectedIndices.map(i => bulkSpResults[i]);

    // Check for selected duplicates (Map keyed by ORIGINAL-case english string)
    const selectedDupes = new Map();
    for (const item of toAdd) {
      if (bulkSpDuplicatesMap.has(item.english)) {
        selectedDupes.set(item.english, bulkSpDuplicatesMap.get(item.english));
      }
    }
    if (selectedDupes.size > 0) {
      const ok = await confirmDialogHtml(buildDuplicateWarningHtml(selectedDupes), {
        title: `${selectedDupes.size} Duplicate Sentence${selectedDupes.size > 1 ? 's' : ''} Found`,
        confirmText: 'Add Anyway',
        cancelText: 'Go Back',
        confirmClass: 'btn-warning',
      });
      if (!ok) return;
    }

    bulkSpBtnAdd.disabled = true;
    if (bulkSpStepPreview) bulkSpStepPreview.classList.add('hidden');
    if (bulkSpAdding)      bulkSpAdding.classList.remove('hidden');

    let added = 0;
    for (const item of toAdd) {
      if (bulkSpAddingText) {
        bulkSpAddingText.textContent = `Adding sentences… ${added + 1} / ${toAdd.length}`;
      }
      try {
        await addSentence(topicId, item);
        added++;
      } catch (err) {
        console.error(`Failed to add "${item.english}":`, err);
      }
    }

    if (bulkSpAdding) bulkSpAdding.classList.add('hidden');
    closeModal(modalBulkSp);

    if (added > 0) {
      showToast(`${added} sentence${added > 1 ? 's' : ''} added!`, 'success');
      await loadTopicAndSentences();
    }
    if (added < toAdd.length) {
      showToast(`${toAdd.length - added} sentence(s) failed to add.`, 'error');
    }
  });
}

// ============================================================
// PRACTICE TAB — SETUP
// ============================================================

if (spDirectionGroup) {
  spDirectionGroup.addEventListener('click', (e) => {
    const btn = e.target.closest('.sp-chip');
    if (!btn) return;
    spDirectionGroup.querySelectorAll('.sp-chip').forEach(c => {
      c.classList.remove('active');
      c.setAttribute('aria-checked', 'false');
    });
    btn.classList.add('active');
    btn.setAttribute('aria-checked', 'true');
    selectedDirection = btn.dataset.direction;
  });
}

if (spScopeGroup) {
  spScopeGroup.addEventListener('click', (e) => {
    const btn = e.target.closest('.sp-chip');
    if (!btn) return;
    spScopeGroup.querySelectorAll('.sp-chip').forEach(c => {
      c.classList.remove('active');
      c.setAttribute('aria-checked', 'false');
    });
    btn.classList.add('active');
    btn.setAttribute('aria-checked', 'true');
    selectedScope = btn.dataset.scope;
  });
}

if (spShuffleToggle) {
  spShuffleToggle.addEventListener('click', () => {
    const isActive = spShuffleToggle.classList.toggle('active');
    spShuffleToggle.setAttribute('aria-pressed', String(isActive));
    selectedShuffle = isActive;
  });
}

if (spCountSelect) {
  spCountSelect.addEventListener('change', () => {
    selectedCount = spCountSelect.value;
  });
}

function refreshPracticeTab() {
  if (allSentences.length === 0) {
    if (spPracticeEmpty) spPracticeEmpty.classList.remove('hidden');
    if (spPracticeSetup) spPracticeSetup.classList.add('hidden');
    if (spPracticeArea)  spPracticeArea.classList.add('hidden');
    if (spResults)        spResults.classList.add('hidden');
    return;
  }

  if (spPracticeEmpty) spPracticeEmpty.classList.add('hidden');
  if (spPracticeArea)  spPracticeArea.classList.add('hidden');
  if (spResults)        spResults.classList.add('hidden');
  if (spPracticeSetup) spPracticeSetup.classList.remove('hidden');
}

if (btnSpStartPractice) {
  btnSpStartPractice.addEventListener('click', () => {
    startPracticeSession();
  });
}

// ============================================================
// PRACTICE TAB — SESSION
// ============================================================

function buildQueueFromSentences(sentences) {
  return sentences.map(sentence => ({
    sentence,
    direction: selectedDirection === 'mixed'
      ? (Math.random() < 0.5 ? 'en-vi' : 'vi-en')
      : selectedDirection,
  }));
}

function startPracticeSession() {
  let pool = allSentences.filter(s => {
    if (selectedScope === 'unlearned') return !s.learned;
    if (selectedScope === 'learned') return !!s.learned;
    return true;
  });

  if (pool.length === 0) {
    showToast('No sentences match the selected scope.', 'warning');
    return;
  }

  if (selectedShuffle) pool = shuffle(pool);
  if (selectedCount !== 'all') {
    pool = pool.slice(0, parseInt(selectedCount, 10));
  }

  sessionQueue = buildQueueFromSentences(pool);
  sessionIndex = 0;
  sessionScore = 0;
  sessionWrong = [];

  if (spPracticeSetup) spPracticeSetup.classList.add('hidden');
  if (spResults)         spResults.classList.add('hidden');
  if (spPracticeArea)   spPracticeArea.classList.remove('hidden');

  // Record practice activity once, at session start.
  handleStreakRecord('sentence');

  renderPracticeQuestion();
}

function renderPracticeQuestion() {
  if (sessionIndex >= sessionQueue.length) {
    showSessionResults();
    return;
  }

  const { sentence, direction } = sessionQueue[sessionIndex];
  const total = sessionQueue.length;
  const pct = Math.round((sessionIndex / total) * 100);
  if (spProgressFill) spProgressFill.style.width = `${pct}%`;
  if (spProgressText) spProgressText.textContent = `${sessionIndex + 1} / ${total}`;

  const sourceText = direction === 'en-vi' ? sentence.english : sentence.vietnamese;
  const targetLangLabel = direction === 'en-vi' ? 'Vietnamese' : 'English';

  if (spPracticeCard) {
    spPracticeCard.innerHTML = `
      <div class="sp-source-label">Translate to ${escapeHtml(targetLangLabel)}</div>
      <div class="sp-source-text">${escapeHtml(sourceText)}</div>
      <div class="sp-badge-row">
        ${sentence.pattern ? `<span class="sp-level-badge">${escapeHtml(sentence.pattern)}</span>` : ''}
        ${sentence.level ? `<span class="sp-level-badge">${escapeHtml(sentence.level)}</span>` : ''}
      </div>
      <textarea class="form-textarea sp-answer-textarea" id="sp-answer-input"
                placeholder="Type the ${targetLangLabel} translation…"
                autocomplete="off" autocorrect="off" spellcheck="false"></textarea>
      <div id="sp-answer-result"></div>
    `;
  }

  if (spPracticeActions) {
    spPracticeActions.innerHTML = `<button class="btn btn-primary" id="btn-sp-check">Check</button>`;
  }

  const textarea = document.getElementById('sp-answer-input');
  if (textarea) {
    textarea.focus();
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        document.getElementById('btn-sp-check')?.click();
      }
    });
  }

  document.getElementById('btn-sp-check')?.addEventListener('click', () => {
    checkPracticeAnswer(sentence, direction);
  });
}

function checkPracticeAnswer(sentence, direction) {
  const textarea = document.getElementById('sp-answer-input');
  if (!textarea) return;

  const userAnswer = textarea.value.trim();
  const correctAnswer = direction === 'en-vi' ? sentence.vietnamese : sentence.english;
  const isCorrect = isExactMatch(userAnswer, correctAnswer);
  const accuracy = calculateAccuracy(userAnswer, correctAnswer);

  textarea.disabled = true;

  if (isCorrect) {
    sessionScore++;
  } else {
    sessionWrong.push({ sentence, direction, userAnswer, correctAnswer });
  }

  const diffHtml = `<span class="sp-diff-answer">${escapeHtml(correctAnswer)}</span>`;

  const accClass = accuracy >= 80 ? 'acc-high' : accuracy >= 50 ? 'acc-mid' : 'acc-low';

  const resultEl = document.getElementById('sp-answer-result');
  if (resultEl) {
    resultEl.innerHTML = `
      <div class="sp-answer-result">
        <div class="sp-result-row">
          <span class="sp-result-status ${isCorrect ? 'correct' : 'incorrect'}">${isCorrect ? 'Correct!' : 'Not quite'}</span>
          <span class="sp-accuracy-badge ${accClass}">${accuracy}% accuracy</span>
        </div>
        <div class="sp-diff-label">Compared to the correct answer</div>
        <div class="sp-diff-line">${diffHtml}</div>
        <div class="sp-correct-answer-box"><strong>Correct answer:</strong> ${escapeHtml(correctAnswer)}</div>
      </div>
    `;
  }

  if (spPracticeActions) {
    const isLast = sessionIndex >= sessionQueue.length - 1;
    spPracticeActions.innerHTML = `
      <button class="btn btn-primary" id="btn-sp-next">${isLast ? 'See Results' : 'Next'}</button>
    `;
    document.getElementById('btn-sp-next')?.addEventListener('click', () => {
      sessionIndex++;
      renderPracticeQuestion();
    });
  }
}

function showSessionResults() {
  if (spPracticeArea) spPracticeArea.classList.add('hidden');
  if (!spResults) return;

  spResults.classList.remove('hidden');
  const total = sessionQueue.length;

  let wrongHtml = '';
  if (sessionWrong.length > 0) {
    const items = sessionWrong.map(w => `
      <div class="sp-wrong-item">
        <div class="sp-wrong-item-source">${escapeHtml(w.direction === 'en-vi' ? w.sentence.english : w.sentence.vietnamese)}</div>
        <div class="sp-wrong-item-answer">Your answer: ${escapeHtml(w.userAnswer || '(blank)')}</div>
        <div class="sp-wrong-item-answer">Correct: ${escapeHtml(w.correctAnswer)}</div>
      </div>
    `).join('');
    wrongHtml = `
      <div class="sp-results-wrong-list">
        <h4>Sentences to review (${sessionWrong.length}):</h4>
        ${items}
      </div>
    `;
  }

  const retryHtml = sessionWrong.length > 0
    ? `<div class="wf-practice-actions"><button class="btn btn-outline" id="btn-sp-retry-wrong">Retry Wrong Ones</button></div>`
    : '';

  spResults.innerHTML = `
    <div class="practice-result">
      ${buildResultHtml(sessionScore, total, {
        backHref: 'sentences.html',
        backLabel: 'Back to Sentence Patterns',
        label: `${sessionScore} / ${total}`,
      })}
    </div>
    ${wrongHtml}
    ${retryHtml}
  `;

  document.getElementById('btn-sp-retry-wrong')?.addEventListener('click', () => {
    sessionQueue = sessionWrong.map(w => ({ sentence: w.sentence, direction: w.direction }));
    sessionIndex = 0;
    sessionScore = 0;
    sessionWrong = [];
    spResults.classList.add('hidden');
    if (spPracticeArea) spPracticeArea.classList.remove('hidden');
    renderPracticeQuestion();
  });
}

// ============================================================
// GLOBAL RESTART HOOK (used by buildResultHtml's "Play Again" button)
// ============================================================
window._restartMode = () => {
  if (sessionQueue.length > 0) {
    sessionIndex = 0;
    sessionScore = 0;
    sessionWrong = [];
    spResults.classList.add('hidden');
    if (spPracticeArea) spPracticeArea.classList.remove('hidden');
    renderPracticeQuestion();
  }
};

// ============================================================
// INIT
// ============================================================
updateStreakBadge();
loadTopicAndSentences();
