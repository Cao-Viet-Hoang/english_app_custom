---
name: wordcraft-firestore
description: Guide for Firestore operations in WordCraft. Use when writing database queries, batch operations, or working with the data schema.
user-invocable: false
---

# Firestore Operations in WordCraft

## Collection Reference Functions (js/firebase.js)

```js
topicsRef(); // users/{username}/topics
wordsRef(topicId); // users/{username}/topics/{topicId}/words
paragraphsRef(topicId); // users/{username}/topics/{topicId}/paragraphs
streakRef(); // users/{username}/streak/main
dailyActivityRef(date); // users/{username}/streak/main/dailyActivity/{date}
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

## Gotchas

- Use `firebase.firestore()` NOT `getFirestore()`
- `orderKey` (not `createdAt`) for word ordering
- Username from `sessionStorage`, not Firebase Auth
