/* ============================================================
   AI MODULE
   Azure OpenAI integration — generate paragraphs from vocab.
   ============================================================ */

import { getSession } from './router.js';

const VALID_WORD_TYPES = ['noun', 'verb', 'adj', 'adv', 'phrase', 'other'];
const BULK_WORD_BATCH_SIZE = 6;

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
Your task is to write a coherent paragraph using the provided vocabulary words. 
The paragraph should be natural, educational, and easy to understand for English learners.
Then provide the Vietnamese translation of the entire paragraph.

IMPORTANT: 
- Use ALL of the given words in the English paragraph.
- The paragraph should tell a small story or describe a situation.
- Adjust the number of sentences based on the number of vocabulary words provided: roughly 1-2 sentences per word, but keep the total between 3 and 10 sentences maximum.
- ONLY the provided vocabulary words may be advanced or unfamiliar. All other words in the paragraph must be extremely common, basic English (A1-A2 level) so that learners can focus on the target vocabulary without being overwhelmed by additional unknown words.
- Keep sentence structure simple and clear.
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
    temperature: 1,
    max_completion_tokens: 2000,
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

/**
 * Call Azure OpenAI to auto-fill word details for a given English word.
 *
 * Returns { vietnamese, ipaUS, ipaUK, wordType, description }
 *
 * @param {string} englishWord  The English word to look up
 * @returns {Promise<{ vietnamese: string, ipaUS: string, ipaUK: string, wordType: string, description: string }>}
 */
export async function generateWordInfo(englishWord, topicName) {
  const session = getSession();
  if (!session || !session.azureOpenAI) {
    throw new Error('Azure OpenAI config not found. Please log in again.');
  }

  const { endpoint, apiKey, deploymentName, apiVersion } = session.azureOpenAI;
  const baseUrl = endpoint.replace(/\/+$/, '');
  const version = apiVersion || '2024-08-01-preview';
  const url = `${baseUrl}/openai/deployments/${deploymentName}/chat/completions?api-version=${version}`;

  const topicContext = topicName
    ? `\nThis word is being added to a vocabulary topic called "${topicName}". Use this context to choose the most relevant meaning and usage.`
    : '';

  const systemPrompt = `You are an English-Vietnamese dictionary assistant.
Given an English word or phrase, return a JSON object with these fields:
- "vietnamese": the most common Vietnamese translation (short, 1-5 words)
- "ipaUS": the IPA pronunciation for American English (e.g. /əˈkɑːm.plɪʃ/)
- "ipaUK": the IPA pronunciation for British English (e.g. /əˈkʌm.plɪʃ/)
- "wordType": one of exactly: noun, verb, adj, adv, phrase, other
- "description": a brief Vietnamese description or usage note (1-2 short sentences)
${topicContext}
IMPORTANT:
- Return ONLY valid JSON, no markdown code blocks, no extra text.
- Use standard IPA notation with slashes for both US and UK pronunciations.`;

  const userPrompt = `Word: "${englishWord}"

Return JSON:
{
  "vietnamese": "...",
  "ipaUS": "...",
  "ipaUK": "...",
  "wordType": "...",
  "description": "..."
}`;

  const body = {
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userPrompt },
    ],
    temperature: 0.5,
    max_completion_tokens: 300,
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
    throw new Error(`Azure OpenAI request failed (${response.status}).`);
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty response from Azure OpenAI.');

  let cleaned = content.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  }

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('Could not parse AI response as JSON.');
  }

  const wordType = VALID_WORD_TYPES.includes(parsed.wordType) ? parsed.wordType : 'other';

  return {
    vietnamese:  parsed.vietnamese  || '',
    ipaUS:       parsed.ipaUS       || '',
    ipaUK:       parsed.ipaUK       || '',
    wordType,
    description: parsed.description || '',
  };
}

/**
 * Call Azure OpenAI to auto-fill word details for multiple English words.
 * Requests are split into smaller batches to avoid oversized prompts.
 *
 * @param {string[]} englishWords  Array of English words to look up
 * @returns {Promise<Array<{ english: string, vietnamese: string, ipaUS: string, ipaUK: string, wordType: string, description: string }>>}
 */
export async function generateBulkWordInfo(englishWords, onProgress, topicName) {
  const session = getSession();
  if (!session || !session.azureOpenAI) {
    throw new Error('Azure OpenAI config not found. Please log in again.');
  }

  const { endpoint, apiKey, deploymentName, apiVersion } = session.azureOpenAI;
  const baseUrl = endpoint.replace(/\/+$/, '');
  const version = apiVersion || '2024-08-01-preview';
  const url = `${baseUrl}/openai/deployments/${deploymentName}/chat/completions?api-version=${version}`;

  if (!Array.isArray(englishWords) || englishWords.length === 0) {
    return [];
  }

  const allResults = [];
  for (let i = 0; i < englishWords.length; i += BULK_WORD_BATCH_SIZE) {
    const batchWords = englishWords.slice(i, i + BULK_WORD_BATCH_SIZE);
    const batchResults = await requestBulkWordInfoBatch(url, apiKey, batchWords, topicName);
    allResults.push(...batchResults);
    if (typeof onProgress === 'function') {
      onProgress(allResults.length, englishWords.length);
    }
  }

  return allResults;
}

async function requestBulkWordInfoBatch(url, apiKey, englishWords, topicName) {
  const wordList = englishWords.map(w => `"${w}"`).join(', ');

  const topicContext = topicName
    ? `\nThese words are being added to a vocabulary topic called "${topicName}". Use this context to choose the most relevant meaning and usage for each word.`
    : '';

  const systemPrompt = `You are an English-Vietnamese dictionary assistant.
Given a list of English words or phrases, return a JSON array where each element has these fields:
- "english": the original English word/phrase (exactly as provided)
- "vietnamese": the most common Vietnamese translation (short, 1-5 words)
- "ipaUS": the IPA pronunciation for American English (e.g. /əˈkɑːm.plɪʃ/)
- "ipaUK": the IPA pronunciation for British English (e.g. /əˈkʌm.plɪʃ/)
- "wordType": one of exactly: noun, verb, adj, adv, phrase, other
- "description": a brief Vietnamese description or usage note (1-2 short sentences)
${topicContext}
IMPORTANT:
- Return ONLY a valid JSON array, no markdown code blocks, no extra text.
- The array must have exactly one element per input word, in the same order.
- Use standard IPA notation with slashes for both US and UK pronunciations.`;

  const userPrompt = `Words: [${wordList}]

Return a JSON array:
[
  { "english": "...", "vietnamese": "...", "ipaUS": "...", "ipaUK": "...", "wordType": "...", "description": "..." },
  ...
]`;

  const maxTokens = Math.min(englishWords.length * 300, 4096);

  const body = {
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userPrompt },
    ],
    temperature: 0.5,
    max_completion_tokens: maxTokens,
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
    throw new Error(`Azure OpenAI request failed (${response.status}).`);
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty response from Azure OpenAI.');

  let cleaned = content.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  }

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('Could not parse AI response as JSON.');
  }

  if (!Array.isArray(parsed)) {
    throw new Error('AI response is not an array.');
  }

  return englishWords.map((originalWord, i) => {
    const item = parsed[i] && typeof parsed[i] === 'object' ? parsed[i] : {};
    return {
      english:     item.english     || originalWord || '',
      vietnamese:  item.vietnamese  || '',
      ipaUS:       item.ipaUS       || '',
      ipaUK:       item.ipaUK       || '',
      wordType:    VALID_WORD_TYPES.includes(item.wordType) ? item.wordType : 'other',
      description: item.description || '',
    };
  });
}
