/* ============================================================
   WORD FORMS PAGE CONTROLLER
   Auth, word forms table CRUD, swipe-to-delete, bulk add,
   fill-in-the-forms practice mode.
   ============================================================ */

import { guardAuth, logout } from '../core/router.js';
import { initFirebase } from '../core/firebase.js';
import {
  loadWordForms,
  addWordForm,
  updateWordForm,
  deleteWordForm,
  toggleWordFormLearned,
  findDuplicateWordForms,
} from '../features/word-forms.js';
import { generateWordFormInfo, generateBulkWordFormInfo } from '../ai/word-forms-ai.js';
import {
  showModal, closeModal, setupModalClose,
  showToast, confirmDialog, confirmDialogHtml, escapeHtml, showMilestoneModal,
} from '../ui/index.js';
import {
  parseBulkInput,
  setupLowercaseWarning,
  updateBulkCounter,
  setupBulkPreviewHandlers,
  showCorrectionNotice,
  buildDupeRowHtml,
  buildDuplicateWarningHtml,
} from '../shared/bulk-add-utils.js';
import { loadStreak, getMilestoneMessage, recordActivity } from '../features/streak.js';
import { initChatWidget } from '../chat/chat-ui.js';
import { speakText } from '../shared/tts.js';
import { shuffle } from '../shared/shuffle.js';

// ---- Auth & Firebase ----
const session = guardAuth();
initFirebase(session.firebase);

document.getElementById('nav-username').textContent = session.username;
document.getElementById('nav-avatar').textContent = session.username.charAt(0).toUpperCase();
document.getElementById('btn-logout').addEventListener('click', logout);

// ---- Chat widget ----
initChatWidget(() => ({
  page: 'Word Forms',
  words: allWordForms.map(f => ({ english: f.baseWord, vietnamese: '' })),
}));

// ---- Navbar streak badge ----
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
  }).catch(() => {});
}
updateStreakBadge();

// ---- Modal close setup ----
setupModalClose('#modal-word-form');
setupModalClose('#modal-bulk-wf');
setupModalClose('#modal-wf-select');

// ---- DOM refs: header ----
const wfWordBadge        = document.getElementById('wf-word-badge');
const wfLearnedProgress  = document.getElementById('wf-learned-progress');
const wfLearnedFill      = document.getElementById('wf-learned-fill');
const wfLearnedText      = document.getElementById('wf-learned-text');

// ---- DOM refs: table tab ----
const wfLoading          = document.getElementById('wf-loading');
const wfContent          = document.getElementById('wf-content');
const wfEmpty            = document.getElementById('wf-empty');
const wfTableWrapper     = document.getElementById('wf-table-wrapper');
const wfTbody            = document.getElementById('wf-tbody');
const wfSearchInput      = document.getElementById('wf-search-input');
const wfSortSelect       = document.getElementById('wf-sort-select');
const btnAddWordForm     = document.getElementById('btn-add-word-form');
const btnBulkWordForm    = document.getElementById('btn-bulk-word-form');

// ---- DOM refs: add/edit modal ----
const modalWfOverlay     = document.getElementById('modal-word-form');
const modalWfTitle       = document.getElementById('modal-wf-title');
const formWordForm       = document.getElementById('form-word-form');
const inputWfBase        = document.getElementById('input-wf-base');
const inputWfNoun        = document.getElementById('input-wf-noun');
const inputWfVerb        = document.getElementById('input-wf-verb');
const inputWfAdj         = document.getElementById('input-wf-adj');
const inputWfAdv         = document.getElementById('input-wf-adv');
const btnWfSave          = document.getElementById('btn-wf-save');
const btnWfAiFill        = document.getElementById('btn-wf-ai-fill');
const wfDetectedType     = document.getElementById('wf-detected-type');
const wfDetectedTypeVal  = document.getElementById('wf-detected-type-val');
const wfLowercaseWarn    = document.getElementById('wf-lowercase-warn');

// ---- DOM refs: bulk modal ----
const modalBulkWf           = document.getElementById('modal-bulk-wf');
const bulkWfInput           = document.getElementById('bulk-wf-input');
const bulkWfStepInput       = document.getElementById('bulk-wf-step-input');
const bulkWfStepPreview     = document.getElementById('bulk-wf-step-preview');
const bulkWfLoading         = document.getElementById('bulk-wf-loading');
const bulkWfLoadingText     = document.getElementById('bulk-wf-loading-text');
const bulkWfProgressWrap    = document.getElementById('bulk-wf-progress-wrap');
const bulkWfProgressFill    = document.getElementById('bulk-wf-progress-fill');
const bulkWfProgressCount   = document.getElementById('bulk-wf-progress-count');
const bulkWfAdding          = document.getElementById('bulk-wf-adding');
const bulkWfAddingText      = document.getElementById('bulk-wf-adding-text');
const bulkWfPreviewTbody    = document.getElementById('bulk-wf-preview-tbody');
const bulkWfCounter         = document.getElementById('bulk-wf-counter');
const bulkWfBtnGenerate     = document.getElementById('bulk-wf-btn-generate');
const bulkWfBtnAdd          = document.getElementById('bulk-wf-btn-add');
const bulkWfSelectAll       = document.getElementById('bulk-wf-select-all');
const bulkWfDeselectAll     = document.getElementById('bulk-wf-deselect-all');
const bulkWfCorrectionNotice = document.getElementById('bulk-wf-correction-notice');
const bulkWfLowercaseWarn   = document.getElementById('bulk-wf-lowercase-warn');

