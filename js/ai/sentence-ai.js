/* ============================================================
   SENTENCE PATTERNS AI MODULE
   Azure OpenAI integration — core sentence-pattern analysis
   (single + bulk, auto EN/VI detection, translation, pattern,
   level) plus lazily-generated extra insights (usage, notes,
   register, variations) mirroring the vocabulary AI Insights flow.
   ============================================================ */

import { callAzureOpenAI } from '../core/ai-client.js';

const BULK_SENTENCE_BATCH_SIZE = 6;

/**
 * Call Azure OpenAI to analyze a single sentence (English or Vietnamese input).
 * Auto-detects the input language, translates to the other language, and
 * identifies the grammatical pattern and CEFR level. This powers the main
 * Add/Edit Sentence form — richer info (usage, notes, register, variations)
 * is generated separately and lazily via `generateSentenceInsights()`.
 *
 * @param {string} inputText - A sentence in English OR Vietnamese
 * @returns {Promise<{ english: string, vietnamese: string, pattern: string, level: string }>}
 */
export async function generateSentenceInfo(inputText) {
  const systemPrompt = `You are an English sentence-pattern learning assistant for Vietnamese speakers.
Given a single input sentence, which may be written in English OR Vietnamese, do the following:
1. Detect the input language automatically.
2. Produce the English version of the sentence (translate it if the input was Vietnamese).
3. Produce the Vietnamese version of the sentence (translate it if the input was English).
4. Identify the grammatical structure/pattern of the English sentence (e.g. "S + V + O", "It is + adj + to V", "S + V + that-clause"), named in a way a learner recognizes.
5. Estimate the CEFR level of the sentence.

Return ONLY valid JSON:
{
  "english": "<English sentence>",
  "vietnamese": "<Vietnamese sentence>",
  "pattern": "<grammatical pattern, in English>",
  "level": "A1" | "A2" | "B1" | "B2" | "C1" | "C2"
}

Rules:
- The "vietnamese" field must contain natural Vietnamese text — it is the only field allowed to contain Vietnamese.
- Every other field ("english", "pattern", "level") must be written in English only.
- Never leave a field empty — always give your best-effort, non-empty value.
- Return ONLY the JSON object, no markdown code blocks, no extra text.`;

  const userPrompt = `Input sentence: "${inputText}"

Return JSON:
{
  "english": "...",
  "vietnamese": "...",
  "pattern": "...",
  "level": "..."
}`;

  const parsed = await callAzureOpenAI(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    { temperature: 0.3, maxTokens: 350 },
  );

  return {
    english:    parsed.english    || inputText,
    vietnamese: parsed.vietnamese || '',
    pattern:    parsed.pattern    || '',
    level:      parsed.level      || 'B1',
  };
}

/**
 * Call Azure OpenAI to analyze multiple sentences (English or Vietnamese, mixed).
 * Requests are split into batches of 6, each returning only the core fields
 * used by the main form (english, vietnamese, pattern, level).
 *
 * @param {string[]} sentenceList - Array of raw input sentences (English or Vietnamese)
 * @param {Function} [onProgress] - Optional callback (done, total) => void
 * @returns {Promise<Array<{ english: string, vietnamese: string, pattern: string, level: string }>>}
 */
export async function generateBulkSentenceInfo(sentenceList, onProgress) {
  if (!Array.isArray(sentenceList) || sentenceList.length === 0) {
    return [];
  }

  const allResults = [];

  for (let i = 0; i < sentenceList.length; i += BULK_SENTENCE_BATCH_SIZE) {
    const batch = sentenceList.slice(i, i + BULK_SENTENCE_BATCH_SIZE);
    const batchResults = await requestBulkSentenceBatch(batch);
    allResults.push(...batchResults);
    if (typeof onProgress === 'function') {
      onProgress(allResults.length, sentenceList.length);
    }
  }

  return allResults;
}

/**
 * Lazily generate the "extra" insights for an already-saved sentence:
 * usage explanation, nuance notes, register classification, and a handful
 * of alternative variations using the same pattern. Mirrors the vocabulary
 * AI Insights flow — triggered on demand from a sparkle button, not during
 * the initial Add/Edit form fill.
 *
 * @param {{ english: string, pattern?: string }} sentence
 * @returns {Promise<{ usage: string, notes: string, register: string, variations: string[] }>}
 */
