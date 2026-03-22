---
name: wordcraft-ai-prompt
description: Guide for writing Azure OpenAI prompts for WordCraft. Use when adding or editing AI functions, prompts, evaluation logic, or response parsing.
---

# Writing AI Prompts for WordCraft

## API Call Template

```js
async function yourFunction(input) {
  const session = JSON.parse(sessionStorage.getItem("wordcraft_session"));
  const { endpoint, apiKey, deploymentName, apiVersion } = session.azureOpenAI;

  try {
    const response = await fetch(
      `${endpoint}/openai/deployments/${deploymentName}/chat/completions?api-version=${apiVersion}`,
      {
        method: "POST",
        headers: { "api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "system", content: "You are ..." },
            { role: "user", content: `...${input}...` },
          ],
          temperature: 0.5,
          max_tokens: 1000,
          response_format: { type: "json_object" },
        }),
      },
    );
    const data = await response.json();
    return JSON.parse(data.choices[0].message.content);
  } catch (err) {
    console.error(err);
    showToast("Lỗi khi gọi AI", "error");
  }
}
```

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