// ---- DOM refs: practice ----
const wfPracticeEmpty    = document.getElementById('wf-practice-empty');
const wfPracticeStart    = document.getElementById('wf-practice-start');
const wfPracticeArea     = document.getElementById('wf-practice-area');
const wfResults          = document.getElementById('wf-results');
const btnStartPractice   = document.getElementById('btn-start-practice');
const wfProgressFill     = document.getElementById('wf-progress-fill');
const wfProgressText     = document.getElementById('wf-progress-text');
const wfPracticeCard     = document.getElementById('wf-practice-card');
const wfPracticeActions  = document.getElementById('wf-practice-actions');

// ---- DOM refs: word selection modal ----
const modalWfSelect      = document.getElementById('modal-wf-select');
const wfWordSelectList   = document.getElementById('wf-word-select-list');
const wfSelectCounter    = document.getElementById('wf-select-counter');
const wfSelectAll        = document.getElementById('wf-select-all');
const wfDeselectAll      = document.getElementById('wf-deselect-all');
const btnWfStartSelected = document.getElementById('btn-wf-start-selected');

// ---- Lowercase warnings ----
setupLowercaseWarning(inputWfBase, wfLowercaseWarn);
setupLowercaseWarning(bulkWfInput, bulkWfLowercaseWarn);

// ---- State ----
let allWordForms = [];
let filteredWordForms = [];
let editingFormId = null;
let bulkWfResults = [];
let bulkWfDuplicatesMap = new Map();

// Practice state
let practiceWords = [];
let practiceIndex = 0;
let practiceScore = 0;
let practiceWrong = [];

// ============================================================
// TYPE BADGE HELPER
// ============================================================

const TYPE_CLASS_MAP = {
  noun:      'wf-type-noun',
  verb:      'wf-type-verb',
  adjective: 'wf-type-adj',
  adverb:    'wf-type-adv',
};

const TYPE_LABELS = {
  noun:      'Noun',
  verb:      'Verb',
  adjective: 'Adj',
  adverb:    'Adv',
};

function typeBadgeHtml(baseType) {
  const t = (baseType || 'noun').toLowerCase();
  const cls = TYPE_CLASS_MAP[t] || 'wf-type-noun';
  const label = TYPE_LABELS[t] || escapeHtml(t);
  return `<span class="wf-type-badge ${cls}">${label}</span>`;
}

/**
 * The representative form of an entry (its base type), with a fallback chain
 * so the value is never blank. Used for word lists and result review.
 * @param {Object} form
 * @returns {string}
 */
function baseForm(form) {
  return form[form.baseType] || form.baseWord || form.noun || form.verb || form.adjective || form.adverb || '';
}

// ============================================================
// HEADER UPDATES
// ============================================================

