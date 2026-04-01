/* ============================================================
   TOPICS PAGE CONTROLLER
   Topic grid display, CRUD, search/sort, streak dashboard.
   ============================================================ */

import { guardAuth, logout, navigateTo } from '../core/router.js';
import { initFirebase } from '../core/firebase.js';
import { loadTopics, createTopic, renameTopic, deleteTopic } from '../features/topics.js';
import { showModal, closeModal, setupModalClose, showToast, confirmDialog, formatDate, escapeHtml, showMilestoneModal } from '../ui/index.js';
import { loadStreak, loadActivityHistory, getMilestoneMessage, getDailyEncouragement } from '../features/streak.js';
import { initChatWidget } from '../chat/chat-ui.js';

// ---- Guard & Init ----
const session = guardAuth();
initFirebase(session.firebase);

document.getElementById('nav-username').textContent = session.username;
document.getElementById('nav-avatar').textContent = session.username.charAt(0).toUpperCase();
document.getElementById('btn-logout').addEventListener('click', logout);

// ---- Chat widget ----
initChatWidget(() => ({ page: 'Topics' }));

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

setupModalClose('#modal-topic');
setupModalClose('#modal-activity-log');

// ---- Streak rendering (compact inline) ----
const streakEl = document.getElementById('streak-inline');
const FLAME_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
  <path d="M8 16c3.314 0 6-2 6-5.5 0-1.5-.5-4-2.5-6 .25 1.5-1.25 2-1.25 2C11 4 9 .5 8 0 7.5 2 5.5 4 4.75 4.75 4.75 4.75 3.25 4.25 3.5 2.75 1.5 4.75 1 7.25 1 8.75 1 12.25 4.686 16 8 16zm0-1c-1.657 0-3-1-3-2.75 0-.75.25-2 1.25-3 .125.75 1 1.25 1 1.25S8 9 8 8c.5 1 1.5 2 2 3 .75.75 1 1.5 1 2.25C11 14 9.657 15 8 15z"/>
