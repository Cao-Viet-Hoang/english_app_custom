/* ============================================================
   STREAK LOGIC TESTS
   Run: node test/streak-logic.test.js
   ============================================================ */

import {
  FREEZE_EARN_THRESHOLD,
  MAX_STREAK_FREEZES,
  NEW_USER_FREEZES,
  daysBetween,
  addDays,
  computeMissedDays,
  reconcileStreak,
  earnFreezeOnActiveDay,
} from '../js/features/streak-logic.js';

import {
  describe,
  it,
  assertEqual,
  assertDeepEqual,
  assertTrue,
  assertFalse,
  finish,
} from './harness.js';

// ------------------------------------------------------------
// Date helpers
// ------------------------------------------------------------

describe('daysBetween', () => {
  it('is 0 for the same day', () => {
    assertEqual(daysBetween('2026-07-12', '2026-07-12'), 0);
  });
  it('is 1 for consecutive days', () => {
    assertEqual(daysBetween('2026-07-12', '2026-07-13'), 1);
  });
  it('is negative when b precedes a', () => {
    assertEqual(daysBetween('2026-07-13', '2026-07-12'), -1);
  });
  it('spans month boundaries', () => {
    assertEqual(daysBetween('2026-07-31', '2026-08-01'), 1);
  });
  it('spans year boundaries', () => {
    assertEqual(daysBetween('2025-12-31', '2026-01-01'), 1);
  });
  it('handles leap day', () => {
    assertEqual(daysBetween('2024-02-28', '2024-03-01'), 2);
  });
  it('returns NaN on missing input', () => {
    assertTrue(Number.isNaN(daysBetween('', '2026-07-12')));
  });
});

describe('addDays', () => {
  it('adds a day', () => {
    assertEqual(addDays('2026-07-12', 1), '2026-07-13');
  });
  it('subtracts a day', () => {
    assertEqual(addDays('2026-07-12', -1), '2026-07-11');
  });
  it('rolls over a month', () => {
    assertEqual(addDays('2026-07-31', 1), '2026-08-01');
  });
  it('rolls over a year', () => {
    assertEqual(addDays('2025-12-31', 1), '2026-01-01');
  });
  it('zero-pads month and day', () => {
    assertEqual(addDays('2026-01-05', 4), '2026-01-09');
  });
});

describe('computeMissedDays', () => {
  it('is 0 when active today', () => {
    assertEqual(computeMissedDays('2026-07-12', '2026-07-12'), 0);
  });
  it('is 0 when last active was yesterday', () => {
    assertEqual(computeMissedDays('2026-07-11', '2026-07-12'), 0);
  });
  it('is 1 when one day was missed', () => {
    assertEqual(computeMissedDays('2026-07-10', '2026-07-12'), 1);
  });
  it('is 2 when two days were missed', () => {
    assertEqual(computeMissedDays('2026-07-09', '2026-07-12'), 2);
  });
  it('is 0 for empty lastActiveDate', () => {
    assertEqual(computeMissedDays('', '2026-07-12'), 0);
  });
  it('is 0 for a future lastActiveDate (clock skew)', () => {
    assertEqual(computeMissedDays('2026-07-20', '2026-07-12'), 0);
  });
});

// ------------------------------------------------------------
// earnFreezeOnActiveDay
// ------------------------------------------------------------

describe('earnFreezeOnActiveDay', () => {
  it('accrues one day below the threshold without earning', () => {
    const r = earnFreezeOnActiveDay({ streakFreezes: 0, activeDaysToNextFreeze: 0 });
    assertEqual(r.streakFreezes, 0);
    assertEqual(r.activeDaysToNextFreeze, 1);
    assertFalse(r.earned);
  });

  it('grants a freeze when the threshold is reached and resets the counter', () => {
    const r = earnFreezeOnActiveDay({
      streakFreezes: 0,
      activeDaysToNextFreeze: FREEZE_EARN_THRESHOLD - 1,
    });
    assertEqual(r.streakFreezes, 1);
    assertEqual(r.activeDaysToNextFreeze, 0);
    assertTrue(r.earned);
  });

  it('pauses accrual while at the cap', () => {
    const r = earnFreezeOnActiveDay({
      streakFreezes: MAX_STREAK_FREEZES,
      activeDaysToNextFreeze: 3,
    });
    assertEqual(r.streakFreezes, MAX_STREAK_FREEZES);
    assertEqual(r.activeDaysToNextFreeze, 3);
    assertFalse(r.earned);
  });

  it('does not exceed the cap even when the threshold is reached', () => {
    // One below cap, at threshold-1 → earns the last freeze up to the cap.
    const r = earnFreezeOnActiveDay({
      streakFreezes: MAX_STREAK_FREEZES - 1,
      activeDaysToNextFreeze: FREEZE_EARN_THRESHOLD - 1,
    });
    assertEqual(r.streakFreezes, MAX_STREAK_FREEZES);
    assertTrue(r.earned);
  });

  it('honours a custom threshold', () => {
    const r = earnFreezeOnActiveDay({ streakFreezes: 0, activeDaysToNextFreeze: 4, threshold: 5 });
    assertEqual(r.streakFreezes, 1);
    assertEqual(r.activeDaysToNextFreeze, 0);
    assertTrue(r.earned);
  });
});