function updateHeader() {
  const total = allWordForms.length;
  const learned = allWordForms.filter(f => f.learned).length;

  if (wfWordBadge) {
    wfWordBadge.textContent = `${total} word${total !== 1 ? 's' : ''}`;
    wfWordBadge.classList.toggle('hidden', false);
  }

  if (!wfLearnedProgress) return;

  if (total === 0) {
    wfLearnedProgress.classList.add('hidden');
    if (wfWordBadge) wfWordBadge.classList.add('hidden');
    return;
  }

  const pct = Math.round((learned / total) * 100);
  wfLearnedFill.style.width = `${pct}%`;
  wfLearnedText.textContent = `${learned}/${total} learned`;
  wfLearnedProgress.classList.remove('hidden');

  if (learned === total && total > 0) {
    wfLearnedProgress.classList.add('completed');
  } else {
    wfLearnedProgress.classList.remove('completed');
  }
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

function cellOrNa(val) {
  if (!val) return `<span class="wf-na">—</span>`;
  return escapeHtml(val);
}

function formCell(val) {
  return val ? escapeHtml(val) : `<span class="wf-na">—</span>`;
}

function buildWordFormRowHtml(form) {
  return `
    <tr class="swipe-row wf-row${form.learned ? ' learned-row' : ''}" data-id="${form.id}">
      <td>
        <button class="btn-learned${form.learned ? ' learned' : ''}"
                data-action="toggle-learned" data-id="${form.id}"
                title="${form.learned ? 'Mark as not learned' : 'Mark as learned'}"
                type="button">
          ${CHECKMARK_SVG}
        </button>
      </td>
      <td>${formCell(form.noun)}</td>
      <td>${formCell(form.verb)}</td>
      <td>${formCell(form.adjective)}</td>
      <td>${formCell(form.adverb)}</td>
      <td class="swipe-delete-cell">
        <button class="swipe-delete-btn" data-action="delete"
                data-id="${form.id}" data-learned="${form.learned}" type="button">
          ${TRASH_SVG}
          Delete
        </button>
      </td>
    </tr>
  `;
}

function computeFilteredForms() {
  const query = wfSearchInput ? wfSearchInput.value.trim().toLowerCase() : '';
  const sort = wfSortSelect ? wfSortSelect.value : 'input-order';

  let result = allWordForms.filter(f => {
    return !query ||
      (f.noun      || '').toLowerCase().includes(query) ||
      (f.verb      || '').toLowerCase().includes(query) ||
      (f.adjective || '').toLowerCase().includes(query) ||
      (f.adverb    || '').toLowerCase().includes(query);
  });

  if (sort === 'name-az') {
    result = [...result].sort((a, b) => (a[a.baseType] || '').localeCompare(b[b.baseType] || ''));
  } else if (sort === 'name-za') {
    result = [...result].sort((a, b) => (b[b.baseType] || '').localeCompare(a[a.baseType] || ''));
  } else if (sort === 'learned') {
    result = [...result].sort((a, b) => Number(b.learned) - Number(a.learned));
  }

  return result;
}

function renderFilteredForms() {
  filteredWordForms = computeFilteredForms();

  if (!wfTbody) return;

  if (filteredWordForms.length === 0) {
    if (wfEmpty) {
      wfEmpty.classList.remove('hidden');
      const hasFilter = wfSearchInput && wfSearchInput.value.trim();
      const emptyTitle = wfEmpty.querySelector('h3');
      const emptyDesc = wfEmpty.querySelector('p');
      const emptyBtn = wfEmpty.querySelector('#btn-add-word-form-empty');
      if (hasFilter && allWordForms.length > 0) {
        if (emptyTitle) emptyTitle.textContent = 'No Matching Words';
        if (emptyDesc) emptyDesc.textContent = 'Try a different search or filter.';
        if (emptyBtn) emptyBtn.classList.add('hidden');
      } else {
        if (emptyTitle) emptyTitle.textContent = 'No Word Forms Yet';
        if (emptyDesc) emptyDesc.textContent = 'Add words one by one or use Bulk Add with AI to get started.';
        if (emptyBtn) emptyBtn.classList.remove('hidden');
      }
    }
    if (wfTableWrapper) wfTableWrapper.classList.add('hidden');
    return;
  }

  if (wfEmpty) wfEmpty.classList.add('hidden');
  if (wfTableWrapper) wfTableWrapper.classList.remove('hidden');

  wfTbody.innerHTML = filteredWordForms.map(buildWordFormRowHtml).join('');
  initSwipeHandlers();
}

async function loadForms() {
  if (wfLoading) wfLoading.classList.remove('hidden');
  if (wfEmpty) wfEmpty.classList.add('hidden');
  if (wfTableWrapper) wfTableWrapper.classList.add('hidden');

  try {
    allWordForms = await loadWordForms();
    if (wfLoading) wfLoading.classList.add('hidden');
    if (wfContent) wfContent.classList.remove('hidden');
    renderFilteredForms();
    updateHeader();
  } catch (err) {
    console.error(err);
    if (wfLoading) wfLoading.classList.add('hidden');
    showToast('Failed to load word forms.', 'error');
  }
}

// ---- Search / filter / sort ----
if (wfSearchInput)  wfSearchInput.addEventListener('input', renderFilteredForms);
if (wfSortSelect)   wfSortSelect.addEventListener('change', renderFilteredForms);

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
  const rows = wfTbody.querySelectorAll('.swipe-row');
  rows.forEach(row => {
    let startX = 0, currentX = 0, isSwiping = false;
    const SWIPE_THRESHOLD = 70;

    // Touch events
    row.addEventListener('touchstart', (e) => {
      wfTbody.querySelectorAll('.swipe-row.swiped').forEach(r => {
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
      wfTbody.querySelectorAll('.swipe-row.swiped').forEach(r => {
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
    if (wfTbody) {
      wfTbody.querySelectorAll('.swipe-row.swiped').forEach(r => resetSwipe(r));
    }
  }
});

// ============================================================
// TABLE — EVENT DELEGATION
// ============================================================

if (wfTbody) {
  // Speak button
  wfTbody.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="speak"]');
    if (!btn) return;
    e.stopPropagation();
    speakText(btn.dataset.word);
  });

  // Learned toggle
  wfTbody.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action="toggle-learned"]');
    if (!btn) return;
    e.stopPropagation();

    const formId = btn.dataset.id;
    const form = allWordForms.find(f => f.id === formId);
    if (!form) return;

    const newLearned = !form.learned;

    // Optimistic UI update
    form.learned = newLearned;
    btn.classList.toggle('learned', newLearned);
    btn.title = newLearned ? 'Mark as not learned' : 'Mark as learned';
    const row = btn.closest('tr');
    if (row) row.classList.toggle('learned-row', newLearned);
    updateHeader();

    try {
      await toggleWordFormLearned(formId, newLearned);
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
      form.learned = !newLearned;
      btn.classList.toggle('learned', !newLearned);
      btn.title = !newLearned ? 'Mark as not learned' : 'Mark as learned';
      if (row) row.classList.toggle('learned-row', !newLearned);
      updateHeader();
      showToast('Failed to update word status.', 'error');
    }
  });

  // Delete button
  wfTbody.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action="delete"]');
    if (!btn) return;
    e.stopPropagation();

    const formId = btn.dataset.id;
    const form = allWordForms.find(f => f.id === formId);
    const name = form ? form.baseWord : '';
    const ok = await confirmDialog(
      `Delete the word form "${name}"?`,
      { title: 'Delete Word Form', confirmText: 'Delete' }
    );
    if (!ok) {
      const row = btn.closest('.swipe-row');
      if (row) resetSwipe(row);
      return;
    }

    try {
      await deleteWordForm(formId, !!form?.learned);
      updateStreakBadge();
      showToast('Word form deleted.', 'success');
      await loadForms();
    } catch (err) {
      console.error(err);
      showToast('Failed to delete word form.', 'error');
    }
  });

  // Row click — open edit modal
  wfTbody.addEventListener('click', (e) => {
    if (e.target.closest('[data-action]')) return;
    if (swipeDragOccurred) { swipeDragOccurred = false; return; }
    const row = e.target.closest('tr[data-id]');
    if (!row || row.classList.contains('swiped')) return;

    const formId = row.dataset.id;
    const form = allWordForms.find(f => f.id === formId);
    if (!form) return;

    openEditWordFormModal(form);
  });
}

