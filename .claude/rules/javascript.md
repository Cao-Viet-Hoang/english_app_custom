---
paths:
  - "js/**/*.js"
---

# JavaScript Code Rules

- Use ES module import/export syntax, no CommonJS
- async/await with try-catch for all async operations (Firebase, AI API calls)
- Call escapeHtml() from js/ui.js on ALL user/AI content before DOM insertion
- Use showToast(message, type) for user feedback on errors
- Follow naming: load{Entity}, {action}{Entity}, handle{Action}, build{Component}Html
- Firestore refs use {collection}Ref() function pattern
- State variables: plural for collections (allWords), singular for current (currentIndex)
- Firebase Compat SDK only: firebase.firestore(), NOT getFirestore()
- Handle timestamps both ways: ts?.toDate?.() || new Date(ts)