// ------------------------------------------------------------
// reconcileStreak
// ------------------------------------------------------------

describe('reconcileStreak', () => {
  const base = { today: '2026-07-12', yesterday: '2026-07-11' };

  it('does nothing when active today', () => {
    const r = reconcileStreak({ ...base, lastActiveDate: '2026-07-12', currentStreak: 5, streakFreezes: 2 });
    assertFalse(r.changed);
    assertTrue(r.isActiveToday);
    assertFalse(r.isStreakAtRisk);
    assertEqual(r.currentStreak, 5);
    assertEqual(r.streakFreezes, 2);
  });

  it('flags at-risk when last active was yesterday', () => {
    const r = reconcileStreak({ ...base, lastActiveDate: '2026-07-11', currentStreak: 5, streakFreezes: 2 });
    assertFalse(r.changed);
    assertFalse(r.isActiveToday);
    assertTrue(r.isStreakAtRisk);
    assertEqual(r.currentStreak, 5);
  });

  it('consumes one freeze to bridge a single missed day', () => {
    const r = reconcileStreak({ ...base, lastActiveDate: '2026-07-10', currentStreak: 5, streakFreezes: 2 });
    assertTrue(r.changed);
    assertEqual(r.freezesConsumed, 1);
    assertEqual(r.streakFreezes, 1);
    assertEqual(r.currentStreak, 5, 'streak is preserved, not incremented');
    assertEqual(r.lastActiveDate, '2026-07-11', 'streak now contiguous through yesterday');
    assertDeepEqual(r.frozenDates, ['2026-07-11']);
    assertTrue(r.isStreakAtRisk);
    assertFalse(r.justBroke);
  });

  it('consumes two freezes to bridge two missed days', () => {
    const r = reconcileStreak({ ...base, lastActiveDate: '2026-07-09', currentStreak: 8, streakFreezes: 2 });
    assertTrue(r.changed);
    assertEqual(r.freezesConsumed, 2);
    assertEqual(r.streakFreezes, 0);
    assertEqual(r.currentStreak, 8);
    assertDeepEqual(r.frozenDates, ['2026-07-10', '2026-07-11']);
  });

  it('breaks when freezes cannot cover the gap and keeps the freezes', () => {
    const r = reconcileStreak({ ...base, lastActiveDate: '2026-07-09', currentStreak: 8, streakFreezes: 1 });
    assertTrue(r.changed);
    assertTrue(r.justBroke);
    assertEqual(r.currentStreak, 0);
    assertEqual(r.previousStreak, 8);
    assertEqual(r.streakFreezes, 1, 'freezes are not wasted on an unbridgeable gap');
    assertEqual(r.freezesConsumed, 0);
    assertDeepEqual(r.frozenDates, []);
  });

  it('breaks when there are no freezes at all', () => {
    const r = reconcileStreak({ ...base, lastActiveDate: '2026-07-10', currentStreak: 3, streakFreezes: 0 });
    assertTrue(r.justBroke);
    assertEqual(r.currentStreak, 0);
  });

  it('does nothing for a brand-new user (no last active date)', () => {
    const r = reconcileStreak({ ...base, lastActiveDate: '', currentStreak: 0, streakFreezes: 1 });
    assertFalse(r.changed);
    assertFalse(r.justBroke);
    assertEqual(r.streakFreezes, 1);
  });

  it('does not break an already-zero streak on a gap', () => {
    const r = reconcileStreak({ ...base, lastActiveDate: '2026-07-01', currentStreak: 0, streakFreezes: 2 });
    assertFalse(r.changed);
    assertFalse(r.justBroke);
    assertEqual(r.freezesConsumed, 0);
  });
});

// ------------------------------------------------------------
// End-to-end simulation
// A minimal state machine mirroring loadStreak (reconcile) and
// recordActivity (new-day earning), driven day by day.
// ------------------------------------------------------------

function newState() {
  return {
    currentStreak: 0,
    longestStreak: 0,
    lastActiveDate: '',
    totalActiveDays: 0,
    streakFreezes: NEW_USER_FREEZES,
    maxStreakFreezes: MAX_STREAK_FREEZES,
    activeDaysToNextFreeze: 0,
  };
}

/** Mirror of loadStreak's reconcile step. Mutates state, returns metadata. */
function openApp(state, today) {
  const yesterday = addDays(today, -1);
  const rec = reconcileStreak({
    lastActiveDate: state.lastActiveDate,
    today,
    yesterday,
    currentStreak: state.currentStreak,
    streakFreezes: state.streakFreezes,
  });
  state.currentStreak = rec.currentStreak;
  state.streakFreezes = rec.streakFreezes;
  state.lastActiveDate = rec.lastActiveDate;
  return rec;
}