// ============================================================
// ADD / EDIT WORD FORM MODAL
// ============================================================

function openAddWordFormModal() {
  editingFormId = null;
  if (modalWfTitle) modalWfTitle.textContent = 'Add Word';
  if (btnWfSave) btnWfSave.textContent = 'Add';
  if (formWordForm) formWordForm.reset();
  if (wfDetectedType) wfDetectedType.classList.add('hidden');
  showModal(modalWfOverlay);
}

function openEditWordFormModal(form) {
  editingFormId = form.id;
  if (modalWfTitle) modalWfTitle.textContent = 'Edit Word';
  if (btnWfSave) btnWfSave.textContent = 'Save';
  if (inputWfBase) inputWfBase.value = '';
  if (inputWfNoun) inputWfNoun.value = form.noun || '';
  if (inputWfVerb) inputWfVerb.value = form.verb || '';
  if (inputWfAdj)  inputWfAdj.value  = form.adjective || '';
  if (inputWfAdv)  inputWfAdv.value  = form.adverb || '';
  if (wfDetectedType) {
    wfDetectedType.classList.remove('hidden');
    if (wfDetectedTypeVal) wfDetectedTypeVal.textContent = form.baseType || '';
  }
  showModal(modalWfOverlay);
}

if (btnAddWordForm) {
  btnAddWordForm.addEventListener('click', openAddWordFormModal);
}

const btnAddWordFormEmpty = document.getElementById('btn-add-word-form-empty');
if (btnAddWordFormEmpty) {
  btnAddWordFormEmpty.addEventListener('click', openAddWordFormModal);
}

