# WordCraft — Copilot Instructions

> Full project context is in `CLAUDE.md` at the repo root. This file contains Copilot-specific additions.

## Quick Reference

- **Stack**: Vanilla JS (ES Modules), Firebase Firestore Compat SDK v10.12.0, Azure OpenAI REST API
- **No frameworks, no build tools, no npm** — static files only
- **6 pages**: index.html (login), topics.html, topic-detail.html, practice.html, reading.html, writing.html
- **16 JS modules** in `js/`, **8 CSS files** in `css/`

## When Generating Code

1. Use ES module `import`/`export` — no CommonJS
2. Use `async/await` with try-catch for all async operations
3. Call `escapeHtml()` from `js/ui.js` on ALL user/AI content before DOM insertion
4. Use CSS variables (`--primary`, `--sp-1` to `--sp-8`) — never hardcode colors/spacing
5. Use Firebase Compat SDK syntax: `firebase.firestore()`, NOT modular `getFirestore()`
6. Use `showToast(msg, type)` for user feedback on errors
7. Follow naming: `load{Entity}`, `{action}{Entity}`, `handle{Action}`, `build{Component}Html`
8. All AI feedback text must be in **Vietnamese**

## Available Custom Agents

- `@wordcraft-feature` — General feature implementation
- `@wordcraft-ai` — AI integration (prompts, evaluation, new AI modes)
- `@wordcraft-ui` — UI/UX work (styling, layout, animations)
- `@wordcraft-firebase` — Database operations and auth flow
