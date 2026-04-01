---
paths:
  - "js/ai/*.js"
---

# AI Module Rules

- All AI calls use Azure OpenAI Chat Completions REST API
- Shared HTTP client: `js/core/ai-client.js` (`callAzureOpenAI`, `streamAzureOpenAI`)
- Always request `response_format: { type: "json_object" }` for structured responses
- All feedback/explanation text must be in Vietnamese
- Temperature: 0.5 for deterministic (word info, evaluation), 0.7-0.9 for creative (paragraphs, passages)
- Batch limit: ~6 words per AI call to avoid token limits
- Parse with `JSON.parse(response.choices[0].message.content)`
- Always wrap response parsing in try-catch with `showToast()` on failure
- System role defines expertise; user role provides specific task data
- `escapeHtml()` on any AI-generated text before DOM insertion

## AI Files

| File                | Functions                                                    |
| ------------------- | ------------------------------------------------------------ |
| `js/ai/word-ai.js`    | generateWordInfo, generateBulkWordInfo, generateParagraph, generateWordInsights |
| `js/ai/reading-ai.js` | generateReadingPassage                                       |
| `js/ai/writing-ai.js` | evaluateSentence, evaluateParagraph, generateTranslationChallenge, evaluateTranslation, generateDictationSentence |
| `js/ai/chat-ai.js`    | Chat streaming + 2-layer cache                               |
| `js/ai/feedback-builder.js` | Score badges, error cards, diff HTML builders           |