// AI fill button
if (btnWfAiFill) {
  btnWfAiFill.addEventListener('click', async () => {
    const base = inputWfBase ? inputWfBase.value.trim() : '';
    if (!base) {
      showToast('Please enter the base word first.', 'warning');
      if (inputWfBase) inputWfBase.focus();
      return;
    }

    const ORIGINAL_HTML = btnWfAiFill.innerHTML;
    btnWfAiFill.disabled = true;
    btnWfAiFill.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24"
           fill="none" stroke="currentColor" stroke-width="2"
           stroke-linecap="round" stroke-linejoin="round" class="spin">
        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
      </svg>
      Generating…
    `;

    try {
      const info = await generateWordFormInfo(base);
      if (inputWfNoun && info.noun      !== undefined) inputWfNoun.value = info.noun;
      if (inputWfVerb && info.verb      !== undefined) inputWfVerb.value = info.verb;
      if (inputWfAdj  && info.adjective !== undefined) inputWfAdj.value  = info.adjective;
      if (inputWfAdv  && info.adverb    !== undefined) inputWfAdv.value  = info.adverb;
      if (wfDetectedType && wfDetectedTypeVal && info.baseType) {
        wfDetectedTypeVal.textContent = info.baseType;
        wfDetectedType.classList.remove('hidden');
      }
      showToast('Fields filled by AI!', 'success');
    } catch (err) {
      console.error(err);
      showToast('AI generation failed. ' + (err.message || ''), 'error');
    } finally {
      btnWfAiFill.disabled = false;
      btnWfAiFill.innerHTML = ORIGINAL_HTML;
    }
  });
}

// Form submit
if (formWordForm) {
  formWordForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const noun      = inputWfNoun ? inputWfNoun.value.trim().toLowerCase() : '';
    const verb      = inputWfVerb ? inputWfVerb.value.trim().toLowerCase() : '';
    const adjective = inputWfAdj  ? inputWfAdj.value.trim().toLowerCase()  : '';
    const adverb    = inputWfAdv  ? inputWfAdv.value.trim().toLowerCase()  : '';
    const baseType  = wfDetectedTypeVal ? (wfDetectedTypeVal.textContent.trim().toLowerCase() || 'noun') : 'noun';

    if (!noun && !verb && !adjective && !adverb) {
      showToast('Please fill in at least one word form.', 'warning');
      return;
    }

    const originalText = btnWfSave ? btnWfSave.textContent : '';
    if (btnWfSave) {
      btnWfSave.disabled = true;
      btnWfSave.textContent = editingFormId ? 'Saving…' : 'Adding…';
    }

    try {
      const data = { baseType, noun, verb, adjective, adverb };
      if (editingFormId) {
        await updateWordForm(editingFormId, data);
        showToast('Word form updated.', 'success');
      } else {
        await addWordForm(data);
        showToast('Word form added!', 'success');
      }
      closeModal(modalWfOverlay);
      await loadForms();
    } catch (err) {
      console.error(err);
      showToast('Operation failed.', 'error');
    } finally {
      if (btnWfSave) {
        btnWfSave.disabled = false;
        btnWfSave.textContent = originalText;
      }
    }
  });
}

// ============================================================
// BULK ADD MODAL
// ============================================================

const BULK_WF_GENERATE_BTN_HTML = bulkWfBtnGenerate ? bulkWfBtnGenerate.innerHTML : '';

function onBulkWfCountChange() {
  updateBulkCounter(bulkWfPreviewTbody, bulkWfCounter, bulkWfBtnAdd);
}

function renderBulkWfPreview(results, duplicatesMap = new Map()) {
  bulkWfResults = results;
  bulkWfDuplicatesMap = duplicatesMap;
  if (!bulkWfPreviewTbody) return;

  showCorrectionNotice(results, bulkWfCorrectionNotice);

  bulkWfPreviewTbody.innerHTML = results.map((r, i) => {
    const dupeLocations = duplicatesMap.get((r.word || '').toLowerCase());
    const dupeHtml = buildDupeRowHtml(dupeLocations);
    return `
    <tr${dupeLocations ? ' class="bulk-dupe-row"' : ''}>
      <td><input type="checkbox" data-index="${i}" checked /></td>
      <td>${escapeHtml(r.word || '')}${dupeHtml}</td>
      <td>${typeBadgeHtml(r.baseType)}</td>
      <td>${escapeHtml(r.noun || '')}</td>
      <td>${escapeHtml(r.verb || '')}</td>
      <td>${escapeHtml(r.adjective || '')}</td>
      <td>${escapeHtml(r.adverb || '')}</td>
    </tr>`;
  }).join('');

  onBulkWfCountChange();
}

function resetBulkWfModal() {
  if (bulkWfInput)           bulkWfInput.value = '';
  if (bulkWfStepInput)       bulkWfStepInput.classList.remove('hidden');
  if (bulkWfStepPreview)     bulkWfStepPreview.classList.add('hidden');
  if (bulkWfLoading)         bulkWfLoading.classList.add('hidden');
  if (bulkWfProgressWrap)    bulkWfProgressWrap.classList.add('hidden');
  if (bulkWfAdding)          bulkWfAdding.classList.add('hidden');
  if (bulkWfCorrectionNotice) {
    bulkWfCorrectionNotice.classList.add('hidden');
    bulkWfCorrectionNotice.innerHTML = '';
  }
  if (bulkWfBtnGenerate) {
    bulkWfBtnGenerate.classList.remove('hidden');
    bulkWfBtnGenerate.disabled = false;
    bulkWfBtnGenerate.innerHTML = BULK_WF_GENERATE_BTN_HTML;
  }
  if (bulkWfBtnAdd) bulkWfBtnAdd.classList.add('hidden');
  bulkWfResults = [];
  bulkWfDuplicatesMap = new Map();
}

if (btnBulkWordForm) {
  btnBulkWordForm.addEventListener('click', () => {
    resetBulkWfModal();
    showModal(modalBulkWf);
  });
}

setupBulkPreviewHandlers({
  tbodyEl: bulkWfPreviewTbody,
  selectAllBtn: bulkWfSelectAll,
  deselectAllBtn: bulkWfDeselectAll,
  onCountChange: onBulkWfCountChange,
});

if (bulkWfBtnGenerate) {
  bulkWfBtnGenerate.addEventListener('click', async () => {
    const words = parseBulkInput(bulkWfInput ? bulkWfInput.value : '', bulkWfInput);
    if (words.length === 0) {
      showToast('Please enter at least one word.', 'warning');
      if (bulkWfInput) bulkWfInput.focus();
      return;
    }

    bulkWfBtnGenerate.disabled = true;
    bulkWfBtnGenerate.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
           fill="none" stroke="currentColor" stroke-width="2"
           stroke-linecap="round" stroke-linejoin="round" class="spin">
        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
      </svg>
      Generating…
    `;
    if (bulkWfStepInput)  bulkWfStepInput.classList.add('hidden');
    if (bulkWfLoading)    bulkWfLoading.classList.remove('hidden');
    if (bulkWfProgressWrap) bulkWfProgressWrap.classList.add('hidden');
    if (bulkWfProgressFill) bulkWfProgressFill.style.width = '0%';
    if (bulkWfLoadingText)  bulkWfLoadingText.textContent =
      `AI is generating details for ${words.length} word${words.length > 1 ? 's' : ''}…`;

    let progressBarShown = false;

    try {
      const results = await generateBulkWordFormInfo(words, (done, total) => {
        if (done < total) {
          if (!progressBarShown && bulkWfProgressWrap) {
            bulkWfProgressWrap.classList.remove('hidden');
            progressBarShown = true;
          }
          const pct = Math.round((done / total) * 100);
          if (bulkWfProgressFill) bulkWfProgressFill.style.width = `${pct}%`;
          if (bulkWfProgressCount) bulkWfProgressCount.textContent = `${done} / ${total} words`;
        }
      });

      // Check for duplicates
      if (bulkWfLoadingText) bulkWfLoadingText.textContent = 'Checking for duplicates…';
      let duplicatesMap = new Map();
      try {
        duplicatesMap = await findDuplicateWordForms(results.map(r => r.word));
      } catch (dupErr) {
        console.warn('Duplicate check failed:', dupErr);
      }

      if (bulkWfLoading)      bulkWfLoading.classList.add('hidden');
      if (bulkWfProgressWrap) bulkWfProgressWrap.classList.add('hidden');
      if (bulkWfStepPreview)  bulkWfStepPreview.classList.remove('hidden');
      if (bulkWfBtnGenerate)  bulkWfBtnGenerate.classList.add('hidden');
      if (bulkWfBtnAdd)       bulkWfBtnAdd.classList.remove('hidden');

      renderBulkWfPreview(results, duplicatesMap);
    } catch (err) {
      console.error(err);
      showToast('AI generation failed. ' + (err.message || ''), 'error');
      if (bulkWfLoading)     bulkWfLoading.classList.add('hidden');
      if (bulkWfProgressWrap) bulkWfProgressWrap.classList.add('hidden');
      if (bulkWfStepInput)   bulkWfStepInput.classList.remove('hidden');
      if (bulkWfBtnGenerate) {
        bulkWfBtnGenerate.disabled = false;
        bulkWfBtnGenerate.innerHTML = BULK_WF_GENERATE_BTN_HTML;
      }
    }
  });
}

