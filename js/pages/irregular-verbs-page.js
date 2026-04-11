/* ============================================================
   IRREGULAR VERBS PAGE CONTROLLER
   Auth, verb table CRUD, swipe-to-delete, bulk add, 5 practice modes.
   ============================================================ */

import { guardAuth, logout } from '../core/router.js';
import { initFirebase } from '../core/firebase.js';
import {
  loadIrregularVerbs,
  addIrregularVerb,
  updateIrregularVerb,
  deleteIrregularVerb,
  toggleVerbLearned,
  detectVerbPattern,
} from '../features/irregular-verbs.js';
import { generateVerbInfo, generateBulkVerbInfo } from '../ai/word-ai.js';
import {
  showModal, closeModal, setupModalClose,
  showToast, confirmDialog, escapeHtml, showMilestoneModal,
} from '../ui/index.js';
import { loadStreak, getMilestoneMessage } from '../features/streak.js';
import { initChatWidget } from '../chat/chat-ui.js';
import { speakText } from '../shared/tts.js';
import { initIVFlashcard } from './irregular-verb-modes/flashcard.js';
import { initIVFillForms } from './irregular-verb-modes/fill-forms.js';
import { initIVQuiz } from './irregular-verb-modes/quiz.js';
import { initIVMatching } from './irregular-verb-modes/matching.js';
import { initIVSpeedConj } from './irregular-verb-modes/speed-conjugation.js';

// ---- Auth & Firebase ----
const session = guardAuth();
initFirebase(session.firebase);

document.getElementById('nav-username').textContent = session.username;
document.getElementById('nav-avatar').textContent = session.username.charAt(0).toUpperCase();
document.getElementById('btn-logout').addEventListener('click', logout);

