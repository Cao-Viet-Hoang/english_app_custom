/* ============================================================
   SENTENCE PATTERNS HUB PAGE CONTROLLER
   Sentence-topic grid display, CRUD, search/sort.
   Mirrors topics-page.js, minus the full streak-inline dashboard
   (this page uses the simple navbar streak badge from initProtectedPage()).
   ============================================================ */

import { navigateTo } from '../core/router.js';
import { initProtectedPage } from '../shared/page-init.js';
import {
  loadSentenceTopics,
  createSentenceTopic,
  renameSentenceTopic,
  deleteSentenceTopic,
} from '../features/sentence-topics.js';
import { showModal, closeModal, setupModalClose, showToast, confirmDialog, formatDate, escapeHtml } from '../ui/index.js';
import { initChatWidget } from '../chat/chat-ui.js';

// ---- Guard & Init ----
initProtectedPage();

// ---- Chat widget ----
initChatWidget(() => ({ page: 'Sentence Patterns' }));

// ---- DOM refs ----
const loadingEl    = document.getElementById('topics-loading');
const emptyEl      = document.getElementById('topics-empty');
const gridEl       = document.getElementById('topics-grid');
const countEl      = document.getElementById('topic-count');
const modalOverlay = document.getElementById('modal-topic');
const modalTitle   = document.getElementById('modal-topic-title');
const form         = document.getElementById('form-topic');
const inputName    = document.getElementById('input-topic-name');
const btnSave      = document.getElementById('btn-topic-save');
const sortSelect   = document.getElementById('sort-topics');

setupModalClose('#modal-topic');

// ---- State ----
let editingTopicId = null;
let allTopics = [];

function sortTopics(topics) {
  const val = sortSelect.value;
  const arr = [...topics];
  if (val === 'oldest') {
    arr.sort((a, b) => (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0));
  } else if (val === 'name-az') {
    arr.sort((a, b) => a.name.localeCompare(b.name));
  } else if (val === 'name-za') {
    arr.sort((a, b) => b.name.localeCompare(a.name));
  } else if (val === 'words-desc') {
    arr.sort((a, b) => (b.sentenceCount || 0) - (a.sentenceCount || 0));
  } else if (val === 'words-asc') {
    arr.sort((a, b) => (a.sentenceCount || 0) - (b.sentenceCount || 0));
  }
  // 'newest' is default order from loadSentenceTopics()
  return arr;
}

function renderTopicCards(topics) {
  gridEl.innerHTML = topics.map((t) => {
    const sc = t.sentenceCount || 0;
    const lc = t.learnedCount || 0;
    const isCompleted = sc > 0 && lc >= sc;
    const pct = sc > 0 ? Math.round((lc / sc) * 100) : 0;
    return `
      <div class="card topic-card card-clickable${isCompleted ? ' topic-completed' : ''}" data-action="open" data-id="${t.id}">
        <div class="topic-card-header">
          <span class="topic-card-title">
            ${escapeHtml(t.name)}
          </span>
          <div class="topic-card-actions">
            <button class="btn-icon" data-action="rename" data-id="${t.id}" data-name="${escapeHtml(t.name)}" title="Rename">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                   fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button class="btn-icon" data-action="delete" data-id="${t.id}" data-name="${escapeHtml(t.name)}" title="Delete">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                   fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6"/><path d="M14 11v6"/>
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="topic-card-meta">
          <span class="topic-card-meta-item">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                 fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
            </svg>
            ${sc} sentence${sc !== 1 ? 's' : ''}
          </span>
          <span class="topic-card-meta-item">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                 fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            ${t.createdAt ? formatDate(t.createdAt) : ''}
          </span>
          ${isCompleted ? `<span class="topic-card-meta-item topic-card-meta-completed">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                 fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            Completed
          </span>` : ''}
        </div>
        <div class="topic-card-progress">
          <div class="topic-card-progress-bar">
            <div class="topic-card-progress-fill" style="width:${pct}%"></div>
          </div>
          <span class="topic-card-progress-label">${lc}/${sc}</span>
        </div>
      </div>
    `;
  }).join('');
  gridEl.classList.remove('hidden');
}

