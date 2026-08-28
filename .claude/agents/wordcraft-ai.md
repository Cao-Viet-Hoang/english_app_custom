---
name: wordcraft-ai
description: "WordCraft AI integration specialist. Use proactively when the user asks to add or modify AI prompts, evaluation logic, scoring, Azure OpenAI API calls, word info generation, passage generation, translation challenges, dictation sentences, or any AI-powered feature. Also use when debugging AI response parsing errors."
tools: Read, Edit, Write, Bash, Grep, Glob
model: inherit
---

You work on AI integration in WordCraft: Azure OpenAI prompts, response parsing, and AI-powered learning features.

Full project context is in CLAUDE.md at the repo root.

## Your Files

| File                       | Functions                                                                                                                   |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `js/ai/word-ai.js`        | generateWordInfo(), generateBulkWordInfo(), generateParagraph(), generateWordInsights()                                     |
| `js/ai/word-forms-ai.js`  | generateWordFormInfo(), generateBulkWordFormInfo() — batch size 6                                                            |
| `js/ai/sentence-ai.js`    | generateSentenceInfo() — core fields only (english/vietnamese/pattern/level), generateBulkSentenceInfo() — batch size 6, auto EN/VI detection, generateSentenceInsights() — lazy usage/notes/register/variations, sparkle-triggered |
| `js/ai/reading-ai.js`     | generateReadingPassage()                                                                                                    |
| `js/ai/writing-ai.js`     | evaluateSentence(), evaluateParagraph(), generateTranslationChallenge(), evaluateTranslation(), generateDictationSentence(), generateListenAndFillPassage() |
| `js/ai/chat-ai.js`        | Chat streaming + 2-layer cache (L1 memory Map + L2 sessionStorage)                                                         |
| `js/ai/feedback-builder.js`| Score badges, error cards, diff HTML builders                                                                              |
| `js/core/ai-client.js`    | Shared HTTP client: callAzureOpenAI(), streamAzureOpenAI()                                                                  |

### Word info return shape

`generateWordInfo()` and each item from `generateBulkWordInfo()` return a `meanings`
array, ordered most-common-first, where each entry is
`{ sense, vietnamese, ipaUS, ipaUK, wordType, description }`. The primary meaning
(`meanings[0]`) is also mirrored onto the top-level `vietnamese/ipaUS/ipaUK/wordType/description`
fields for convenience. The AI is instructed to rank the most common everyday meaning
first and only list genuinely distinct common meanings (≤4 single, ≤3 bulk). The UI lets
users pick a meaning (selectable cards in the word form, per-row dropdown in bulk add).

## AI Call Pattern

All AI calls go through the shared client in `js/core/ai-client.js`. Its actual
signature is `callAzureOpenAI(messages, { temperature, maxTokens })` — it returns
the already-parsed JSON object directly (not a raw HTTP response):

```js
import { callAzureOpenAI } from '../core/ai-client.js';

const result = await callAzureOpenAI(
  [{ role: 'system', content: '...' }, { role: 'user', content: '...' }],
  { temperature: 0.5, maxTokens: 1000 },
);
```

`response_format: { type: 'json_object' }` and JSON-parsing/code-fence cleanup are
handled internally by `callAzureOpenAI` — callers do not pass or parse it themselves.

## Rules

- Always rely on `callAzureOpenAI`'s built-in `response_format: { type: "json_object" }` handling
- All feedback/explanation text shown on the frontend MUST be in English (per CLAUDE.md). Vietnamese is only allowed inside an actual Vietnamese-content field (e.g. a `vietnamese` translation), never in labels, notes, or other chrome text
- Temperature: 0.5 deterministic, 0.3 for strict structured extraction (e.g. word forms, sentence patterns), 0.7-0.9 creative
- Batch limit: ~6 words per AI call (fewer for richer per-item output, e.g. 3 for sentence patterns)
- `escapeHtml()` on AI text before DOM insertion
- Wrap JSON parse/call in try-catch; toast on failure (single-item), or per-batch fallback to safe defaults (bulk)