if (bulkWfBtnAdd) {
  bulkWfBtnAdd.addEventListener('click', async () => {
    if (!bulkWfPreviewTbody) return;

    const selectedIndices = Array.from(
      bulkWfPreviewTbody.querySelectorAll('input[type=checkbox]:checked')
    ).map(cb => parseInt(cb.dataset.index));

    if (selectedIndices.length === 0) return;

    const toAdd = selectedIndices.map(i => bulkWfResults[i]);

    // Check for selected duplicates
    const selectedDupes = new Map();
    for (const item of toAdd) {
      const key = item.word.toLowerCase();
      if (bulkWfDuplicatesMap.has(key)) {
        selectedDupes.set(key, bulkWfDuplicatesMap.get(key));
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

    bulkWfBtnAdd.disabled = true;
    if (bulkWfStepPreview) bulkWfStepPreview.classList.add('hidden');
    if (bulkWfAdding)      bulkWfAdding.classList.remove('hidden');

    let added = 0;
    for (const item of toAdd) {
      if (bulkWfAddingText) {
        bulkWfAddingText.textContent = `Adding words… ${added + 1} / ${toAdd.length}`;
      }
      try {
        await addWordForm({
          baseWord:  item.word,
          baseType:  item.baseType,
          noun:      item.noun,
          verb:      item.verb,
          adjective: item.adjective,
          adverb:    item.adverb,
        });
        added++;
      } catch (err) {
        console.error(`Failed to add "${item.word}":`, err);
      }
    }

    if (bulkWfAdding) bulkWfAdding.classList.add('hidden');
    closeModal(modalBulkWf);

    if (added > 0) {
      showToast(`${added} word${added > 1 ? 's' : ''} added!`, 'success');
      await loadForms();
    }
    if (added < toAdd.length) {
      showToast(`${toAdd.length - added} word(s) failed to add.`, 'error');
    }
  });
}

// ============================================================
// PRACTICE TAB
// ============================================================

function refreshPracticeTab() {
  if (allWordForms.length < 4) {
    if (wfPracticeEmpty)  wfPracticeEmpty.classList.remove('hidden');
    if (wfPracticeStart)  wfPracticeStart.classList.add('hidden');
    if (wfPracticeArea)   wfPracticeArea.classList.add('hidden');
    if (wfResults)        wfResults.classList.add('hidden');
    return;
  }

  if (wfPracticeEmpty)  wfPracticeEmpty.classList.add('hidden');
  if (wfPracticeArea)   wfPracticeArea.classList.add('hidden');
  if (wfResults)        wfResults.classList.add('hidden');
  if (wfPracticeStart)  wfPracticeStart.classList.remove('hidden');
}

if (btnStartPractice) {
  btnStartPractice.addEventListener('click', () => {
    openWordSelectModal();
  });
}

// ---- Word Selection Modal ----

function openWordSelectModal() {
  if (!wfWordSelectList) return;

  wfWordSelectList.innerHTML = allWordForms.map(f => `
    <label class="ws-item">
      <input type="checkbox" data-id="${f.id}" checked />
      <span class="ws-word">${escapeHtml(baseForm(f))}</span>
      ${typeBadgeHtml(f.baseType)}
    </label>
  `).join('');

  updateSelectCounter();
  showModal(modalWfSelect);
}

function updateSelectCounter() {
  if (!wfWordSelectList || !wfSelectCounter) return;
  const checked = wfWordSelectList.querySelectorAll('input[type=checkbox]:checked').length;
  const total   = wfWordSelectList.querySelectorAll('input[type=checkbox]').length;
  wfSelectCounter.textContent = `${checked} / ${total} selected`;
  if (btnWfStartSelected) {
    const disabled = checked < 4;
    btnWfStartSelected.disabled = disabled;
    btnWfStartSelected.textContent = disabled
      ? `Start (select at least 4)`
      : `Start (${checked} words)`;
  }
}

if (wfWordSelectList) {
  wfWordSelectList.addEventListener('change', updateSelectCounter);
}

if (wfSelectAll) {
  wfSelectAll.addEventListener('click', () => {
    if (!wfWordSelectList) return;
    wfWordSelectList.querySelectorAll('input[type=checkbox]').forEach(cb => cb.checked = true);
    updateSelectCounter();
  });
}

if (wfDeselectAll) {
  wfDeselectAll.addEventListener('click', () => {
    if (!wfWordSelectList) return;
    wfWordSelectList.querySelectorAll('input[type=checkbox]').forEach(cb => cb.checked = false);
    updateSelectCounter();
  });
}

if (btnWfStartSelected) {
  btnWfStartSelected.addEventListener('click', () => {
    if (!wfWordSelectList) return;
    const selectedIds = Array.from(
      wfWordSelectList.querySelectorAll('input[type=checkbox]:checked')
    ).map(cb => cb.dataset.id);

    if (selectedIds.length < 4) return;

    const selected = selectedIds
      .map(id => allWordForms.find(f => f.id === id))
      .filter(Boolean);

    closeModal(modalWfSelect);
    startPractice(selected);
  });
}

// ============================================================
// PRACTICE — FILL IN THE FORMS
// ============================================================

const FORM_TYPES = ['noun', 'verb', 'adjective', 'adverb'];
const FORM_LABELS = {
  noun: 'Noun',
  verb: 'Verb',
  adjective: 'Adjective',
  adverb: 'Adverb',
};

function startPractice(words) {
  practiceWords = shuffle([...words]);
  practiceIndex = 0;
  practiceScore = 0;
  practiceWrong = [];

  if (wfPracticeStart)  wfPracticeStart.classList.add('hidden');
  if (wfResults)        wfResults.classList.add('hidden');
  if (wfPracticeArea)   wfPracticeArea.classList.remove('hidden');

  // Record practice activity
  recordActivity({ type: 'practice', source: 'wordForm' }).catch(() => {});

  renderPracticeCard();
}

function renderPracticeCard() {
  if (!wfPracticeCard || !wfPracticeActions) return;

  if (practiceIndex >= practiceWords.length) {
    showPracticeResults();
    return;
  }

  const word = practiceWords[practiceIndex];
  const total = practiceWords.length;

  // Update progress bar
  const pct = Math.round((practiceIndex / total) * 100);
  if (wfProgressFill) wfProgressFill.style.width = `${pct}%`;
  if (wfProgressText) wfProgressText.textContent = `${practiceIndex + 1} / ${total}`;

  // Pick a random base type among the forms that have a value, then ask
  // for the other three.
  const availableTypes = FORM_TYPES.filter(t => (word[t] || '').trim() !== '');
  const baseType = availableTypes.length
    ? availableTypes[Math.floor(Math.random() * availableTypes.length)]
    : 'noun';
  const otherTypes = FORM_TYPES.filter(t => t !== baseType);

  const rootForm = escapeHtml(word[baseType] || baseForm(word));
  wfPracticeCard.innerHTML = `
    <div class="wf-practice-word-label">What are the word forms of…</div>
    <div class="wf-practice-word">${rootForm}</div>
    <div class="wf-practice-type-row">
      ${typeBadgeHtml(baseType)}
    </div>
    <div class="wf-forms-grid" id="wf-forms-grid">
      ${otherTypes.map(t => `
        <div class="wf-form-col" data-type="${t}">
          <div class="wf-form-col-label">${FORM_LABELS[t]}</div>
          <input
            class="wf-form-input"
            type="text"
            id="wf-input-${t}"
            placeholder="Type the ${FORM_LABELS[t].toLowerCase()} form…"
            autocomplete="off"
            autocorrect="off"
            autocapitalize="off"
            spellcheck="false"
          />
          <div class="wf-correct-answer" id="wf-answer-${t}"></div>
        </div>
      `).join('')}
    </div>
  `;

  // Actions: Check button
  wfPracticeActions.innerHTML = `
    <button class="btn btn-primary" id="btn-wf-check">Check</button>
  `;

  // Auto-focus first field
  const firstInput = wfPracticeCard.querySelector('.wf-form-input');
  if (firstInput) firstInput.focus();

  // Allow Enter on last input to trigger check
  const inputs = wfPracticeCard.querySelectorAll('.wf-form-input');
  inputs.forEach((inp, idx) => {
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (idx < inputs.length - 1) {
          inputs[idx + 1].focus();
        } else {
          document.getElementById('btn-wf-check')?.click();
        }
      }
    });
  });

  document.getElementById('btn-wf-check')?.addEventListener('click', () => {
    checkAnswer(word, otherTypes);
  });
}

