---
name: wordcraft-ai-prompt
description: Guide for writing Azure OpenAI prompts for WordCraft. Use when adding or editing AI functions, prompts, evaluation logic, or response parsing.
---

# Writing AI Prompts for WordCraft

## API Call Template

Use the shared client from `js/core/ai-client.js`:

```js
import { callAzureOpenAI } from '../core/ai-client.js';

async function yourFunction(input) {
  try {
    const result = await callAzureOpenAI(
      [
        { role: 'system', content: 'You are ...' },
        { role: 'user', content: `...${input}...` },
      ],
      { temperature: 0.5, maxTokens: 1000 },
    );
    // result is already the parsed JSON object — response_format and
    // JSON parsing are handled internally by callAzureOpenAI
    return result;
  } catch (err) {
    console.error(err);
    showToast('Failed to call AI', 'error');
  }
}
```

## AI Files

| File                    | Purpose                                          |
| ----------------------- | ------------------------------------------------ |
| `js/ai/word-ai.js`     | Word info, bulk info, insights, paragraph gen    |
| `js/ai/word-forms-ai.js` | Word form detection + bulk generation (4 POS forms, batch size 6) |
| `js/ai/sentence-ai.js` | Sentence pattern analysis (core fields only) + bulk generation (auto EN/VI detection, batch size 6) + lazy insights (usage/notes/register/variations, sparkle-triggered) |
| `js/ai/reading-ai.js`  | Reading passage generation                       |
| `js/ai/writing-ai.js`  | Writing evaluators, dictation, translation       |
| `js/ai/chat-ai.js`     | Chat streaming + 2-layer cache                   |
| `js/ai/feedback-builder.js` | Score badges, error cards, diff HTML        |

## Temperature Guide

| Type                   | Temp | Example                                             |
| ---------------------- | ---- | --------------------------------------------------- |
| Word info, evaluation  | 0.5  | `generateWordInfo`, `evaluateSentence`              |
| Strict structured extraction | 0.3 | `generateWordFormInfo`, `generateSentenceInfo` |
| Paragraphs, challenges | 0.7  | `generateParagraph`, `generateTranslationChallenge` |
| Reading passages       | 0.8  | `generateReadingPassage`                            |

## Prompt Rules

- System role: define AI expertise
- User role: provide specific data/task
- Always request `response_format: { type: "json_object" }` (handled internally by `callAzureOpenAI`)
- All feedback/explanation text shown on the frontend must be in **English** (per CLAUDE.md). Vietnamese is only appropriate inside an actual Vietnamese-content field (e.g. a `vietnamese` translation field), never in labels, notes, or other chrome text
- Batch: max ~6 words per call (use smaller batches like 3 for items with richer per-item output)
- `escapeHtml()` before inserting AI text into DOM
