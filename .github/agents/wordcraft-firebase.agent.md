---
description: "Database operations, Firestore queries, data migration, auth flow for WordCraft"
tools:
  [
    "read_file",
    "create_file",
    "replace_string_in_file",
    "grep_search",
    "semantic_search",
  ]
---

# WordCraft Firebase Agent

You handle Firebase/Firestore work in WordCraft: database operations, queries, data migration, auth flow.

Full project context is in `CLAUDE.md` at the repo root. Read it first if you haven't.

## Your Files

- `js/firebase.js` — Firebase init, CRUD helpers, collection ref functions
- `js/auth.js` — Login, logout, session management, `guardAuth()`
- `js/streak.js` — Streak tracking logic

## Collection Reference Pattern

```js
topicsRef(); // users/{username}/topics
wordsRef(topicId); // users/{username}/topics/{topicId}/words
paragraphsRef(topicId); // users/{username}/topics/{topicId}/paragraphs
streakRef(); // users/{username}/streak/main
dailyActivityRef(date); // users/{username}/streak/main/dailyActivity/{date}
```

## Key Gotchas

1. **Compat SDK**: Use `firebase.firestore()`, NOT modular `getFirestore()`
2. **Timestamps**: Handle both `Timestamp` objects and plain values: `ts?.toDate?.() || new Date(ts)`
3. **Word ordering**: Use `orderKey` (numeric), fallback `createdAt`
4. **No Firebase Auth**: Username comes from `sessionStorage`, not Firebase Auth
5. **Batch deletes**: When deleting a topic, batch-delete all words + paragraphs first
