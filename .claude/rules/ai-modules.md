---
paths:
  - "js/ai.js"
  - "js/reading-ai.js"
  - "js/writing-ai.js"
---

# AI Module Rules

- All AI calls use Azure OpenAI Chat Completions REST API
- Always request response_format: { type: "json_object" } for structured responses
- All feedback/explanation text must be in Vietnamese
- Temperature: 0.5 for deterministic (word info, evaluation), 0.7-0.9 for creative (paragraphs, passages)
- Batch limit: ~6 words per AI call to avoid token limits
- Parse with JSON.parse(response.choices[0].message.content)
- Always wrap response parsing in try-catch with showToast() on failure
- System role defines expertise; user role provides specific task data
- escapeHtml() on any AI-generated text before DOM insertion
