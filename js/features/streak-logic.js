/* ============================================================
   STREAK LOGIC (pure)
   Dependency-free streak math: freeze earning, gap reconciliation.
   No Firestore, DOM, or globals here — safe to unit-test directly.
   ============================================================ */

// Number of real study days required to earn one streak freeze.
export const FREEZE_EARN_THRESHOLD = 7;
// Maximum freezes a user can hold at once.
export const MAX_STREAK_FREEZES = 2;
// Freezes granted to brand-new users and to existing users on migration.
export const NEW_USER_FREEZES = 1;

// ---- Date helpers (operate on "YYYY-MM-DD" strings, timezone-agnostic) ----

const MS_PER_DAY = 86400000;

function parseDateString(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

/**
 * Whole-day difference (b - a) between two "YYYY-MM-DD" strings.
 * Positive when b is later than a. Returns NaN on missing input.
 */
export function daysBetween(a, b) {
  if (!a || !b) return NaN;
  return Math.round((parseDateString(b) - parseDateString(a)) / MS_PER_DAY);
}

/**
 * Add n days to a "YYYY-MM-DD" string, returning a "YYYY-MM-DD" string.
 */
export function addDays(dateStr, n) {
  const d = new Date(parseDateString(dateStr) + n * MS_PER_DAY);
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
  const da = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

/**
 * Count missed calendar days between lastActiveDate and today, excluding today.
 * lastActive == today  → 0 (active today)
 * lastActive == yesterday → 0 (streak intact, nothing missed)
 * lastActive == N days ago → N - 1 missed days
 * @param {string} lastActiveDate  "YYYY-MM-DD" or ""
 * @param {string} today           "YYYY-MM-DD"
 * @returns {number}
 */
export function computeMissedDays(lastActiveDate, today) {
  if (!lastActiveDate) return 0;
  const gap = daysBetween(lastActiveDate, today);
  if (!Number.isFinite(gap) || gap <= 1) return 0;
  return gap - 1;
}

/**
 * Reconcile a streak on load: bridge missed days with available freezes,
 * or break the streak when there are not enough freezes. Pure — returns the
 * intended next state plus metadata; the caller persists it.
 *
 * @param {Object}  s
 * @param {string}  s.lastActiveDate   Last covered date ("YYYY-MM-DD" or "")
 * @param {string}  s.today            Today ("YYYY-MM-DD")
 * @param {string}  s.yesterday        Yesterday ("YYYY-MM-DD")
 * @param {number}  s.currentStreak    Current streak count
 * @param {number}  s.streakFreezes    Freezes currently held
 * @returns {{
 *   changed: boolean,
 *   currentStreak: number,
 *   streakFreezes: number,
 *   lastActiveDate: string,
 *   freezesConsumed: number,
 *   frozenDates: string[],
 *   justBroke: boolean,
 *   previousStreak: number,
 *   isActiveToday: boolean,
 *   isStreakAtRisk: boolean
 * }}
 */
export function reconcileStreak({
  lastActiveDate,
  today,
  yesterday,
  currentStreak = 0,
  streakFreezes = 0,
}) {
  const isActiveToday = lastActiveDate === today;
  const missedDays = computeMissedDays(lastActiveDate, today);

  const result = {
    changed: false,
    currentStreak,
    streakFreezes,
    lastActiveDate,
    freezesConsumed: 0,
    frozenDates: [],
    justBroke: false,
    previousStreak: currentStreak,
    isActiveToday,
    isStreakAtRisk: false,
  };

  // No gap: active today, or streak intact through yesterday.
  if (missedDays === 0) {
    result.isStreakAtRisk = lastActiveDate === yesterday && !isActiveToday;
    return result;
  }

  // There is a gap, but nothing to protect (new user or already-broken streak).
  if (!lastActiveDate || currentStreak <= 0) {
    return result;
  }

  if (streakFreezes >= missedDays) {
    // Enough freezes to cover every missed day → streak survives (does not grow).
    const frozenDates = [];
    for (let i = 1; i <= missedDays; i++) {
      frozenDates.push(addDays(lastActiveDate, i));
    }
    result.changed = true;
    result.streakFreezes = streakFreezes - missedDays;
    result.freezesConsumed = missedDays;
    result.frozenDates = frozenDates;
    result.lastActiveDate = yesterday; // streak now contiguous through yesterday
    result.isStreakAtRisk = true;      // must act today to keep it going
    return result;
  }

  // Not enough freezes to bridge the gap → streak breaks.
  // Freezes are kept (spending them here would be wasted — a gap remains).
  result.changed = true;
  result.currentStreak = 0;
  result.justBroke = true;
  return result;
}

/**
 * Apply freeze earning for a single new real study day. Pure.
 * Accrues one day toward the next freeze; grants a freeze on reaching the
 * threshold, capped at maxStreakFreezes. While at the cap, accrual pauses.
 *
 * @param {Object} s
 * @param {number} s.streakFreezes
 * @param {number} s.activeDaysToNextFreeze
 * @param {number} [s.maxStreakFreezes]
 * @param {number} [s.threshold]
 * @returns {{ streakFreezes: number, activeDaysToNextFreeze: number, earned: boolean }}
 */
export function earnFreezeOnActiveDay({
  streakFreezes = 0,
  activeDaysToNextFreeze = 0,
  maxStreakFreezes = MAX_STREAK_FREEZES,
  threshold = FREEZE_EARN_THRESHOLD,
}) {
  // At cap → pause accrual, hold progress steady.
  if (streakFreezes >= maxStreakFreezes) {
    return { streakFreezes, activeDaysToNextFreeze, earned: false };
  }

  let count = activeDaysToNextFreeze + 1;
  let freezes = streakFreezes;
  let earned = false;

  if (count >= threshold) {
    freezes += 1;
    count -= threshold;
    earned = true;
  }

  return { streakFreezes: freezes, activeDaysToNextFreeze: count, earned };
}
