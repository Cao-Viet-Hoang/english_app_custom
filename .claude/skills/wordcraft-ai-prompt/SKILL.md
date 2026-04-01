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
    const result = await callAzureOpenAI({
      messages: [
        { role: 'system', content: 'You are ...' },
        { role: 'user', content: `...${input}...` }
      ],
      temperature: 0.5,
      max_tokens: 1000,
      response_format: { type: 'json_object' }
    });
    return JSON.parse(result.choices[0].message.content);
  } catch (err) {
    console.error(err);
    showToast('Lỗi khi gọi AI', 'error');
  }
}
```

## AI Files

| File                    | Purpose                                          |
| ----------------------- | ------------------------------------------------ |
| `js/ai/word-ai.js`     | Word info, bulk info, insights, paragraph gen    |
| `js/ai/reading-ai.js`  | Reading passage generation                       |
| `js/ai/writing-ai.js`  | Writing evaluators, dictation, translation       |
| `js/ai/chat-ai.js`     | Chat streaming + 2-layer cache                   |
| `js/ai/feedback-builder.js` | Score badges, error cards, diff HTML        |

## Temperature Guide

| Type                   | Temp | Example                                             |
| ---------------------- | ---- | --------------------------------------------------- |
| Word info, evaluation  | 0.5  | `generateWordInfo`, `evaluateSentence`              |
| Paragraphs, challenges | 0.7  | `generateParagraph`, `generateTranslationChallenge` |
| Reading passages       | 0.8  | `generateReadingPassage`                            |

## Prompt Rules

- System role: define AI expertise
- User role: provide specific data/task
- Always `response_format: { type: "json_object" }`
- All feedback text in **Vietnamese**
- Batch: max ~6 words per call
- `escapeHtml()` before inserting AI text into DOM
