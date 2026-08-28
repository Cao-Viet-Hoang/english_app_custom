---
name: wordcraft-add-feature
description: Guide for adding a new feature to WordCraft (practice mode, writing mode, reading mode, or AI feature). Use when asked to add a new mode, page, or learning feature.
---

# Adding a New Feature to WordCraft

## New Practice Mode

1. Add mode HTML template inside `practice.html`
2. Add mode logic in `js/pages/practice-page.js` (init function, event handlers, scoring)
3. Add CSS file in `css/practice/` (e.g., `css/practice/new-mode.css`)
4. Link the new CSS file in `practice.html` `<head>`

## New Writing Mode

1. Create mode file in `js/pages/writing-modes/` (e.g., `new-mode.js`)
2. Register mode in `js/pages/writing-page.js` mode switcher
3. Add mode button/UI in `writing.html`
4. Add AI evaluation function in `js/ai/writing-ai.js` if needed
5. Add CSS in `css/writing/` if needed

## New Reading Mode

1. Create mode file in `js/pages/reading-modes/` (e.g., `new-mode.js`)
2. Register in `js/pages/reading-page.js`
3. Add UI in `reading.html`
4. Add AI generation function in `js/ai/reading-ai.js` if needed

## New AI Feature

1. Add function to `js/ai/word-ai.js` (vocabulary), `js/ai/reading-ai.js` (reading), or `js/ai/writing-ai.js` (writing)
2. Use shared client: `import { callAzureOpenAI } from '../../core/ai-client.js'`
3. Export the function
4. Import and call from the appropriate page module

## New Standalone Tool (topics-hub + detail pattern)

For a tool with its own set of user-created topics (like Sentence Patterns), mirror the
`topics.html`/`topic-detail.html` pair rather than a single flat page:

1. Create a hub page (e.g. `sentences.html`) mirroring `topics.html`'s topic grid + New/Rename modal
2. Create a detail page (e.g. `sentence-topic-detail.html`) mirroring `word-forms.html`'s tab structure (table tab + practice tab)
3. Hub controller (`js/pages/sentences-page.js`) uses `initProtectedPage()` (no `requireTopicId`)
4. Detail controller (`js/pages/{tool}-topic-detail-page.js`) uses `initProtectedPage({ requireTopicId: true })`
5. Add CRUD/AI functions to a new `js/features/{tool}-topics.js` + `js/ai/{tool}-ai.js` (data layer)
6. Add a `.lt-tool` chip to `.lt-toolbar` in `topics.html`, linking to the hub page, plus an `init{Tool}Card()` in `topics-page.js` mirroring `initReviewCard()`/`initIrregularVerbsCard()`
7. Reuse existing table/bulk-add CSS (`css/topic-detail/vocabulary.css`, `css/topic-detail/forms.css`) and shared JS (`js/shared/bulk-add-utils.js`) wholesale where the shape matches; only add new page-specific CSS files for genuinely new UI (e.g. `css/sentences/`)
8. **Caution**: `parseBulkInput()`/`setupLowercaseWarning()` from `bulk-add-utils.js` assume single lowercase words (they split on commas AND force-lowercase) — do NOT reuse them for multi-word/sentence bulk input; write a custom newline-only, case-preserving parser instead
9. Reference: `sentences.html` + `sentence-topic-detail.html` + `js/pages/sentences-page.js` + `js/pages/sentence-topic-detail-page.js`

## Shared Modules to Use

- `js/ui/index.js` — showToast, showModal, escapeHtml, formatDate
- `js/shared/page-init.js` — initProtectedPage()
- `js/shared/result-builder.js` — buildResultHtml()
- `js/shared/tts.js` — speakText()
- `js/shared/shuffle.js` — Fisher-Yates shuffle
- `js/shared/streak-handler.js` — handleStreakRecord()

## Checklist

- [ ] `escapeHtml()` on all dynamic content before DOM insertion
- [ ] `async/await` + try-catch + `showToast()` on errors
- [ ] CSS variables only (no hardcoded colors/spacing/font-sizes)
- [ ] Keyboard shortcut registered if interactive
- [ ] AI feedback in Vietnamese
- [ ] External `<script type="module">` — no inline JS
