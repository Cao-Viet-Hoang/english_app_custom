/* ============================================================
   WORD FORMS AI MODULE
   Azure OpenAI integration — single word form generation and
   bulk word form generation (4 POS forms per word).
   ============================================================ */

import { callAzureOpenAI } from '../core/ai-client.js';

const BULK_FORM_BATCH_SIZE = 6;

/**
 * Call Azure OpenAI to detect the base type and all 4 POS forms for a word.
 *
 * @param {string} word - The word to look up
 * @returns {Promise<{ baseType: string, noun: string, verb: string, adjective: string, adverb: string }>}
 */
export async function generateWordFormInfo(word) {
  const systemPrompt = `You are an English vocabulary assistant.
Given a single English word, identify its part of speech and generate its related word forms.
Return ONLY valid JSON:
{
  "baseType": "noun" | "verb" | "adjective" | "adverb",
  "noun": "<noun form or empty string if none>",
  "verb": "<verb form or empty string if none>",
  "adjective": "<adjective form or empty string if none>",
  "adverb": "<adverb form or empty string if none>"
}
Rules:
- The field matching baseType should contain the input word itself
- If a form doesn't exist naturally in English, return empty string ""
- Return lowercase words only
- noun: the base noun form (singular)
- verb: the base infinitive form
- adjective: the base adjective form
- adverb: the base adverb form`;

  const userPrompt = `Word: "${word}"

Return JSON:
{
  "baseType": "...",
  "noun": "...",
  "verb": "...",
  "adjective": "...",
  "adverb": "..."
}`;

  const parsed = await callAzureOpenAI(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    { temperature: 0.3, maxTokens: 300 },
  );

  return {
    baseType:  parsed.baseType  || 'noun',
    noun:      parsed.noun      || '',
    verb:      parsed.verb      || '',
    adjective: parsed.adjective || '',
    adverb:    parsed.adverb    || '',
  };
}

/**
 * Call Azure OpenAI to generate POS forms for multiple words.
 * Requests are split into batches of 6.
 *
 * @param {string[]} wordList   Array of words
 * @param {Function} [onProgress]  Optional callback (done, total) => void
 * @returns {Promise<Array<{ word: string, baseType: string, noun: string, verb: string, adjective: string, adverb: string }>>}
 */
export async function generateBulkWordFormInfo(wordList, onProgress) {
  if (!Array.isArray(wordList) || wordList.length === 0) {
    return [];
  }

  const allResults = [];

  for (let i = 0; i < wordList.length; i += BULK_FORM_BATCH_SIZE) {
    const batch = wordList.slice(i, i + BULK_FORM_BATCH_SIZE);
    const batchResults = await requestBulkWordFormBatch(batch);
    allResults.push(...batchResults);
    if (typeof onProgress === 'function') {
      onProgress(allResults.length, wordList.length);
    }
  }

  return allResults;
}

// ----------------------------------------------------------------
// Internal: bulk batch helper
// ----------------------------------------------------------------

async function requestBulkWordFormBatch(wordList) {
  const wordListStr = wordList.map(w => `"${w}"`).join(', ');

  const systemPrompt = `You are an English vocabulary assistant.
Given a list of English words, identify each word's part of speech and generate its related word forms.
Return ONLY a valid JSON array where each element has these fields:
- "word": the input word exactly as given
- "baseType": "noun" | "verb" | "adjective" | "adverb"
- "noun": noun form (singular) or "" if none
- "verb": infinitive form or "" if none
- "adjective": adjective form or "" if none
- "adverb": adverb form or "" if none
Rules:
- The field matching baseType should contain the input word itself
- If a form doesn't exist naturally in English, return ""
- Return lowercase words only
- Return ONLY a valid JSON array, no markdown code blocks, no extra text
- The array must have exactly one element per input word, in the same order`;

  const userPrompt = `Words: [${wordListStr}]

Return a JSON array:
[
  { "word": "...", "baseType": "...", "noun": "...", "verb": "...", "adjective": "...", "adverb": "..." },
  ...
]`;

  const maxTokens = Math.min(wordList.length * 100, 2048);

  let parsed;
  try {
    parsed = await callAzureOpenAI(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { temperature: 0.3, maxTokens },
    );
  } catch (err) {
    console.warn('requestBulkWordFormBatch error:', err.message);
    return wordList.map(word => ({
      word, baseType: 'noun', noun: '', verb: '', adjective: '', adverb: '',
    }));
  }

  const arr = Array.isArray(parsed) ? parsed : [];

  return wordList.map((word, i) => {
    const item = arr[i] && typeof arr[i] === 'object' ? arr[i] : {};
    return {
      word:      item.word      || word,
      baseType:  item.baseType  || 'noun',
      noun:      item.noun      || '',
      verb:      item.verb      || '',
      adjective: item.adjective || '',
      adverb:    item.adverb    || '',
    };
  });
}
