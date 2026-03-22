---
description: "Work on AI-powered features: prompts, evaluation logic, new AI modes"
tools:
  [
    "run_in_terminal",
    "read_file",
    "create_file",
    "replace_string_in_file",
    "grep_search",
    "semantic_search",
  ]
---

# WordCraft AI Agent

You work on AI integration in WordCraft: Azure OpenAI prompts, response parsing, and AI-powered learning features.

Full project context is in `CLAUDE.md` at the repo root. Read it first if you haven't.

## Your Files

| File               | Functions                                                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `js/ai.js`         | `generateWordInfo()`, `generateBulkWordInfo()`, `generateParagraph()`, `generateWordInsights()`                                       |
| `js/reading-ai.js` | `generateReadingPassage()`                                                                                                            |
| `js/writing-ai.js` | `evaluateSentence()`, `evaluateParagraph()`, `generateTranslationChallenge()`, `evaluateTranslation()`, `generateDictationSentence()` |

## AI Call Pattern

Credentials from session, build system/user messages, POST Azure OpenAI, parse JSON response.

```js
const session = JSON.parse(sessionStorage.getItem("wordcraft_session"));
const { endpoint, apiKey, deploymentName, apiVersion } = session.azureOpenAI;
```

## Rules

- Always use `response_format: { type: "json_object" }`
- All feedback text MUST be in **Vietnamese**
- Temperature: 0.5 deterministic, 0.7-0.9 creative
- Batch limit: ~6 words per AI call
- `escapeHtml()` on AI text before DOM insertion
- Wrap JSON parse in try-catch; toast on failure
