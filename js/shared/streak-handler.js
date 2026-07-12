/* ============================================================
   STREAK HANDLER
   Shared helper for recording activity and showing streak feedback.
   ============================================================ */

import { loadStreak, recordActivity, getMilestoneMessage, getDailyEncouragement } from '../features/streak.js';
import { showToast } from '../ui/toast.js';
import { showMilestoneModal } from '../ui/milestone.js';
import { showStreakFreezeModal } from '../ui/freeze.js';

// Guard so the freeze-used modal shows at most once per page load.
let _freezeNotified = false;

/**
 * Show the "streak freeze used" modal once if the last load consumed freezes.
 * Call after any loadStreak() that could surface a fresh reconciliation.
 * @param {Object} streakData  Result of loadStreak()
 * @returns {Promise<void>|void}
 */
export function maybeNotifyFreezeUsed(streakData) {
  if (_freezeNotified) return;
  if (!streakData || !(streakData.freezesConsumed > 0)) return;
  _freezeNotified = true;
  return showStreakFreezeModal({
    streak: streakData.currentStreak || 0,
    freezesUsed: streakData.freezesConsumed,
    freezesLeft: streakData.streakFreezes || 0,
  });
}

/**
 * Record a streak activity, show milestone/encouragement, and refresh the navbar badge.
 * Safe to call multiple times — recordActivity handles dedup internally.
 */
export async function handleStreakRecord(source = 'vocabulary') {
  try {
    const { streakData, isNewDay, milestone, freezeEarned } = await recordActivity({
      type: 'practice',
      source,
    });

    if (milestone) {
      const msg = getMilestoneMessage(milestone);
      await showMilestoneModal(msg);
    } else if (isNewDay) {
      const encourage = getDailyEncouragement(streakData.currentStreak);
      if (encourage) showToast(encourage, 'success', 3000);
    }

    if (freezeEarned) {
      showToast('❄️ Streak Freeze earned — a backup day if you ever miss one!', 'info', 3500);
    }

    // Refresh navbar streak badge
    const data = await loadStreak(true);
    const el = document.getElementById('navbar-streak');
    const countEl = document.getElementById('navbar-streak-count');
    if (el && countEl && (data.currentStreak > 0 || data.isActiveToday)) {
      countEl.textContent = data.currentStreak;
      el.style.display = '';
    }
  } catch (err) {
    console.warn('Streak update failed:', err);
  }
}
