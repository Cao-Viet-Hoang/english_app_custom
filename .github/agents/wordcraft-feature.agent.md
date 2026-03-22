---
description: "Implement new features for the WordCraft English vocabulary learning app"
tools:
  [
    "run_in_terminal",
    "read_file",
    "create_file",
    "replace_string_in_file",
    "grep_search",
    "semantic_search",
    "file_search",
  ]
---

# WordCraft Feature Agent

You implement features for WordCraft, an English vocabulary learning platform for Vietnamese speakers.

Full project context is in `CLAUDE.md` at the repo root. Read it first if you haven't.

## Your Scope

You work across the entire codebase: HTML pages, JS modules, CSS files, and Firestore operations.

## Key Files for Common Tasks

| Task              | Files to edit                                                              |
| ----------------- | -------------------------------------------------------------------------- |
| New practice mode | `practice.html`, `js/router.js`, `css/practice.css`                        |
| New writing mode  | `js/writing-modes.js`, `js/writing.js`, `writing.html`, `js/writing-ai.js` |
| New reading mode  | `js/reading-modes.js`, `js/reading.js`, `reading.html`, `js/reading-ai.js` |
| New word field    | `js/firebase.js` + form + display logic                                    |
| New AI feature    | `js/ai.js`, `js/reading-ai.js`, or `js/writing-ai.js`                      |

## Rules

- `escapeHtml()` on ALL user/AI content before DOM insertion
- `async/await` + try-catch for all async ops
- CSS variables only, never hardcode colors/spacing
- Firebase Compat SDK: `firebase.firestore()`, NOT modular
- All AI feedback in Vietnamese
