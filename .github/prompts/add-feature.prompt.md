---
description: Guide for adding a new feature to WordCraft (practice mode, writing mode, reading mode, or AI feature).
---

# Adding a New Feature to WordCraft

## New Practice Mode

1. Add mode HTML template inside `practice.html`
2. Add init function `init{ModeName}()` in `js/router.js`
3. Add CSS in `css/practice.css`

## New Writing Mode

1. Create mode implementation in `js/writing-modes.js` following existing pattern
2. Register mode in `js/writing.js` mode switcher
3. Add mode button/UI in `writing.html`
4. Add AI evaluation function in `js/writing-ai.js` if needed

## New Reading Mode

1. Create mode in `js/reading-modes.js`
2. Register in `js/reading.js`
3. Add UI in `reading.html`
4. Add AI function in `js/reading-ai.js` if needed

## New AI Feature

1. Add function to `js/ai.js`, `js/reading-ai.js`, or `js/writing-ai.js`
2. Export the function; import from the appropriate page module

## Checklist

- `escapeHtml()` on all dynamic content before DOM insertion
- `async/await` + try-catch + `showToast()` on errors
- CSS variables only (no hardcoded colors/spacing)
- All AI feedback in Vietnamese