export async function generateSentenceInsights(sentence) {
  const english = sentence?.english || '';
  const pattern = sentence?.pattern || '';

  const systemPrompt = `You are an English sentence-pattern learning assistant for Vietnamese speakers.
Given an English sentence and its grammatical pattern, do the following:
1. Explain when/how this sentence pattern is typically used.
2. Give short notes on nuances, common mistakes, or formality tips for this pattern.
3. Classify the register of the sentence.
4. Generate 3-5 alternative English sentences using the same or a closely related pattern.

Return ONLY valid JSON:
{
  "usage": "<short usage explanation, in English>",
  "notes": "<short notes, in English>",
  "register": "formal" | "neutral" | "informal",
  "variations": ["<alternative English sentence>", ...]
}

Rules:
- Every field must be written in English only.
- Never leave a field empty — always give your best-effort, non-empty value.
- "variations" must contain 3 to 5 distinct English sentences, each using the same or a closely related grammatical pattern.
- Return ONLY the JSON object, no markdown code blocks, no extra text.`;

  const userPrompt = `Sentence: "${english}"
Pattern: "${pattern || 'unspecified — infer it from the sentence'}"

Return JSON:
{
  "usage": "...",
  "notes": "...",
  "register": "...",
  "variations": ["...", "...", "..."]
}`;

  const parsed = await callAzureOpenAI(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    { temperature: 0.5, maxTokens: 500 },
  );

  return {
    usage:      parsed.usage      || '',
    notes:      parsed.notes      || '',
    register:   parsed.register   || 'neutral',
    variations: Array.isArray(parsed.variations) ? parsed.variations : [],
  };
}

// ----------------------------------------------------------------
// Internal: bulk batch helper
// ----------------------------------------------------------------

async function requestBulkSentenceBatch(sentenceList) {
  const sentenceListStr = sentenceList.map(s => `"${s}"`).join(', ');

  const systemPrompt = `You are an English sentence-pattern learning assistant for Vietnamese speakers.
Given a list of input sentences, each of which may be written in English OR Vietnamese, analyze each one independently.
For each input sentence:
1. Detect the input language automatically.
2. Produce the English version of the sentence (translate it if the input was Vietnamese).
3. Produce the Vietnamese version of the sentence (translate it if the input was English).
4. Identify the grammatical structure/pattern of the English sentence (e.g. "S + V + O", "It is + adj + to V"), named in a way a learner recognizes.
5. Estimate the CEFR level of the sentence.

Return ONLY a valid JSON array where each element has these fields:
- "input": the input sentence exactly as given
- "english": the English sentence
- "vietnamese": the Vietnamese sentence
- "pattern": grammatical pattern, in English
- "level": "A1" | "A2" | "B1" | "B2" | "C1" | "C2"

Rules:
- The "vietnamese" field must contain natural Vietnamese text — it is the only field allowed to contain Vietnamese.
- Every other field must be written in English only.
- Never leave a field empty — always give your best-effort, non-empty value.
- Return ONLY a valid JSON array, no markdown code blocks, no extra text.
- The array must have exactly one element per input sentence, in the same order.`;

  const userPrompt = `Sentences: [${sentenceListStr}]

Return a JSON array:
[
  { "input": "...", "english": "...", "vietnamese": "...", "pattern": "...", "level": "..." },
  ...
]`;

  const maxTokens = Math.min(sentenceList.length * 150, 1024);

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
    console.warn('requestBulkSentenceBatch error:', err.message);
    return sentenceList.map(input => ({
      english: input, vietnamese: '', pattern: '', level: 'B1',
    }));
  }

  const arr = Array.isArray(parsed) ? parsed : [];

  return sentenceList.map((input, i) => {
    const item = arr[i] && typeof arr[i] === 'object' ? arr[i] : {};
    return {
      english:    item.english    || input,
      vietnamese: item.vietnamese || '',
      pattern:    item.pattern    || '',
      level:      item.level      || 'B1',
    };
  });
}
