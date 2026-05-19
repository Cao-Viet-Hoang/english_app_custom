# WordCraft — English Vocabulary Learning App

WordCraft is a full-featured English vocabulary learning platform for Vietnamese speakers.
Users provide their own Firebase + Azure OpenAI credentials via JSON — no signup required.

## Tech Stack

- **Frontend**: Vanilla JavaScript (ES Modules), HTML5, CSS3 — NO frameworks, NO build tools, NO npm
- **Backend**: Firebase Firestore v10.12.0 **Compat SDK** via CDN (`firebase.firestore()` syntax, NOT modular)
- **AI**: Azure OpenAI REST API (Chat Completions)
- **Other**: Web Speech API (TTS), Google Fonts (Inter)
- **Hosting**: Static file hosting — no server, no build step

## File Structure

```
├── index.html                          # Login page (JSON credentials input)
├── topics.html                         # Topics hub (grid of topics + Learning Tools toolbar)
├── topic-detail.html                   # Topic detail (word list, add/edit/delete)
├── practice.html                       # Practice (7 interactive modes)
├── reading.html                        # Reading (2 AI modes)
├── writing.html                        # Writing (4 AI modes)
├── irregular-verbs.html                # Irregular Verbs (verb table + 5 practice modes)
│
├── css/
│   ├── base.css                        # CSS vars, resets, shared components
│   ├── login.css                       # Login page
│   ├── topics.css                      # Topics grid + Learning Tools toolbar
│   ├── streak.css                      # Streak dashboard, heatmap
│   ├── chat.css                        # Chat widget
│   ├── reading.css                     # Reading page
│   ├── topic-detail/                   # Topic detail page
│   │   ├── layout.css                  # Breadcrumb, header, learned progress
│   │   ├── vocabulary.css              # Vocab table, swipe-delete, learned toggle
│   │   ├── forms.css                   # Word form modal, bulk add, word selection
│   │   ├── paragraphs.css              # Paragraph cards, sentence interaction, badges
│   │   └── insights.css                # AI insights panel, tags, examples
│   ├── practice/                       # Practice page
│   │   ├── layout.css                  # Mode selector, stats bar, empty state
│   │   ├── flashcard.css
│   │   ├── quiz.css
│   │   ├── matching.css
│   │   ├── listening.css
│   │   ├── fill-blank.css
│   │   ├── speed-type.css
│   │   ├── unscramble.css
│   │   └── results.css                 # Shared result overlay
│   ├── writing/                        # Writing page
│   │   ├── layout.css                  # Mode selector, stats, result, AI loading
│   │   ├── feedback.css                # Score badges, error cards, notes modal
│   │   ├── sentence.css
│   │   ├── paragraph.css
│   │   ├── translation.css
│   │   └── dictation.css
│   └── irregular-verbs/                # Irregular Verbs page
│       ├── layout.css                  # Page shell, breadcrumb, tabs, header
│       ├── verb-table.css              # Verb table, pattern badges, swipe-delete
│       └── practice.css                # Mode selector + all 5 practice mode styles
│
└── js/
    ├── core/                           # Foundation — no business logic
    │   ├── config.js                   # DEV_MODE flag, test credentials
    │   ├── router.js                   # Query param routing, guardAuth(), navigateTo()
    │   ├── firebase.js                 # Firebase init, Firestore CRUD, collection refs
    │   └── ai-client.js               # Shared Azure OpenAI HTTP client
    │
    ├── ui/                             # UI utilities (split from old ui.js)
    │   ├── toast.js                    # showToast()
    │   ├── modal.js                    # showModal(), closeModal(), setupModalClose()
    │   ├── confirm.js                  # confirmDialog(), confirmDialogHtml()
    │   ├── milestone.js                # showMilestoneModal()
    │   ├── utils.js                    # escapeHtml(), formatDate()
    │   └── index.js                    # Barrel re-export of all ui/*
    │
    ├── shared/                         # Shared utilities (deduplicated)
    │   ├── page-init.js                # initProtectedPage() — auth, navbar, streak
    │   ├── shuffle.js                  # Fisher-Yates shuffle
    │   ├── tts.js                      # speakText() — Web Speech API
    │   ├── result-builder.js           # buildResultHtml() — shared result screen
    │   ├── streak-handler.js           # handleStreakRecord() — milestone/encouragement
    │   └── bulk-add-utils.js           # Bulk-add shared: parsing, counter, dupes, corrections
    │
    ├── features/                       # Business logic — data layer
    │   ├── auth.js                     # Login/logout, session management
    │   ├── topics.js                   # Topics CRUD, word management
    │   ├── vocabulary.js               # Word add/edit/delete, AI fill, duplicates
    │   ├── paragraphs.js               # Paragraph generation and management
    │   ├── streak.js                   # Daily streak tracking, milestones, heatmap
    │   └── irregular-verbs.js          # Irregular verbs CRUD, pattern detection, stats
    │
    ├── ai/                             # AI integration layer
    │   ├── word-ai.js                  # Word info, bulk info, insights, paragraph gen, verb info
    │   ├── reading-ai.js               # Reading passage generation
    │   ├── writing-ai.js               # Writing evaluators, dictation
    │   ├── chat-ai.js                  # Chat streaming + 2-layer cache
    │   └── feedback-builder.js         # Score badges, error cards, diff HTML builders
    │
    ├── chat/                           # Chat widget (split from old chat-ui.js)
    │   ├── chat-state.js               # Shared state, DOM refs, suggestions data
    │   ├── chat-renderer.js            # Markdown rendering, messages, typing indicator
    │   ├── chat-input.js               # Send flow, auto-resize, clear conversation
    │   └── chat-ui.js                  # Widget builder, event wiring, initChatWidget()
    │
    └── pages/                          # Page controllers
        ├── topics-page.js              # Topics grid page
        ├── topic-detail-page.js        # Topic detail page (vocab, paragraphs, insights)
        ├── practice-page.js            # Practice page (7 modes)
        ├── reading-page.js             # Reading page controller
        ├── writing-page.js             # Writing page controller
        ├── irregular-verbs-page.js     # Irregular Verbs page (table + 5 practice modes)
        ├── reading-modes/
        │   ├── comprehension.js
        │   └── truefalse.js
        ├── writing-modes/
        │   ├── sentence.js
        │   ├── paragraph.js
        │   ├── translation.js
        │   └── dictation.js
        └── irregular-verb-modes/
            ├── flashcard.js            # Conjugation flashcard (flip, retry queue)
            ├── fill-forms.js           # Fill missing verb forms (V2/V3)
            ├── quiz.js                 # Multiple-choice conjugation quiz
            ├── matching.js             # Click-to-match V1 ↔ V2/V3
            └── speed-conjugation.js    # Timed typing (V2 + V3 per verb)
```

