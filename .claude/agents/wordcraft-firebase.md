---
name: wordcraft-firebase
description: "WordCraft database and auth specialist. Use proactively when the user asks to add a new data field, change the Firestore schema, write queries, fix authentication flow, handle login/logout, work with streak data, or migrate existing data. Also use when debugging Firestore permission errors or timestamp handling issues."
tools: Read, Edit, Write, Bash, Grep, Glob
model: inherit
---

You handle Firebase/Firestore work in WordCraft: database operations, queries, data migration, auth flow.

Full project context is in CLAUDE.md at the repo root.

## Your Files

| File                     | Purpose                                      |
| ------------------------ | -------------------------------------------- |
| `js/core/firebase.js`   | Firebase init, CRUD helpers, collection refs  |
| `js/features/auth.js`   | Login, logout, session management             |
| `js/features/streak.js` | Streak tracking logic, milestones, freeze earn/consume |
| `js/features/streak-logic.js` | Pure streak math (freeze earning, gap reconciliation) — unit-tested in `test/` |
| `js/features/topics.js` | Topics CRUD, word management                  |
| `js/features/vocabulary.js` | Word add/edit/delete, AI fill, duplicates |
| `js/features/paragraphs.js` | Paragraph generation and management       |

## Collection Reference Pattern

```js
import { getDb } from '../core/firebase.js';

topicsRef();                // users/{username}/topics
wordsRef(topicId);          // users/{username}/topics/{topicId}/words
paragraphsRef(topicId);     // users/{username}/topics/{topicId}/paragraphs
streakRef();                // users/{username}/streak/main
dailyActivityRef(date);     // users/{username}/streak/main/dailyActivity/{date}
notesRef();                 // users/{username}/notes
```

## Streak Activity API

`dailyActivity/{date}` tracks four counters: `wordsLearned`, `practiceCount`, `irregularVerbsLearned`, `irregularVerbPracticeCount`. Use the helpers in `js/features/streak.js`:

```js
// recordActivity / removeActivity accept a string (legacy) or an object
await recordActivity('learn');                                   // vocabulary learn
await recordActivity('practice');                                // vocabulary practice
await recordActivity({ type: 'learn', source: 'irregularVerb' });// irregular verb learn
await removeActivity({ type: 'learn', source: 'irregularVerb' });// undo above

// summarize a daily doc (sums across all sources)
const { learned, practiced, total, vocabularyLearned, irregularVerbsLearned, ... } = summarizeActivityEntry(entry);
```

- `source` defaults to `'vocabulary'`; `type` defaults to `'learn'`.
- When adding a new source, extend `ACTIVITY_FIELD_MAP` in `streak.js` AND add the new field names to `firestore.rules` `affectedKeys()` allow-list.
- `removeActivity` rolls back the streak only when **all** counters for today drop to 0.

## Streak Freeze Mechanic

Missing a day does not break the streak immediately. Freeze fields on `streak/main`:
`streakFreezes` (0..`maxStreakFreezes`), `maxStreakFreezes` (cap 2), `activeDaysToNextFreeze` (0..7).
`dailyActivity/{date}` gains a `frozen: boolean` flag.

- **Earn**: `recordActivity()` accrues one real study day toward the next freeze; grants
  1 freeze per 7 days (`FREEZE_EARN_THRESHOLD`), capped at 2. Returns `freezeEarned`.
- **Consume/break**: `loadStreak()` calls `reconcileStreak()` — each missed day is bridged
  by one freeze (streak held, day marked `frozen`); breaks only when freezes can't cover the
  gap (freezes are then kept, not wasted). Returns `freezesConsumed` + `frozenDates`.
- **Migration**: existing users with no freeze field are lazily set to `NEW_USER_FREEZES` (1)
  on first `loadStreak()`, then reconciled.
- Pure math + constants live in `js/features/streak-logic.js`; tests in `test/streak-logic.test.js`
  (`node test/streak-logic.test.js`). Keep new streak rules in the pure module so they stay testable.
- `maybeNotifyFreezeUsed(streakData)` (in `js/shared/streak-handler.js`) shows the freeze-used modal.

## Spaced Repetition (SRS) Mechanic

Learned words carry SM-2 scheduling fields so they can resurface for review. Fields on each
`words/{wordId}` doc: `srsRepetitions`, `srsEaseFactor` (default 2.5, floor 1.3), `srsInterval`
(days), `srsDueDate` (`YYYY-MM-DD` local day), `srsLastReviewedAt` (timestamp | null, absolute
UTC/GMT), `srsTzOffset` (number | null, minutes east of UTC — e.g. GMT+7 → 420 — so the local day
`srsDueDate` was bucketed in is reconstructible for correct time math).

- **Seed/clear**: `toggleWordLearned()` (`js/features/vocabulary.js`) seeds srs* on learn (due today)
  and sets all srs* to `null` on un-learn. A learned word with no `srsDueDate` (legacy) counts as due.
- **Queue**: `js/features/review.js` builds a global due queue via topic fan-out
  (`loadDueWords`), plus `getReviewStats`/`countDueWords`. There is no flat words collection and no
  `collectionGroup` query — filtering is client-side by `srsDueDate <= today`.
- **Schedule**: `submitReview(word, rating, today)` applies SM-2 and writes new srs* fields.
- **Pure math**: `js/features/srs-logic.js` (`scheduleReview`, `reviewWord`, `isDue`,
  `initialSchedule`); tests in `test/srs-logic.test.js` (`node test/srs-logic.test.js`).
- **Rules**: the words `update` allow-list in `firestore.rules` must include all srs* keys — adding a
  new srs field requires updating that `hasOnly([...])`.

## Key Gotchas

1. **Compat SDK**: Use `firebase.firestore()`, NOT modular `getFirestore()`
2. **Timestamps**: Handle both Timestamp objects and plain values: `ts?.toDate?.() || new Date(ts)`
3. **Word ordering**: Use `orderKey` (numeric), fallback `createdAt`
4. **No Firebase Auth**: Username comes from `sessionStorage`, not Firebase Auth
5. **Batch deletes**: When deleting a topic, batch-delete all words + paragraphs first
6. **Session**: `sessionStorage` for runtime, `localStorage` for persist across tabs
7. **Streak fields**: New counters in `dailyActivity` must be added to `firestore.rules` `affectedKeys()` or writes will be rejected
