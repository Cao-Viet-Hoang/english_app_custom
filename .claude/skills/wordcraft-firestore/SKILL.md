---
name: wordcraft-firestore
description: Guide for Firestore operations in WordCraft. Use when writing database queries, batch operations, or working with the data schema.
user-invocable: false
---

# Firestore Operations in WordCraft

## Collection Reference Functions (js/core/firebase.js)

```js
import { getDb, topicsRef, wordsRef, paragraphsRef, streakRef, dailyActivityRef, notesRef } from '../core/firebase.js';

topicsRef();                // users/{username}/topics
wordsRef(topicId);          // users/{username}/topics/{topicId}/words
paragraphsRef(topicId);     // users/{username}/topics/{topicId}/paragraphs
streakRef();                // users/{username}/streak/main
dailyActivityRef(date);     // users/{username}/streak/main/dailyActivity/{date}
notesRef();                 // users/{username}/notes
```

## CRUD Patterns

```js
// Create
await wordsRef(topicId).add({
  english,
  vietnamese,
  iPA,
  type,
  description,
  learned: false,
  orderKey: Date.now(),
  createdAt: firebase.firestore.FieldValue.serverTimestamp(),
});

// Read ordered
const snap = await wordsRef(topicId).orderBy("orderKey").get();
const words = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

// Update
await wordsRef(topicId).doc(wordId).update({ learned: true });

// Delete
await wordsRef(topicId).doc(wordId).delete();
```

## Batch Delete Topic

```js
const db = getDb();
const batch = db.batch();
const [wordsSnap, parasSnap] = await Promise.all([
  wordsRef(topicId).get(),
  paragraphsRef(topicId).get(),
]);
wordsSnap.forEach((d) => batch.delete(d.ref));
parasSnap.forEach((d) => batch.delete(d.ref));
await batch.commit();
await topicsRef().doc(topicId).delete();
```

## Timestamp Handling

```js
// Always handle both Timestamp objects and plain values
const date = ts?.toDate?.() || new Date(ts);
```

## Feature Files Using Firebase

| File                       | Purpose                              |
| -------------------------- | ------------------------------------ |
| `js/features/auth.js`     | Login/logout, session management     |
| `js/features/topics.js`   | Topics CRUD, word management         |
| `js/features/vocabulary.js`| Word add/edit/delete, AI fill       |
| `js/features/paragraphs.js`| Paragraph generation & management  |
| `js/features/streak.js`   | Streak tracking, milestones          |

## Gotchas

- Use `firebase.firestore()` NOT `getFirestore()`
- `orderKey` (not `createdAt`) for word ordering
- Username from `sessionStorage`, not Firebase Auth
- Batch limit: 500 operations per batch (Firestore limit)