## Folder Conventions

| Folder | Purpose | Rules |
|--------|---------|-------|
| `core/` | Foundation modules | No business logic, no UI |
| `ui/` | UI utilities | Import via `ui/index.js` barrel |
| `shared/` | Deduplicated helpers | Used across 2+ pages |
| `features/` | Data/business logic | Firestore CRUD, auth, streak |
| `ai/` | AI integration | Azure OpenAI calls, prompt builders |
| `chat/` | Chat widget | State, renderer, input, orchestrator |
| `pages/` | Page controllers | One per HTML page, import from other folders |

## Module Dependency Graph

```
pages/* ← core/router, core/firebase, features/*, ai/*, ui/index, shared/*, chat/chat-ui
features/* ← core/firebase, ui/index
ai/* ← core/ai-client
chat/* ← chat/chat-state, ai/chat-ai, ui/index
shared/* ← features/streak, ui/index
ui/index ← ui/toast, ui/modal, ui/confirm, ui/milestone, ui/utils
core/ai-client ← core/router (session)
```

## Firestore Schema

```
users/{username}/
├── topics/{topicId}/
│   ├── name: string, description: string, createdAt: timestamp
│   ├── words/{wordId}/
│   │   ├── english: string, vietnamese: string, iPA: string
│   │   ├── type: string (noun/verb/adjective/adverb)
│   │   ├── description: string, learned: boolean
│   │   ├── orderKey: number (Date.now() — stable sort key)
│   │   └── createdAt: timestamp
│   └── paragraphs/{paraId}/
│       ├── englishText: string, vietnameseText: string
│       └── usedWords: string[]
├── notes/{noteId}/
│   ├── source: string ("writing" | "reading" | "practice" | ...)
│   ├── type: string ("grammar" | "word_choice" | "spelling" | ...)
│   ├── original: string, corrected: string, explanation: string
│   ├── topicId: string (optional — link to source topic)
│   └── savedAt: timestamp
├── irregularVerbs/{verbId}/
│   ├── base: string (V1), pastSimple: string (V2), pastParticiple: string (V3)
│   ├── vietnamese: string, ipaBase: string (optional)
│   ├── pattern: string ("AAA" | "ABB" | "ABA" | "ABC") — auto-computed
│   ├── learned: boolean, learnedAt: timestamp | null
│   ├── orderKey: number (Date.now() * 1000 — stable sort key)
│   └── createdAt: timestamp
└── streak/main/
    ├── currentStreak: number, longestStreak: number
    ├── lastActiveDate: string (YYYY-MM-DD), totalActiveDays: number
    └── dailyActivity/{YYYY-MM-DD}/
        ├── date: string (YYYY-MM-DD)
        ├── wordsLearned: number, practiceCount: number
        ├── irregularVerbsLearned: number, irregularVerbPracticeCount: number
        ├── firstActionAt: timestamp, lastActionAt: timestamp
```