// ---- Render ----
async function render() {
  loadingEl.classList.remove('hidden');
  emptyEl.classList.add('hidden');
  gridEl.classList.add('hidden');

  try {
    allTopics = await loadSentenceTopics();
    loadingEl.classList.add('hidden');

    if (allTopics.length === 0) {
      emptyEl.classList.remove('hidden');
      countEl.textContent = '';
      return;
    }

    countEl.textContent = allTopics.length;
    document.getElementById('topics-search-wrap').classList.remove('hidden');
    sortSelect.classList.remove('hidden');
    renderTopicCards(sortTopics(allTopics));

  } catch (err) {
    console.error('Failed to load sentence topics:', err);
    loadingEl.classList.add('hidden');
    showToast('Failed to load sentence topics. Please try again.', 'error');
  }
}

sortSelect.addEventListener('change', () => {
  renderTopicCards(sortTopics(allTopics));
});

// ---- Event delegation on grid ----
gridEl.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;

  const action = btn.dataset.action;
  const id   = btn.dataset.id;
  const name = btn.dataset.name;

  if (action === 'open') {
    navigateTo('sentence-topic-detail.html', { topicId: id });
  }

  if (action === 'rename') {
    editingTopicId = id;
    modalTitle.textContent = 'Rename Topic';
    btnSave.textContent = 'Save';
    inputName.value = name;
    showModal(modalOverlay);
  }

  if (action === 'delete') {
    const ok = await confirmDialog(
      `Delete topic "${name}" and all its sentences?`,
      { title: 'Delete Topic', confirmText: 'Delete' }
    );
    if (!ok) return;

    try {
      await deleteSentenceTopic(id);
      showToast('Topic deleted.', 'success');
      render();
    } catch (err) {
      console.error(err);
      showToast('Failed to delete topic.', 'error');
    }
  }
});

// ---- New topic buttons ----
function openNewTopicModal() {
  editingTopicId = null;
  modalTitle.textContent = 'New Topic';
  btnSave.textContent = 'Create';
  inputName.value = '';
  showModal(modalOverlay);
}

document.getElementById('btn-new-topic').addEventListener('click', openNewTopicModal);
document.getElementById('btn-new-topic-empty').addEventListener('click', openNewTopicModal);

// ---- Form submit (create or rename) ----
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = inputName.value.trim();
  if (!name) return;

  // Check for duplicate topic name (case-insensitive)
  const duplicate = allTopics.find(t =>
    t.name.toLowerCase() === name.toLowerCase() && t.id !== editingTopicId
  );
  if (duplicate) {
    const ok = await confirmDialog(
      `A topic named "${duplicate.name}" already exists. Do you still want to ${editingTopicId ? 'rename' : 'create'} it?`,
      {
        title: 'Duplicate Topic Name',
        confirmText: editingTopicId ? 'Rename Anyway' : 'Create Anyway',
        cancelText: 'Cancel',
        confirmClass: 'btn-warning',
      }
    );
    if (!ok) return;
  }

  btnSave.disabled = true;

  try {
    if (editingTopicId) {
      await renameSentenceTopic(editingTopicId, name);
      showToast('Topic renamed.', 'success');
    } else {
      await createSentenceTopic(name);
      showToast('Topic created!', 'success');
    }
    closeModal(modalOverlay);
    render();
  } catch (err) {
    console.error(err);
    showToast('Operation failed. Please try again.', 'error');
  } finally {
    btnSave.disabled = false;
  }
});

// ---- Search / filter topics ----
const searchInput = document.getElementById('input-search-topics');
searchInput.addEventListener('input', () => {
  const q = searchInput.value.toLowerCase().trim();
  const filtered = q
    ? allTopics.filter((t) => t.name.toLowerCase().includes(q))
    : allTopics;
  renderTopicCards(sortTopics(filtered));
});

// ---- Initial load ----
render();
