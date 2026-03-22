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
├── index.html              # Login page (JSON credentials input)
├── topics.html             # Topics hub (grid of topics)
├── topic-detail.html       # Topic detail (word list, add/edit/delete)
├── practice.html           # Practice (7 interactive modes)
├── reading.html            # Reading (2 AI modes)
├── writing.html            # Writing (4 AI modes)
├── css/
│   ├── base.css            # CSS vars, resets, shared components (modals, toasts, buttons)
│   ├── login.css           # Login page
│   ├── topics.css          # Topics grid
│   ├── topic-detail.css    # Word list, forms
│   ├── practice.css        # Practice modes
│   ├── reading.css         # Reading page
│   ├── writing.css         # Writing page
│   └── streak.css          # Streak dashboard, heatmap
└── js/
    ├── config.js            # DEV_MODE flag, test credentials
    ├── firebase.js          # Firebase init, Firestore CRUD helpers, collection refs, notes CRUD
    ├── auth.js              # Login/logout, session management, guardAuth()
    ├── ai.js                # Azure OpenAI: word info, paragraphs, insights
    ├── reading-ai.js        # AI for reading modes (passage + questions)
    ├── writing-ai.js        # AI for writing modes (evaluation, dictation)
    ├── topics.js            # Topics CRUD, word management, bulk operations
    ├── vocabulary.js        # Word add/edit/delete, AI fill, duplicate detection
    ├── paragraphs.js        # Paragraph generation and management
    ├── ui.js                # Modals, toasts, escapeHtml(), loading states
    ├── router.js            # Query param routing, page init dispatch
    ├── streak.js            # Daily streak tracking, milestones, heatmap
    ├── reading.js           # Reading page logic, mode switching
    ├── reading-modes.js     # Comprehension & True/False mode implementations
    ├── writing.js           # Writing page logic, mode switching
    └── writing-modes.js     # Sentence, Paragraph, Translation, Dictation modes
```

## Module Dependency Graph

```
auth.js ← firebase.js, config.js, ui.js
topics.js ← firebase.js, auth.js, vocabulary.js, paragraphs.js, ui.js, streak.js
vocabulary.js ← firebase.js, ai.js, ui.js
paragraphs.js ← firebase.js, ai.js, ui.js
reading.js ← auth.js, firebase.js, reading-modes.js, ui.js
reading-modes.js ← reading-ai.js, ui.js
writing.js ← auth.js, firebase.js, writing-modes.js, ui.js
writing-modes.js ← writing-ai.js, ui.js
router.js ← (imports page init functions)
streak.js ← firebase.js, ui.js
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
└── streak/main/
    ├── currentStreak: number, longestStreak: number
    ├── lastActiveDate: string (YYYY-MM-DD), totalActiveDays: number
    └── dailyActivity/{YYYY-MM-DD}/ → wordsLearned: number
```

## AI Integration

All AI calls use Azure OpenAI Chat Completions REST API.

### API pattern

```
POST {endpoint}/openai/deployments/{deployment}/chat/completions?api-version={version}
Headers: api-key: {key}, Content-Type: application/json
Body: { messages, temperature, max_tokens, response_format: { type: "json_object" } }
```

### AI functions

| Function                         | File          | Purpose                                                     |
| -------------------------------- | ------------- | ----------------------------------------------------------- |
| `generateWordInfo()`             | ai.js         | Auto-fill word details (vietnamese, IPA, type, description) |
| `generateBulkWordInfo()`         | ai.js         | Same, batched for multiple words (max ~6)                   |
| `generateParagraph()`            | ai.js         | Create paragraph from vocabulary words                      |
| `generateWordInsights()`         | ai.js         | Synonyms, antonyms, collocations, examples                  |
| `generateReadingPassage()`       | reading-ai.js | Passage + MCQ or T/F questions                              |
| `evaluateSentence()`             | writing-ai.js | Score grammar/usage/naturalness                             |
| `evaluateParagraph()`            | writing-ai.js | Score grammar/coherence                                     |
| `generateTranslationChallenge()` | writing-ai.js | Vietnamese→English exercise                                 |
| `evaluateTranslation()`          | writing-ai.js | Evaluate translation accuracy                               |
| `generateDictationSentence()`    | writing-ai.js | Create listening exercises                                  |

### AI rules

- All feedback text in **Vietnamese** (learners are Vietnamese speakers)
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
- `escapeHtml()` from `ui.js` on ALL user/AI content before DOM insertion (XSS)
- CSS variables for theming (`--primary`, `--sp-1` to `--sp-8`) — never hardcode
- Modals: destroy and rebuild on each open
- Toast notifications: `showToast(message, 'success'|'error'|'info')`
- Firebase Compat SDK: `firebase.firestore()` — NOT modular `getFirestore()`
- Timestamps: handle both `Timestamp` objects and plain values (`ts?.toDate?.() || new Date(ts)`)
- Words ordered by `orderKey` (numeric), fallback `createdAt`

## Common Tasks

| Task              | Files to edit                                                              |
| ----------------- | -------------------------------------------------------------------------- |
| New practice mode | `practice.html`, `js/router.js`, `css/practice.css`                        |
| New writing mode  | `js/writing-modes.js`, `js/writing.js`, `writing.html`, `js/writing-ai.js` |
| New reading mode  | `js/reading-modes.js`, `js/reading.js`, `reading.html`, `js/reading-ai.js` |
| New AI feature    | `js/ai.js` or `js/reading-ai.js` or `js/writing-ai.js`                     |
| Change UI shared  | `js/ui.js`, `css/base.css`                                                 |
| Change auth flow  | `js/auth.js`, `index.html`                                                 |
| Change DB schema  | `js/firebase.js` + form + display logic                                    |

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