## AI Integration

All AI calls use Azure OpenAI Chat Completions REST API via `js/core/ai-client.js`.

### API pattern

```
POST {endpoint}/openai/deployments/{deployment}/chat/completions?api-version={version}
Headers: api-key: {key}, Content-Type: application/json
Body: { messages, temperature, max_tokens, response_format: { type: "json_object" } }
```

### AI functions

| Function                         | File              | Purpose                                                     |
| -------------------------------- | ----------------- | ----------------------------------------------------------- |
| `generateWordInfo()`             | ai/word-ai.js     | Auto-fill word details (vietnamese, IPA, type, description) |
| `generateBulkWordInfo()`         | ai/word-ai.js     | Same, batched for multiple words (max ~6)                   |
| `generateParagraph()`            | ai/word-ai.js     | Create paragraph from vocabulary words                      |
| `generateWordInsights()`         | ai/word-ai.js     | Synonyms, antonyms, collocations, examples                  |
| `generateVerbInfo()`             | ai/word-ai.js     | V2/V3 forms, Vietnamese meaning, IPA for a single verb      |
| `generateBulkVerbInfo()`         | ai/word-ai.js     | Same, batched (10 verbs per call) with optional progress CB |
| `generateReadingPassage()`       | ai/reading-ai.js  | Passage + MCQ or T/F questions                              |
| `evaluateSentence()`             | ai/writing-ai.js  | Score grammar/usage/naturalness                             |
| `evaluateParagraph()`            | ai/writing-ai.js  | Score grammar/coherence                                     |
| `generateTranslationChallenge()` | ai/writing-ai.js  | Vietnamese→English exercise                                 |
| `evaluateTranslation()`          | ai/writing-ai.js  | Evaluate translation accuracy                               |
| `generateDictationSentence()`    | ai/writing-ai.js  | Create listening exercises                                  |

### AI rules

- All feedback text shown on frontend must be in **English**
- Always request `response_format: { type: "json_object" }`
- Temperature: 0.5 (deterministic), 0.7-0.9 (creative)
- Batch limit: ~6 words per AI call (token limits)

## Authentication Flow

1. User enters JSON with `firebase` + `azureOpenAI` config on login page
2. Firebase initializes; username validated against Firestore
3. Session stored in `sessionStorage` (runtime) + `localStorage` (persist)
4. Protected pages call `guardAuth()` → redirect to login if no session
5. Logout clears auto-login flag

## Naming Conventions

- Async fetch: `load{Entity}` (e.g., `loadWords`)
- Data mutation: `{action}{Entity}` (e.g., `addWord`, `deleteWord`)
- Event handlers: `handle{Action}` (e.g., `handleSentenceCheck`)
- UI builders: `build{Component}Html` (e.g., `buildResultHtml`)
- Firestore refs: `{collection}Ref()` function pattern
- State: plural for collections (`allWords`), singular for current (`currentIndex`)

## Code Patterns

- ES modules with `import`/`export`
- `async/await` + try-catch for all async ops
- `escapeHtml()` from `ui/index.js` on ALL user/AI content before DOM insertion (XSS)
- All new code (identifiers, comments, messages) and all frontend text must be in English
- CSS variables for theming — never hardcode:
  - Colors: `--color-primary`, `--color-primary-light`, `--color-primary-dark`, `--color-accent`, `--color-success`, `--color-danger`, `--color-warning`, `--color-bg`, `--color-surface`, `--color-surface-alt`, `--color-text`, `--color-text-light`, `--color-text-inverse`, `--color-border`
  - Font sizes: `--fs-xs` (0.75rem) through `--fs-2xl` (2.25rem) — never hardcode px/rem
  - Font stack: `var(--font-sans)` for body, `var(--font-mono)` for code
  - Spacing: `--sp-1` (4px) through `--sp-8` (64px)
  - Radius: `--radius-sm/md/lg/xl`, Shadows: `--shadow-sm/md/lg`
- Prefer CSS classes over inline `style="..."` in both HTML and JS
- Modals: destroy and rebuild on each open
- Toast notifications: `showToast(message, 'success'|'error'|'info')`
- Firebase Compat SDK: `firebase.firestore()` — NOT modular `getFirestore()`
- Timestamps: handle both `Timestamp` objects and plain values (`ts?.toDate?.() || new Date(ts)`)
- Words ordered by `orderKey` (numeric), fallback `createdAt`

## Common Tasks

