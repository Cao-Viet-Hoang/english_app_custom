/* ============================================================
   STREAK HANDLER
   Shared helper for recording activity and showing streak feedback.
   ============================================================ */

import { loadStreak, recordActivity, getMilestoneMessage, getDailyEncouragement } from '../features/streak.js';
import { showToast } from '../ui/toast.js';
import { showMilestoneModal } from '../ui/milestone.js';

/**
 * Record a streak activity, show milestone/encouragement, and refresh the navbar badge.
 * Safe to call multiple times — recordActivity handles dedup internally.
 */
export async function handleStreakRecord() {
  try {
    const { streakData, isNewDay, milestone } = await recordActivity('practice');

    if (milestone) {
      const msg = getMilestoneMessage(milestone);
      await showMilestoneModal(msg);
    } else if (isNewDay) {
      const encourage = getDailyEncouragement(streakData.currentStreak);
      if (encourage) showToast(encourage, 'success', 3000);
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
