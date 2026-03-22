---
description: Guide for writing Azure OpenAI prompts and AI functions for WordCraft.
---

# Writing AI Prompts for WordCraft

## API Call Template

```js
async function yourFunction(input) {
  const session = JSON.parse(sessionStorage.getItem("wordcraft_session"));
  const { endpoint, apiKey, deploymentName, apiVersion } = session.azureOpenAI;

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
}
```

## Temperature: 0.5 (word info/eval) | 0.7 (paragraphs) | 0.8 (passages)

## Rules: always `response_format: json_object` | feedback in Vietnamese | max ~6 words/batch