| Task              | Files to edit                                                                        |
| ----------------- | ------------------------------------------------------------------------------------ |
| New practice mode      | `practice.html`, `js/pages/practice-page.js`, `css/practice/`                        |
| New writing mode       | `js/pages/writing-modes/`, `js/pages/writing-page.js`, `writing.html`, `js/ai/writing-ai.js` |
| New reading mode       | `js/pages/reading-modes/`, `js/pages/reading-page.js`, `reading.html`, `js/ai/reading-ai.js` |
| New AI feature         | `js/ai/word-ai.js` or `js/ai/reading-ai.js` or `js/ai/writing-ai.js`                |
| Change UI shared       | `js/ui/` (toast/modal/confirm/utils), `css/base.css`                                 |
| Change auth flow       | `js/features/auth.js`, `js/core/router.js`, `index.html`                             |
| Change DB schema       | `js/core/firebase.js` + form + display logic                                         |
| Irregular Verbs table  | `irregular-verbs.html`, `js/pages/irregular-verbs-page.js`, `css/irregular-verbs/`  |
| Irregular Verbs modes  | `js/pages/irregular-verb-modes/`, `css/irregular-verbs/practice.css`                 |
| Irregular Verbs data   | `js/features/irregular-verbs.js`, `firestore.rules`                                  |

## Keyboard Shortcuts

- Space/Enter → Flip flashcard | →/J → Know it | ←/K → Don't know
- 1-4/A-D → Select quiz option | T/F → True/False toggle
- Ctrl+Enter → Check answer (writing) | R → Replay audio (dictation)
- Escape → Close modal

## Don'ts

- Do NOT use npm, node_modules, or any build tools
- Do NOT use Firebase modular SDK syntax (`import { ... } from 'firebase/...'`)
- Do NOT insert user/AI content into DOM without `escapeHtml()`
- Do NOT hardcode colors/spacing — use CSS variables
- Do NOT exceed ~6 words per AI batch call
- Do NOT display Vietnamese text on frontend (labels, buttons, toasts, modals, AI feedback)

## Using Sub-Agents and Skills

This project has specialized sub-agents and skills configured in `.claude/`. **Use them proactively** — they carry domain-specific context and produce better, faster results than doing everything inline.

### Sub-agents (via Agent tool)

| Agent                | When to use                                                                  |
| -------------------- | ---------------------------------------------------------------------------- |
| `wordcraft-ui`       | Styling, layout, colors, spacing, animations, responsive, modals, toasts     |
| `wordcraft-ai`       | AI prompts, evaluation logic, scoring, Azure OpenAI calls, response parsing  |
| `wordcraft-feature`  | New practice/writing/reading modes, new pages, cross-cutting features        |
| `wordcraft-firebase` | Firestore schema, queries, auth flow, streak data, data migration            |

**Guidelines:**
- For tasks that span UI + data + AI, **spawn multiple agents in parallel** (e.g., `wordcraft-ui` for CSS + `wordcraft-firebase` for schema)
- For single-domain tasks, spawn the matching agent — it has full context of its files
- Each agent knows the current file structure, naming conventions, and design system

### Skills (via Skill tool)

| Skill                    | When to use                                        |
| ------------------------ | -------------------------------------------------- |
| `wordcraft-add-feature`  | Step-by-step guide for adding a new mode or page   |
| `wordcraft-ai-prompt`    | Template and rules for writing Azure OpenAI prompts |
| `wordcraft-firestore`    | CRUD patterns, batch operations, timestamp handling |

### Rules (auto-loaded)

Rules in `.claude/rules/` are loaded automatically when editing matching file paths:
- `css.md` → any `css/**/*.css` file
- `javascript.md` → any `js/**/*.js` file
- `ai-modules.md` → any `js/ai/*.js` file
- `style-consistency.md` → CSS, JS, and HTML files
- `keep-docs-in-sync.md` → all files (reminder to update docs)

## Keeping Docs in Sync

After any structural change (new files, renamed modules, new CSS variables, schema changes, new modes), update the relevant docs so they stay accurate. Stale docs cause agents to generate wrong code.

**Mandatory rule:** Always keep everything under `.claude/` in sync with the latest code. If a needed file does not exist yet, create it immediately (do not skip because it is missing).

- **This file (`CLAUDE.md`)**: File Structure, Firestore Schema, Common Tasks, Code Patterns
- **`.claude/rules/`**: css.md, javascript.md, ai-modules.md, style-consistency.md
- **`.claude/agents/`**: wordcraft-ui.md, wordcraft-ai.md, wordcraft-feature.md, wordcraft-firebase.md
- **`.claude/skills/`**: wordcraft-add-feature, wordcraft-ai-prompt, wordcraft-firestore

See `.claude/rules/keep-docs-in-sync.md` for the full mapping of what to update when.
