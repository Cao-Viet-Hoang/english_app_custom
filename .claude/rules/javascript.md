---
paths:
  - "js/**/*.js"
---

# JavaScript Code Rules

- Use ES module import/export syntax, no CommonJS
- async/await with try-catch for all async operations (Firebase, AI API calls)
- Call `escapeHtml()` from `js/ui/index.js` on ALL user/AI content before DOM insertion
- Use `showToast(message, type)` for user feedback on errors
- Follow naming: `load{Entity}`, `{action}{Entity}`, `handle{Action}`, `build{Component}Html`
- Firestore refs use `{collection}Ref()` function pattern
- State variables: plural for collections (`allWords`), singular for current (`currentIndex`)
- Firebase Compat SDK only: `firebase.firestore()`, NOT `getFirestore()`
- Handle timestamps both ways: `ts?.toDate?.() || new Date(ts)`

## Style in JS
- Never set colors/fonts/spacing via `element.style.*` — use CSS classes instead
- Prefer toggling CSS classes (`.classList.add/remove/toggle`) over inline styles
- Exception: dynamic calculated values like `width` for progress bars are OK
- Never use hardcoded hex colors in innerHTML/template literals — use CSS variables or classes
- Avoid CSS var fallbacks in inline styles (e.g., `var(--color-warning, #F2D07A)`) — trust the var
