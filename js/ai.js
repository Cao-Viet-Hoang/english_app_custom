/* ============================================================
   AI MODULE
   Azure OpenAI integration — generate paragraphs from vocab.
   ============================================================ */

import { getSession } from './router.js';

/**
 * Call Azure OpenAI Chat Completions to generate a paragraph
 * using the provided English vocabulary words.
 *
 * Returns both the English paragraph and its Vietnamese translation.
 *
 * @param {string[]} englishWords  Array of English words to include
 * @returns {Promise<{ english: string, vietnamese: string }>}
 */
export async function generateParagraph(englishWords) {
  const session = getSession();
  if (!session || !session.azureOpenAI) {
    throw new Error('Azure OpenAI config not found. Please log in again.');
  }

  const { endpoint, apiKey, deploymentName, apiVersion } = session.azureOpenAI;

  // Build the API URL — Azure OpenAI format
  // Remove trailing slash from endpoint if present
  const baseUrl = endpoint.replace(/\/+$/, '');
  const version = apiVersion || '2024-08-01-preview';
  const url = `${baseUrl}/openai/deployments/${deploymentName}/chat/completions?api-version=${version}`;

  const wordList = englishWords.join(', ');

  const systemPrompt = `You are an English language tutor. 
Your task is to write a short, coherent paragraph (4-8 sentences) using the provided vocabulary words. 
The paragraph should be natural, educational, and easy to understand for English learners.
Then provide the Vietnamese translation of the entire paragraph.

IMPORTANT: 
- Use ALL of the given words in the English paragraph.
- The paragraph should tell a small story or describe a situation.
- Keep sentences simple and clear.
- Return ONLY valid JSON with exactly two fields: "english" and "vietnamese".
- Do NOT wrap the JSON in markdown code blocks.`;

  const userPrompt = `Write a paragraph using these vocabulary words: ${wordList}

Return your response as JSON:
{
  "english": "The English paragraph here...",
  "vietnamese": "Bản dịch tiếng Việt ở đây..."
}`;

  const body = {
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userPrompt },
    ],
    temperature: 0.7,
    max_completion_tokens: 1000,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key':      apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errBody = await response.text();
    console.error('Azure OpenAI error:', response.status, errBody);
    throw new Error(`Azure OpenAI request failed (${response.status}). Check your API key and deployment.`);
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('Empty response from Azure OpenAI.');
  }

  // Parse the JSON response — handle possible markdown code fence
  let cleaned = content.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  }

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Fallback: treat entire response as English, no Vietnamese
    console.warn('Could not parse AI response as JSON, using raw text.');
    parsed = { english: content.trim(), vietnamese: '' };
  }

  return {
    english:    parsed.english    || '',
    vietnamese: parsed.vietnamese || '',
  };
}
