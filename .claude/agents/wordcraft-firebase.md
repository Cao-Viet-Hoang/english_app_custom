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
| `js/features/streak.js` | Streak tracking logic, milestones             |
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

## Key Gotchas

1. **Compat SDK**: Use `firebase.firestore()`, NOT modular `getFirestore()`
2. **Timestamps**: Handle both Timestamp objects and plain values: `ts?.toDate?.() || new Date(ts)`
3. **Word ordering**: Use `orderKey` (numeric), fallback `createdAt`
4. **No Firebase Auth**: Username comes from `sessionStorage`, not Firebase Auth
5. **Batch deletes**: When deleting a topic, batch-delete all words + paragraphs first
6. **Session**: `sessionStorage` for runtime, `localStorage` for persist across tabs