function checkAnswer(word, otherTypes) {
  let allCorrect = true;

  otherTypes.forEach(t => {
    const input = document.getElementById(`wf-input-${t}`);
    const answerEl = document.getElementById(`wf-answer-${t}`);
    const colEl = document.querySelector(`[data-type="${t}"]`);
    if (!input || !answerEl || !colEl) return;

    const userVal = input.value.trim().toLowerCase();
    const correctVal = (word[t] || '').trim().toLowerCase();

    let isCorrect;
    if (correctVal === '') {
      // N/A form: blank = correct, any input = wrong
      isCorrect = userVal === '';
    } else {
      isCorrect = userVal === correctVal;
    }

    // Disable input
    input.disabled = true;

    if (isCorrect) {
      colEl.classList.add('wf-field-correct');
      colEl.classList.remove('wf-field-wrong');
      answerEl.textContent = '';
    } else {
      allCorrect = false;
      colEl.classList.add('wf-field-wrong');
      colEl.classList.remove('wf-field-correct');
      answerEl.textContent = correctVal ? `Correct: ${correctVal}` : 'Correct: (leave blank)';
    }
  });

  if (allCorrect) {
    practiceScore++;
  } else {
    practiceWrong.push(word);
  }

  // Replace Check button with Next
  if (wfPracticeActions) {
    const isLast = practiceIndex >= practiceWords.length - 1;
    wfPracticeActions.innerHTML = `
      <button class="btn btn-primary" id="btn-wf-next">
        ${isLast ? 'See Results' : 'Next'}
      </button>
    `;
    document.getElementById('btn-wf-next')?.addEventListener('click', () => {
      practiceIndex++;
      renderPracticeCard();
    });
  }
}