/** Mirror of recordActivity's new-day path. Mutates state, returns metadata. */
function study(state, today) {
  const yesterday = addDays(today, -1);
  if (state.lastActiveDate === today) return { isNewDay: false, freezeEarned: false };
  const newStreak = state.lastActiveDate === yesterday ? state.currentStreak + 1 : 1;
  const earn = earnFreezeOnActiveDay({
    streakFreezes: state.streakFreezes,
    activeDaysToNextFreeze: state.activeDaysToNextFreeze,
    maxStreakFreezes: state.maxStreakFreezes,
  });
  state.currentStreak = newStreak;
  state.longestStreak = Math.max(state.longestStreak, newStreak);
  state.totalActiveDays += 1;
  state.lastActiveDate = today;
  state.streakFreezes = earn.streakFreezes;
  state.activeDaysToNextFreeze = earn.activeDaysToNextFreeze;
  return { isNewDay: true, freezeEarned: earn.earned };
}

describe('simulation: new user builds a streak', () => {
  it('reaches a 7-day streak and earns a freeze on day 7', () => {
    const s = newState();
    const start = '2026-07-01';
    let earnedOnDay = 0;
    for (let i = 0; i < 7; i++) {
      const day = addDays(start, i);
      openApp(s, day);
      const r = study(s, day);
      if (r.freezeEarned) earnedOnDay = i + 1;
    }
    assertEqual(s.currentStreak, 7);
    assertEqual(earnedOnDay, 7, 'freeze earned exactly on the 7th study day');
    assertEqual(s.streakFreezes, 2, 'starter freeze (1) + earned freeze (1) = cap');
    assertEqual(s.activeDaysToNextFreeze, 0);
  });
});

describe('simulation: a single missed day is auto-frozen', () => {
  it('keeps the streak alive and consumes exactly one freeze', () => {
    const s = newState();
    const start = '2026-07-01';
    for (let i = 0; i < 7; i++) {
      const day = addDays(start, i);
      openApp(s, day);
      study(s, day);
    }
    // Study days were 07-01..07-07. Skip 07-08. Open + study on 07-09.
    assertEqual(s.streakFreezes, 2);
    const resumeDay = '2026-07-09';
    const rec = openApp(s, resumeDay);
    assertEqual(rec.freezesConsumed, 1, 'one freeze bridges the missed 07-08');
    assertDeepEqual(rec.frozenDates, ['2026-07-08']);
    assertEqual(s.currentStreak, 7, 'streak held during the frozen day');
    const r = study(s, resumeDay);
    assertTrue(r.isNewDay);
    assertEqual(s.currentStreak, 8, 'streak resumes and grows after the freeze');
    assertEqual(s.streakFreezes, 1, 'one freeze remains');
  });
});

describe('simulation: missing more days than freezes breaks the streak', () => {
  it('breaks after a 3-day gap with only 2 freezes', () => {
    const s = newState();
    const start = '2026-07-01';
    for (let i = 0; i < 7; i++) {
      const day = addDays(start, i);
      openApp(s, day);
      study(s, day);
    }
    // 2 freezes held. Skip 07-08, 07-09, 07-10 (3 missed days). Open on 07-11.
    assertEqual(s.streakFreezes, 2);
    const rec = openApp(s, '2026-07-11');
    assertTrue(rec.justBroke);
    assertEqual(s.currentStreak, 0);
    assertEqual(s.streakFreezes, 2, 'freezes are preserved when the gap cannot be bridged');
    // A fresh study starts a new streak at 1.
    const r = study(s, '2026-07-11');
    assertTrue(r.isNewDay);
    assertEqual(s.currentStreak, 1);
  });
});

describe('simulation: earn → cap → consume → re-earn cycle', () => {
  it('replenishes a consumed freeze after another 7 study days', () => {
    const s = newState();
    let day = '2026-07-01';
    // 7 study days → freezes at cap (2)
    for (let i = 0; i < 7; i++) {
      openApp(s, day);
      study(s, day);
      day = addDays(day, 1);
    }
    assertEqual(s.streakFreezes, 2);
    // Skip one day (day is currently 07-08). Resume on 07-09 → consume 1 freeze.
    day = '2026-07-09';
    openApp(s, day);
    assertEqual(s.streakFreezes, 1);
    study(s, day);            // studying 07-09, freezes still 1, accrual resumes at 1
    day = addDays(day, 1);
    // Study 6 more consecutive days → 7 accrued since consume → earn 1 back.
    let reEarned = false;
    for (let i = 0; i < 6; i++) {
      openApp(s, day);
      const r = study(s, day);
      if (r.freezeEarned) reEarned = true;
      day = addDays(day, 1);
    }
    assertTrue(reEarned, 'a freeze is re-earned after 7 study days post-consumption');
    assertEqual(s.streakFreezes, 2);
  });
});

// ------------------------------------------------------------
finish();
