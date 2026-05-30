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

All AI calls go through the shared client in `js/core/ai-client.js`:

```js
import { callAzureOpenAI } from '../core/ai-client.js';

const result = await callAzureOpenAI({
  messages: [{ role: 'system', content: '...' }, { role: 'user', content: '...' }],
  temperature: 0.5,
  max_tokens: 1000,
  response_format: { type: 'json_object' }
});
```

## Rules

- Always use `response_format: { type: "json_object" }`
- All feedback text MUST be in Vietnamese
- Temperature: 0.5 deterministic, 0.7-0.9 creative
- Batch limit: ~6 words per AI call
- `escapeHtml()` on AI text before DOM insertion
- Wrap JSON parse in try-catch; toast on failure