// ---- Chat widget ----
initChatWidget(() => ({
  page: 'Irregular Verbs',
  words: allVerbs.map(v => ({ english: v.base, vietnamese: v.vietnamese })),
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
setupModalClose('#modal-verb');
setupModalClose('#modal-bulk-verb');

// ---- DOM refs: header ----
const ivVerbBadge        = document.getElementById('iv-verb-badge');
const ivLearnedProgress  = document.getElementById('iv-learned-progress');
const ivLearnedFill      = document.getElementById('iv-learned-fill');
const ivLearnedText      = document.getElementById('iv-learned-text');

// ---- DOM refs: verb table tab ----
const ivLoading          = document.getElementById('iv-loading');
const ivContent          = document.getElementById('iv-content');
const ivEmpty            = document.getElementById('iv-empty');
const ivTableWrapper     = document.getElementById('iv-table-wrapper');
const ivTbody            = document.getElementById('iv-tbody');
const ivSearchInput      = document.getElementById('iv-search-input');
const ivPatternFilter    = document.getElementById('iv-pattern-filter');
const ivSortSelect       = document.getElementById('iv-sort-select');
const btnAddVerb         = document.getElementById('btn-add-verb');
const btnBulkVerb        = document.getElementById('btn-bulk-verb');

// ---- DOM refs: verb modal ----
const modalVerbOverlay   = document.getElementById('modal-verb');
const modalVerbTitle     = document.getElementById('modal-verb-title');
const formVerb           = document.getElementById('form-verb');
const inputVerbBase      = document.getElementById('input-verb-base');
const inputVerbP2        = document.getElementById('input-verb-p2');
const inputVerbP3        = document.getElementById('input-verb-p3');
const inputVerbVi        = document.getElementById('input-verb-vi');
const inputVerbIpa       = document.getElementById('input-verb-ipa');
const btnVerbSave        = document.getElementById('btn-verb-save');
const btnVerbAiFill      = document.getElementById('btn-verb-ai-fill');
const modalVerbPatternEl = document.getElementById('modal-verb-pattern');
const modalVerbPatternBadge = document.getElementById('modal-verb-pattern-badge');

// ---- DOM refs: bulk modal ----
const modalBulkVerb      = document.getElementById('modal-bulk-verb');
const bulkVerbInput      = document.getElementById('bulk-verb-input');
const bulkVerbStepInput  = document.getElementById('bulk-verb-step-input');
const bulkVerbStepPreview= document.getElementById('bulk-verb-step-preview');
const bulkVerbLoading    = document.getElementById('bulk-verb-loading');
const bulkVerbLoadingText= document.getElementById('bulk-verb-loading-text');
const bulkVerbProgressWrap = document.getElementById('bulk-verb-progress-wrap');
const bulkVerbProgressFill = document.getElementById('bulk-verb-progress-fill');
const bulkVerbProgressCount = document.getElementById('bulk-verb-progress-count');
const bulkVerbAdding     = document.getElementById('bulk-verb-adding');
const bulkVerbAddingText = document.getElementById('bulk-verb-adding-text');
const bulkVerbPreviewTbody = document.getElementById('bulk-verb-preview-tbody');
const bulkVerbCounter    = document.getElementById('bulk-verb-counter');
const bulkVerbBtnGenerate = document.getElementById('bulk-verb-btn-generate');
const bulkVerbBtnAdd     = document.getElementById('bulk-verb-btn-add');
const bulkVerbSelectAll  = document.getElementById('bulk-verb-select-all');
const bulkVerbDeselectAll = document.getElementById('bulk-verb-deselect-all');

// ---- DOM refs: practice tab ----
const ivPracticeEmpty    = document.getElementById('iv-practice-empty');
const ivModeSelector     = document.getElementById('iv-mode-selector');

// ---- State ----
let allVerbs = [];
let filteredVerbs = [];
let editingVerbId = null;
let bulkVerbResults = [];
let practiceInitialized = false;
let currentPracticeMode = 'flashcard';

// ============================================================
// HEADER UPDATES
// ============================================================

function updateHeader() {
  const total = allVerbs.length;
  const learned = allVerbs.filter(v => v.learned).length;

  if (ivVerbBadge) {
    ivVerbBadge.textContent = `${total} verb${total !== 1 ? 's' : ''}`;
  }

  if (!ivLearnedProgress) return;

  if (total === 0) {
    ivLearnedProgress.classList.add('hidden');
    return;
  }

  const pct = Math.round((learned / total) * 100);
  ivLearnedFill.style.width = `${pct}%`;
  ivLearnedText.textContent = `${learned}/${total} learned`;
  ivLearnedProgress.classList.remove('hidden');

  if (learned === total) {
    ivLearnedProgress.classList.add('completed');
  } else {
    ivLearnedProgress.classList.remove('completed');
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
// PATTERN BADGE HELPERS
// ============================================================

const PATTERN_CLASSES = {
  AAA: 'pat-aaa',
  ABB: 'pat-abb',
  ABA: 'pat-aba',
  ABC: 'pat-abc',
};

function patternBadgeHtml(pattern) {
  const pat = pattern || 'ABC';
  const cls = PATTERN_CLASSES[pat] || 'pat-abc';
  return `<span class="iv-pattern-badge ${cls}">${escapeHtml(pat)}</span>`;
}

// ============================================================
// VERB TABLE RENDERING
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

function buildVerbRowHtml(verb) {
  return `
    <tr class="swipe-row iv-row${verb.learned ? ' learned-row' : ''}" data-id="${verb.id}">
      <td>
        <button class="btn-learned${verb.learned ? ' learned' : ''}"
                data-action="toggle-learned" data-id="${verb.id}"
                title="${verb.learned ? 'Mark as not learned' : 'Mark as learned'}"
                type="button">
          ${CHECKMARK_SVG}
        </button>
      </td>
      <td class="iv-v1">
        <div class="iv-v1-inner">
          <span>${escapeHtml(verb.base)}</span>
          <button class="btn-speak" data-action="speak"
                  data-word="${escapeHtml(verb.base)}" title="Pronounce" type="button">
            ${SPEAKER_SVG}
          </button>
        </div>
      </td>
      <td class="iv-v2">${escapeHtml(verb.pastSimple || '—')}</td>
      <td class="iv-v3">${escapeHtml(verb.pastParticiple || '—')}</td>
      <td class="iv-vn">${escapeHtml(verb.vietnamese || '—')}</td>
      <td>${patternBadgeHtml(verb.pattern)}</td>
      <td class="swipe-delete-cell">
        <button class="swipe-delete-btn" data-action="delete"
                data-id="${verb.id}" data-learned="${verb.learned}" type="button">
          ${TRASH_SVG}
          Delete
        </button>
      </td>
    </tr>
  `;
}

function computeFilteredVerbs() {
  const query = (ivSearchInput ? ivSearchInput.value.trim().toLowerCase() : '');
  const pattern = (ivPatternFilter ? ivPatternFilter.value : '');
  const sort = (ivSortSelect ? ivSortSelect.value : 'input-order');

  let result = allVerbs.filter(v => {
    const matchesQuery = !query ||
      v.base.toLowerCase().includes(query) ||
      (v.pastSimple || '').toLowerCase().includes(query) ||
      (v.pastParticiple || '').toLowerCase().includes(query) ||
      (v.vietnamese || '').toLowerCase().includes(query);
    const matchesPattern = !pattern || v.pattern === pattern;
    return matchesQuery && matchesPattern;
  });

  if (sort === 'name-az') {
    result = [...result].sort((a, b) => a.base.localeCompare(b.base));
  } else if (sort === 'name-za') {
    result = [...result].sort((a, b) => b.base.localeCompare(a.base));
  } else if (sort === 'learned') {
    result = [...result].sort((a, b) => Number(b.learned) - Number(a.learned));
  }
  // 'input-order' keeps the orderKey sort from Firestore

  return result;
}

function renderFilteredVerbs() {
  filteredVerbs = computeFilteredVerbs();

  if (!ivTbody) return;

  if (filteredVerbs.length === 0) {
    if (ivEmpty) {
      ivEmpty.classList.remove('hidden');
      const hasFilter = (ivSearchInput && ivSearchInput.value.trim()) || (ivPatternFilter && ivPatternFilter.value);
      const emptyTitle = ivEmpty.querySelector('h3');
      const emptyDesc = ivEmpty.querySelector('p');
      const emptyBtn = ivEmpty.querySelector('#btn-add-verb-empty');
      if (hasFilter && allVerbs.length > 0) {
        if (emptyTitle) emptyTitle.textContent = 'No Matching Verbs';
        if (emptyDesc) emptyDesc.textContent = 'Try a different search or filter.';
        if (emptyBtn) emptyBtn.classList.add('hidden');
      } else {
        if (emptyTitle) emptyTitle.textContent = 'No Irregular Verbs Yet';
        if (emptyDesc) emptyDesc.textContent = 'Add verbs one by one or use Bulk Add with AI to get started.';
        if (emptyBtn) emptyBtn.classList.remove('hidden');
      }
    }
    if (ivTableWrapper) ivTableWrapper.classList.add('hidden');
    return;
  }

  if (ivEmpty) ivEmpty.classList.add('hidden');
  if (ivTableWrapper) ivTableWrapper.classList.remove('hidden');

  ivTbody.innerHTML = filteredVerbs.map(buildVerbRowHtml).join('');
  initSwipeHandlers();
}

async function loadVerbs() {
  if (ivLoading) ivLoading.classList.remove('hidden');
  if (ivEmpty) ivEmpty.classList.add('hidden');
  if (ivTableWrapper) ivTableWrapper.classList.add('hidden');

  try {
    allVerbs = await loadIrregularVerbs();
    if (ivLoading) ivLoading.classList.add('hidden');
    if (ivContent) ivContent.classList.remove('hidden');
    renderFilteredVerbs();
    updateHeader();
  } catch (err) {
    console.error(err);
    if (ivLoading) ivLoading.classList.add('hidden');
    showToast('Failed to load irregular verbs.', 'error');
  }
}

// ---- Search / filter / sort ----
if (ivSearchInput)   ivSearchInput.addEventListener('input', renderFilteredVerbs);
if (ivPatternFilter) ivPatternFilter.addEventListener('change', renderFilteredVerbs);
if (ivSortSelect)    ivSortSelect.addEventListener('change', renderFilteredVerbs);

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
  const rows = ivTbody.querySelectorAll('.swipe-row');
  rows.forEach(row => {
    let startX = 0, currentX = 0, isSwiping = false;
    const SWIPE_THRESHOLD = 70;

    // Touch events
    row.addEventListener('touchstart', (e) => {
      ivTbody.querySelectorAll('.swipe-row.swiped').forEach(r => {
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
      ivTbody.querySelectorAll('.swipe-row.swiped').forEach(r => {
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
  if (!e.target.closest('.iv-table-wrapper')) {
    if (ivTbody) {
      ivTbody.querySelectorAll('.swipe-row.swiped').forEach(r => resetSwipe(r));
    }
  }
});

// ============================================================
// VERB TABLE — EVENT DELEGATION
// ============================================================

if (ivTbody) {
  // Speak button
  ivTbody.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="speak"]');
    if (!btn) return;
    e.stopPropagation();
    speakText(btn.dataset.word);
  });

  // Learned toggle
  ivTbody.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action="toggle-learned"]');
    if (!btn) return;
    e.stopPropagation();

    const verbId = btn.dataset.id;
    const verb = allVerbs.find(v => v.id === verbId);
    if (!verb) return;

    const newLearned = !verb.learned;

    // Optimistic UI update
    verb.learned = newLearned;
    btn.classList.toggle('learned', newLearned);
    btn.title = newLearned ? 'Mark as not learned' : 'Mark as learned';
    const row = btn.closest('tr');
    if (row) row.classList.toggle('learned-row', newLearned);
    updateHeader();

    try {
      await toggleVerbLearned(verbId, newLearned);
      updateStreakBadge();

      // Handle milestone stored by toggleVerbLearned
      const milestone = sessionStorage.getItem('streak_milestone');
      if (milestone) {
        sessionStorage.removeItem('streak_milestone');
        const msg = getMilestoneMessage(Number(milestone));
        if (msg) await showMilestoneModal(msg);
      }

      // Handle daily encouragement
      const encourage = sessionStorage.getItem('streak_daily_encourage');
      if (encourage) {
        sessionStorage.removeItem('streak_daily_encourage');
        showToast(encourage, 'success', 3000);
      }
    } catch (err) {
      console.error('Failed to toggle learned:', err);
      // Revert optimistic update
      verb.learned = !newLearned;
      btn.classList.toggle('learned', !newLearned);
      btn.title = !newLearned ? 'Mark as not learned' : 'Mark as learned';
      if (row) row.classList.toggle('learned-row', !newLearned);
      updateHeader();
      showToast('Failed to update verb status.', 'error');
    }
  });

  // Delete button
  ivTbody.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action="delete"]');
    if (!btn) return;
    e.stopPropagation();

    const verbId = btn.dataset.id;
    const verb = allVerbs.find(v => v.id === verbId);
    const name = verb ? verb.base : '';
    const ok = await confirmDialog(
      `Delete the verb "${name}"?`,
      { title: 'Delete Verb', confirmText: 'Delete' }
    );
    if (!ok) {
      const row = btn.closest('.swipe-row');
      if (row) resetSwipe(row);
      return;
    }

    try {
      await deleteIrregularVerb(verbId, !!verb?.learned);
      showToast('Verb deleted.', 'success');
      await loadVerbs();
    } catch (err) {
      console.error(err);
      showToast('Failed to delete verb.', 'error');
    }
  });

  // Row click — open edit modal
  ivTbody.addEventListener('click', (e) => {
    if (e.target.closest('[data-action]')) return;
    if (swipeDragOccurred) { swipeDragOccurred = false; return; }
    const row = e.target.closest('tr[data-id]');
    if (!row || row.classList.contains('swiped')) return;

    const verbId = row.dataset.id;
    const verb = allVerbs.find(v => v.id === verbId);
    if (!verb) return;

    openEditVerbModal(verb);
  });
}

// ============================================================
// ADD / EDIT VERB MODAL
// ============================================================

function updatePatternPreview() {
  if (!inputVerbBase || !inputVerbP2 || !inputVerbP3) return;
  const base = inputVerbBase.value.trim();
  const p2   = inputVerbP2.value.trim();
  const p3   = inputVerbP3.value.trim();

  if (!base && !p2 && !p3) {
    if (modalVerbPatternEl) modalVerbPatternEl.classList.add('hidden');
    return;
  }

  const pattern = detectVerbPattern(base, p2, p3);
  if (modalVerbPatternEl) modalVerbPatternEl.classList.remove('hidden');
  if (modalVerbPatternBadge) {
    modalVerbPatternBadge.textContent = pattern;
    modalVerbPatternBadge.className = `iv-pattern-badge ${PATTERN_CLASSES[pattern] || 'pat-abc'}`;
  }
}

if (inputVerbBase) inputVerbBase.addEventListener('input', updatePatternPreview);
if (inputVerbP2)   inputVerbP2.addEventListener('input', updatePatternPreview);
if (inputVerbP3)   inputVerbP3.addEventListener('input', updatePatternPreview);

function openAddVerbModal() {
  editingVerbId = null;
  if (modalVerbTitle) modalVerbTitle.textContent = 'Add Verb';
  if (btnVerbSave) btnVerbSave.textContent = 'Add';
  if (formVerb) formVerb.reset();
  if (modalVerbPatternEl) modalVerbPatternEl.classList.add('hidden');
  showModal(modalVerbOverlay);
}

function openEditVerbModal(verb) {
  editingVerbId = verb.id;
  if (modalVerbTitle) modalVerbTitle.textContent = 'Edit Verb';
  if (btnVerbSave) btnVerbSave.textContent = 'Save';
  if (inputVerbBase) inputVerbBase.value = verb.base || '';
  if (inputVerbP2)   inputVerbP2.value   = verb.pastSimple || '';
  if (inputVerbP3)   inputVerbP3.value   = verb.pastParticiple || '';
  if (inputVerbVi)   inputVerbVi.value   = verb.vietnamese || '';
  if (inputVerbIpa)  inputVerbIpa.value  = verb.ipaBase || '';
  updatePatternPreview();
  showModal(modalVerbOverlay);
}

if (btnAddVerb) {
  btnAddVerb.addEventListener('click', openAddVerbModal);
}

const btnAddVerbEmpty = document.getElementById('btn-add-verb-empty');
if (btnAddVerbEmpty) {
  btnAddVerbEmpty.addEventListener('click', openAddVerbModal);
}

// AI fill button
if (btnVerbAiFill) {
  btnVerbAiFill.addEventListener('click', async () => {
    const base = inputVerbBase ? inputVerbBase.value.trim() : '';
    if (!base) {
      showToast('Please enter the base form first.', 'warning');
      if (inputVerbBase) inputVerbBase.focus();
      return;
    }

    const ORIGINAL_HTML = btnVerbAiFill.innerHTML;
    btnVerbAiFill.disabled = true;
    btnVerbAiFill.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24"
           fill="none" stroke="currentColor" stroke-width="2"
           stroke-linecap="round" stroke-linejoin="round" class="spin">
        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
      </svg>
      Generating…
    `;

    try {
      const info = await generateVerbInfo(base);
      if (inputVerbP2  && info.pastSimple)     inputVerbP2.value  = info.pastSimple;
      if (inputVerbP3  && info.pastParticiple) inputVerbP3.value  = info.pastParticiple;
      if (inputVerbVi  && info.vietnamese)     inputVerbVi.value  = info.vietnamese;
      if (inputVerbIpa && info.ipaBase)        inputVerbIpa.value = info.ipaBase;
      updatePatternPreview();
      showToast('Fields filled by AI!', 'success');
    } catch (err) {
      console.error(err);
      showToast('AI generation failed. ' + (err.message || ''), 'error');
    } finally {
      btnVerbAiFill.disabled = false;
      btnVerbAiFill.innerHTML = ORIGINAL_HTML;
    }
  });
}

// Verb form submit
if (formVerb) {
  formVerb.addEventListener('submit', async (e) => {
    e.preventDefault();

    const base = inputVerbBase ? inputVerbBase.value.trim().toLowerCase() : '';
    const pastSimple = inputVerbP2 ? inputVerbP2.value.trim().toLowerCase() : '';
    const pastParticiple = inputVerbP3 ? inputVerbP3.value.trim().toLowerCase() : '';
    const vietnamese = inputVerbVi ? inputVerbVi.value.trim() : '';
    const ipaBase = inputVerbIpa ? inputVerbIpa.value.trim() : '';

    if (!base) {
      showToast('Base form is required.', 'warning');
      if (inputVerbBase) inputVerbBase.focus();
      return;
    }

    const originalText = btnVerbSave ? btnVerbSave.textContent : '';
    if (btnVerbSave) {
      btnVerbSave.disabled = true;
      btnVerbSave.textContent = editingVerbId ? 'Saving…' : 'Adding…';
    }

    try {
      const data = { base, pastSimple, pastParticiple, vietnamese, ipaBase };
      if (editingVerbId) {
        await updateIrregularVerb(editingVerbId, data);
        showToast('Verb updated.', 'success');
      } else {
        await addIrregularVerb(data);
        showToast('Verb added!', 'success');
      }
      closeModal(modalVerbOverlay);
      await loadVerbs();
    } catch (err) {
      console.error(err);
      showToast('Operation failed.', 'error');
    } finally {
      if (btnVerbSave) {
        btnVerbSave.disabled = false;
        btnVerbSave.textContent = originalText;
      }
    }
  });
}

// ============================================================
// BULK ADD VERBS MODAL
// ============================================================

const BULK_GENERATE_BTN_HTML = bulkVerbBtnGenerate ? bulkVerbBtnGenerate.innerHTML : '';

function parseBulkVerbInput(text) {
  const raw = [...new Set(
    text.split(/[,\n]+/)
      .map(w => w.trim().toLowerCase())
      .filter(w => w.length > 0)
  )];
  return raw;
}

function updateBulkVerbCounter() {
  if (!bulkVerbPreviewTbody || !bulkVerbCounter || !bulkVerbBtnAdd) return;
  const checked = bulkVerbPreviewTbody.querySelectorAll('input[type=checkbox]:checked').length;
  const total   = bulkVerbPreviewTbody.querySelectorAll('input[type=checkbox]').length;
  bulkVerbCounter.textContent = `${checked} / ${total} selected`;
  bulkVerbBtnAdd.disabled = checked === 0;
}

function renderBulkVerbPreview(results) {
  bulkVerbResults = results;
  if (!bulkVerbPreviewTbody) return;

  bulkVerbPreviewTbody.innerHTML = results.map((r, i) => `
    <tr>
      <td><input type="checkbox" data-index="${i}" checked /></td>
      <td>${escapeHtml(r.base || '')}</td>
      <td>${escapeHtml(r.pastSimple || '')}</td>
      <td>${escapeHtml(r.pastParticiple || '')}</td>
      <td>${escapeHtml(r.vietnamese || '')}</td>
      <td>${patternBadgeHtml(detectVerbPattern(r.base || '', r.pastSimple || '', r.pastParticiple || ''))}</td>
    </tr>
  `).join('');

  updateBulkVerbCounter();
}

function resetBulkVerbModal() {
  if (bulkVerbInput)       bulkVerbInput.value = '';
  if (bulkVerbStepInput)   bulkVerbStepInput.classList.remove('hidden');
  if (bulkVerbStepPreview) bulkVerbStepPreview.classList.add('hidden');
  if (bulkVerbLoading)     bulkVerbLoading.classList.add('hidden');
  if (bulkVerbProgressWrap) bulkVerbProgressWrap.classList.add('hidden');
  if (bulkVerbAdding)      bulkVerbAdding.classList.add('hidden');
  if (bulkVerbBtnGenerate) {
    bulkVerbBtnGenerate.classList.remove('hidden');
    bulkVerbBtnGenerate.disabled = false;
    bulkVerbBtnGenerate.innerHTML = BULK_GENERATE_BTN_HTML;
  }
  if (bulkVerbBtnAdd) bulkVerbBtnAdd.classList.add('hidden');
  bulkVerbResults = [];
}

if (btnBulkVerb) {
  btnBulkVerb.addEventListener('click', () => {
    resetBulkVerbModal();
    showModal(modalBulkVerb);
  });
}

if (bulkVerbPreviewTbody) {
  bulkVerbPreviewTbody.addEventListener('change', updateBulkVerbCounter);
  bulkVerbPreviewTbody.addEventListener('click', (e) => {
    if (e.target.type === 'checkbox') return;
    const row = e.target.closest('tr');
    if (!row) return;
    const cb = row.querySelector('input[type=checkbox]');
    if (cb) { cb.checked = !cb.checked; updateBulkVerbCounter(); }
  });
}

if (bulkVerbSelectAll) {
  bulkVerbSelectAll.addEventListener('click', () => {
    if (!bulkVerbPreviewTbody) return;
    bulkVerbPreviewTbody.querySelectorAll('input[type=checkbox]').forEach(cb => cb.checked = true);
    updateBulkVerbCounter();
  });
}
if (bulkVerbDeselectAll) {
  bulkVerbDeselectAll.addEventListener('click', () => {
    if (!bulkVerbPreviewTbody) return;
    bulkVerbPreviewTbody.querySelectorAll('input[type=checkbox]').forEach(cb => cb.checked = false);
    updateBulkVerbCounter();
  });
}

if (bulkVerbBtnGenerate) {
  bulkVerbBtnGenerate.addEventListener('click', async () => {
    const words = parseBulkVerbInput(bulkVerbInput ? bulkVerbInput.value : '');
    if (words.length === 0) {
      showToast('Please enter at least one verb.', 'warning');
      if (bulkVerbInput) bulkVerbInput.focus();
      return;
    }

    bulkVerbBtnGenerate.disabled = true;
    bulkVerbBtnGenerate.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
           fill="none" stroke="currentColor" stroke-width="2"
           stroke-linecap="round" stroke-linejoin="round" class="spin">
        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
      </svg>
      Generating…
    `;
    if (bulkVerbStepInput)  bulkVerbStepInput.classList.add('hidden');
    if (bulkVerbLoading)    bulkVerbLoading.classList.remove('hidden');
    if (bulkVerbProgressWrap) bulkVerbProgressWrap.classList.add('hidden');
    if (bulkVerbProgressFill) bulkVerbProgressFill.style.width = '0%';
    if (bulkVerbLoadingText)  bulkVerbLoadingText.textContent =
      `AI is generating details for ${words.length} verb${words.length > 1 ? 's' : ''}…`;

    let progressBarShown = false;

    try {
      const results = await generateBulkVerbInfo(words, (done, total) => {
        if (done < total) {
          if (!progressBarShown && bulkVerbProgressWrap) {
            bulkVerbProgressWrap.classList.remove('hidden');
            progressBarShown = true;
          }
          const pct = Math.round((done / total) * 100);
          if (bulkVerbProgressFill) bulkVerbProgressFill.style.width = `${pct}%`;
          if (bulkVerbProgressCount) bulkVerbProgressCount.textContent = `${done} / ${total} verbs`;
        }
      });

      if (bulkVerbLoading)    bulkVerbLoading.classList.add('hidden');
      if (bulkVerbProgressWrap) bulkVerbProgressWrap.classList.add('hidden');
      if (bulkVerbStepPreview) bulkVerbStepPreview.classList.remove('hidden');
      if (bulkVerbBtnGenerate) bulkVerbBtnGenerate.classList.add('hidden');
      if (bulkVerbBtnAdd) bulkVerbBtnAdd.classList.remove('hidden');

      renderBulkVerbPreview(results);
    } catch (err) {
      console.error(err);
      showToast('AI generation failed. ' + (err.message || ''), 'error');
      if (bulkVerbLoading)    bulkVerbLoading.classList.add('hidden');
      if (bulkVerbProgressWrap) bulkVerbProgressWrap.classList.add('hidden');
      if (bulkVerbStepInput)  bulkVerbStepInput.classList.remove('hidden');
      if (bulkVerbBtnGenerate) {
        bulkVerbBtnGenerate.disabled = false;
        bulkVerbBtnGenerate.innerHTML = BULK_GENERATE_BTN_HTML;
      }
    }
  });
}

if (bulkVerbBtnAdd) {
  bulkVerbBtnAdd.addEventListener('click', async () => {
    if (!bulkVerbPreviewTbody) return;

    const selectedIndices = Array.from(
      bulkVerbPreviewTbody.querySelectorAll('input[type=checkbox]:checked')
    ).map(cb => parseInt(cb.dataset.index));

    if (selectedIndices.length === 0) return;

    const toAdd = selectedIndices.map(i => bulkVerbResults[i]);

    bulkVerbBtnAdd.disabled = true;
    if (bulkVerbStepPreview) bulkVerbStepPreview.classList.add('hidden');
    if (bulkVerbAdding)      bulkVerbAdding.classList.remove('hidden');

    let added = 0;
    for (const verb of toAdd) {
      if (bulkVerbAddingText) {
        bulkVerbAddingText.textContent = `Adding verbs… ${added + 1} / ${toAdd.length}`;
      }
      try {
        await addIrregularVerb(verb);
        added++;
      } catch (err) {
        console.error(`Failed to add "${verb.base}":`, err);
      }
    }

    if (bulkVerbAdding) bulkVerbAdding.classList.add('hidden');
    closeModal(modalBulkVerb);

    if (added > 0) {
      showToast(`${added} verb${added > 1 ? 's' : ''} added!`, 'success');
      await loadVerbs();
    }
    if (added < toAdd.length) {
      showToast(`${toAdd.length - added} verb(s) failed to add.`, 'error');
    }
  });
}

// ============================================================
// PRACTICE TAB
// ============================================================

function refreshPracticeTab() {
  if (allVerbs.length < 4) {
    if (ivPracticeEmpty)  ivPracticeEmpty.classList.remove('hidden');
    if (ivModeSelector)   ivModeSelector.classList.add('hidden');
    return;
  }

  if (ivPracticeEmpty)  ivPracticeEmpty.classList.add('hidden');
  if (ivModeSelector)   ivModeSelector.classList.remove('hidden');

  if (!practiceInitialized) {
    practiceInitialized = true;
    startPracticeMode('flashcard');
  }
}

function startPracticeMode(mode) {
  currentPracticeMode = mode;
  try {
    if (mode === 'flashcard')        initIVFlashcard(allVerbs);
    else if (mode === 'fill-forms')  initIVFillForms(allVerbs);
    else if (mode === 'quiz')        initIVQuiz(allVerbs);
    else if (mode === 'matching')    initIVMatching(allVerbs);
    else if (mode === 'speed-conj')  initIVSpeedConj(allVerbs);
  } catch (err) {
    console.error('Failed to start practice mode:', err);
    showToast('Failed to load practice mode.', 'error');
  }
}

// Mode button switching
document.querySelectorAll('.mode-btn[data-mode]').forEach(btn => {
  btn.addEventListener('click', () => {
    if (allVerbs.length < 4) return;
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.practice-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    const mode = btn.dataset.mode;
    const panel = document.getElementById(`panel-${mode}`);
    if (panel) panel.classList.add('active');
    startPracticeMode(mode);
  });
});

// ============================================================
// GLOBAL RESTART HOOK (for result screens)
// ============================================================
window._restartMode = () => startPracticeMode(currentPracticeMode);

// ============================================================
// INIT
// ============================================================
loadVerbs();