function showPracticeResults() {
  if (wfPracticeArea) wfPracticeArea.classList.add('hidden');
  if (!wfResults) return;

  wfResults.classList.remove('hidden');

  const total = practiceWords.length;
  const pct = Math.round((practiceScore / total) * 100);
  let resultLabel;
  if (pct >= 80) resultLabel = 'Excellent!';
  else if (pct >= 50) resultLabel = 'Good effort! Keep practicing.';
  else resultLabel = 'Keep going! Practice makes perfect.';

  let wrongHtml = '';
  if (practiceWrong.length > 0) {
    const wrongItems = practiceWrong.map(w => {
      const forms = FORM_TYPES.map(t => {
        const val = w[t] || '';
        return `
          <div class="wf-wrong-item-form">
            <span class="wf-wrong-item-form-label">${FORM_LABELS[t]}</span>
            <span class="wf-wrong-item-form-value${val ? '' : ' na'}">${val ? escapeHtml(val) : '—'}</span>
          </div>
        `;
      }).join('');
      return `
        <div class="wf-wrong-item">
          <div class="wf-wrong-item-word">${escapeHtml(baseForm(w))} ${typeBadgeHtml(w.baseType)}</div>
          <div class="wf-wrong-item-forms">${forms}</div>
        </div>
      `;
    }).join('');

    wrongHtml = `
      <div class="wf-results-wrong-list">
        <h4>Words to review (${practiceWrong.length}):</h4>
        ${wrongItems}
      </div>
    `;
  }

  wfResults.innerHTML = `
    <div class="wf-results-score">${practiceScore} / ${total}</div>
    <div class="wf-results-label">${resultLabel}</div>
    ${wrongHtml}
    <div class="wf-results-actions">
      <button class="btn btn-primary" id="btn-wf-practice-again">Practice Again</button>
      <button class="btn btn-ghost" id="btn-wf-change-words">Change Words</button>
    </div>
  `;

  document.getElementById('btn-wf-practice-again')?.addEventListener('click', () => {
    startPractice(practiceWords);
  });

  document.getElementById('btn-wf-change-words')?.addEventListener('click', () => {
    wfResults.classList.add('hidden');
    if (wfPracticeStart) wfPracticeStart.classList.remove('hidden');
  });

  updateStreakBadge();
}

// ============================================================
// GLOBAL RESTART HOOK
// ============================================================
window._restartMode = () => {
  if (practiceWords.length > 0) {
    startPractice(practiceWords);
  }
};

// ============================================================
// INIT
// ============================================================
loadForms();