</svg>`;
const DAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

function getWeekDates() {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Sun
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + mondayOffset + i);
    dates.push(d.toLocaleDateString('en-CA'));
  }
  return dates;
}

function renderStreakInline(streakData, weekActivity) {
  const { currentStreak, isActiveToday, isStreakAtRisk } = streakData;
  const isNew = currentStreak === 0 && !isActiveToday && (streakData.totalActiveDays || 0) === 0;
  const today = new Date().toLocaleDateString('en-CA');
  const weekDates = getWeekDates();

  const activityMap = {};
  if (weekActivity) weekActivity.forEach(a => { activityMap[a.date] = a; });

  const flameClass = isActiveToday ? 'active' : (isStreakAtRisk ? 'at-risk' : (isNew ? 'new-user' : ''));

  const weekDotsHtml = weekDates.map((dateStr, i) => {
    const isToday = dateStr === today;
    const isActive = !!activityMap[dateStr];
    let dotClass = 'streak-week-dot';
    if (isToday) dotClass += ' today';
    if (isActive) dotClass += ' active';
    return `<div class="streak-week-day">
      <span class="streak-week-label">${DAY_LABELS[i]}</span>
      <span class="${dotClass}"></span>
    </div>`;
  }).join('');

  let tooltip = '';
  if (isNew) tooltip = 'Start your first streak!';
  else if (isStreakAtRisk) tooltip = "Don't lose your streak!";
  else if (isActiveToday) tooltip = 'Great job! Keep it up!';

  const encouragement = isActiveToday ? getDailyEncouragement(currentStreak) : null;
  const encourageHtml = encouragement
    ? `<div class="streak-inline-divider"></div><span class="streak-inline-encourage">${encouragement}</span>`
    : '';

  streakEl.innerHTML = `
    <div class="streak-inline-flame ${flameClass}">${FLAME_SVG}</div>
    <span class="streak-inline-count">${currentStreak}</span>
    <div class="streak-inline-divider"></div>
    <div class="streak-week">${weekDotsHtml}</div>
    ${encourageHtml}
  `;
  streakEl.title = tooltip;
  streakEl.style.display = '';
  streakEl.addEventListener('click', openActivityLog);
}

async function openActivityLog() {
  showModal('#modal-activity-log');
  const bodyEl = document.getElementById('activity-log-body');
  const statsEl = document.getElementById('activity-log-stats');
  bodyEl.innerHTML = '<div class="text-center" style="padding:var(--sp-6)"><div class="spinner"></div></div>';

  try {
    const [history, streakData] = await Promise.all([
      loadActivityHistory(365),
      loadStreak(),
    ]);

    const activityMap = {};
    history.forEach(a => { activityMap[a.date] = a; });

    // Build 4 quarters (current + 3 previous), each row = 3 months
    const today = new Date();
    const todayStr = today.toLocaleDateString('en-CA');
    const currentQuarterIdx = Math.floor(today.getMonth() / 3);
    let html = '';

    for (let q = 0; q < 4; q++) {
      const totalQ = today.getFullYear() * 4 + currentQuarterIdx - q;
      const qYear = Math.floor(totalQ / 4);
      const qIdx = ((totalQ % 4) + 4) % 4;
      const startMonth = qIdx * 3;
      const quarterLabel = `Q${qIdx + 1} ${qYear}`;

      let monthsHtml = '';
      for (let mo = 0; mo < 3; mo++) {
        const month = startMonth + mo;
        const year = qYear;
        const monthName = new Date(year, month, 1).toLocaleDateString('en-US', { month: 'short' });
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDayOfWeek = new Date(year, month, 1).getDay();
        const offset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

        monthsHtml += `<div class="activity-month">
          <div class="activity-month-label">${escapeHtml(monthName)}</div>
          <div class="activity-grid">
            ${DAY_LABELS.map(d => `<div class="activity-grid-header">${d}</div>`).join('')}
            ${'<div class="activity-day empty"></div>'.repeat(offset)}
            ${Array.from({ length: daysInMonth }, (_, i) => {
              const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
              const a = activityMap[dayStr];
              const learned = a ? (a.wordsLearned || 0) : 0;
              const practiced = a ? (a.practiceCount || 0) : 0;
              const total = learned + practiced;
              let levelClass = '';
              if (total >= 5) levelClass = 'level-3';
              else if (total >= 2) levelClass = 'level-2';
              else if (total >= 1) levelClass = 'level-1';
              const todayClass = dayStr === todayStr ? ' today' : '';
              let title = dayStr;
              if (total > 0) {
                const parts = [];
                if (learned > 0) parts.push(`${learned} learned`);
                if (practiced > 0) parts.push(`${practiced} practiced`);
                title = `${dayStr}: ${parts.join(', ')}`;
              }
              return `<div class="activity-day${levelClass ? ' ' + levelClass : ''}${todayClass}" title="${title}"></div>`;
            }).join('')}
          </div>
        </div>`;
      }

      html += `<div class="activity-quarter">
        <div class="activity-quarter-label">${escapeHtml(quarterLabel)}</div>
        <div class="activity-quarter-months">${monthsHtml}</div>
      </div>`;
    }
    bodyEl.innerHTML = html;

    statsEl.innerHTML = `
      <span class="activity-stat"><span class="streak-stat-value">${streakData.totalActiveDays || 0}</span> active</span>
      <span class="activity-stat">🔥 <span class="streak-stat-value">${streakData.currentStreak || 0}</span> streak</span>
      <span class="activity-stat">⭐ <span class="streak-stat-value">${streakData.longestStreak || 0}</span> best</span>
    `;
  } catch (err) {
    console.error('Failed to load activity log:', err);
    bodyEl.innerHTML = '<p class="text-center" style="color:var(--color-danger)">Failed to load activity log.</p>';
  }
}

async function initStreak() {
  try {
    const [streakData, weekHistory] = await Promise.all([
      loadStreak(),
      loadActivityHistory(7),
    ]);

    renderStreakInline(streakData, weekHistory);

    // Show broken streak toast
    if (streakData.justBroke && streakData.previousStreak > 0) {
      showToast(`Your ${streakData.previousStreak}-day streak ended. Start a new one today!`, 'warning', 5000);
    }

    // Check for pending milestone celebration
    const pendingMilestone = sessionStorage.getItem('streak_milestone');
    if (pendingMilestone) {
      sessionStorage.removeItem('streak_milestone');
      const ms = parseInt(pendingMilestone, 10);
      if (ms > 0) {
        const info = getMilestoneMessage(ms);
        showMilestoneModal(info);
      }
    }
  } catch (err) {
    console.error('Failed to load streak:', err);
  }
}

// ---- State ----
let editingTopicId = null;
let allTopics = [];

const sortSelect = document.getElementById('sort-topics');

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
    arr.sort((a, b) => (b.wordCount || 0) - (a.wordCount || 0));
  } else if (val === 'words-asc') {
    arr.sort((a, b) => (a.wordCount || 0) - (b.wordCount || 0));
  }
  // 'newest' is default order from loadTopics()
  return arr;
}

function renderTopicCards(topics) {
  gridEl.innerHTML = topics.map((t) => {
    const wc = t.wordCount || 0;
    const lc = t.learnedCount || 0;
    const isCompleted = wc > 0 && lc >= wc;
    const pct = wc > 0 ? Math.round((lc / wc) * 100) : 0;
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
              <path d="M4 7V4a2 2 0 0 1 2-2h8.5L20 7.5V20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            ${wc} word${wc !== 1 ? 's' : ''}
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
          <span class="topic-card-progress-label">${lc}/${wc}</span>
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
    allTopics = await loadTopics();
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
    console.error('Failed to load topics:', err);
    loadingEl.classList.add('hidden');
    showToast('Failed to load topics. Please try again.', 'error');
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
    navigateTo('topic-detail.html', { topicId: id });
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
      `Delete topic "${name}" and all its vocabulary and paragraphs?`,
      { title: 'Delete Topic', confirmText: 'Delete' }
    );
    if (!ok) return;

    try {
      await deleteTopic(id);
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
      await renameTopic(editingTopicId, name);
      showToast('Topic renamed.', 'success');
    } else {
      await createTopic(name);
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
initStreak();
render();
