/* ============================================================
   AI MODULE
   Azure OpenAI integration — paragraph generation, word info,
   bulk word info, and comprehensive word insights.
   ============================================================ */

import { callAzureOpenAI, getAzureConfig } from '../core/ai-client.js';

const VALID_WORD_TYPES = ['noun', 'verb', 'adj', 'adv', 'phrase', 'other'];
const BULK_WORD_BATCH_SIZE = 6;

/**
 * Call Azure OpenAI Chat Completions to generate a paragraph
 * using the provided English vocabulary words.
 *
 * Returns both the English paragraph and its Vietnamese translation.
 *
 * @param {Array<{ word: string, wordType: string, vietnamese?: string, description?: string }>} wordObjects
 * @param {string} [customInstruction]
 * @param {string} [topicName]
 * @returns {Promise<{ english: string, vietnamese: string }>}
 */
export async function generateParagraph(wordObjects, customInstruction = '', topicName = '') {
  const wordList = wordObjects.map(w => {
    const parts = [w.word, `(${w.wordType})`];
    if (w.vietnamese) parts.push(`- ${w.vietnamese}`);
    if (w.description) parts.push(`[${w.description}]`);
    return parts.join(' ');
  }).join('\n  • ');
  const trimmedInstruction = (customInstruction || '').trim();

  const topicContext = topicName
    ? `\nThis paragraph is for a vocabulary topic called "${topicName}". Use a scenario or context related to this topic if it represents a clear subject area (e.g. "Business English", "Travel", "Medical Terms"). If the topic name is vague or generic, ignore it.`
    : '';

  const systemPrompt = `You are an English language tutor helping Vietnamese learners.
Write a coherent paragraph using the provided vocabulary words.${topicContext}

HARD RULES (never break these):
- Use ALL of the given vocabulary words in the English paragraph.
- The paragraph must be NO LONGER THAN 30 words total. Keep it concise.
- All non-target words must use extremely basic English (A1-A2 level) so learners can focus on the target vocabulary.
- Keep sentence structure simple and clear.
- Return ONLY valid JSON with exactly two fields: "english" and "vietnamese".
- Do NOT wrap the JSON in markdown code blocks.

SOFT GUIDELINES (follow unless the user's custom instruction overrides):
- Tell a small story or describe a real-life situation.
- Use 2-4 short sentences to stay within the 30-word limit.
${trimmedInstruction ? `
USER'S CUSTOM INSTRUCTION (follow closely; overrides soft guidelines):
---
${trimmedInstruction}
---` : ''}`;

  const userPrompt = `Write a paragraph (max 30 words) using these vocabulary words:
  • ${wordList}

Use the Vietnamese meanings and descriptions above to understand each word's intended meaning, then write the paragraph in English.

Return your response as JSON:
{
  "english": "The English paragraph here...",
  "vietnamese": "Bản dịch tiếng Việt ở đây..."
}`;

  try {
    const parsed = await callAzureOpenAI(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { temperature: 1, maxTokens: 5000 },
    );

    return {
      english: parsed.english || '',
      vietnamese: parsed.vietnamese || '',
    };
  } catch (err) {
    // Fallback: if JSON parse failed, callAzureOpenAI already threw
    // but for generateParagraph we historically used a raw-text fallback
    console.warn('generateParagraph error:', err.message);
    throw err;
  }
}

/**
 * Call Azure OpenAI to auto-fill word details for a given English word.
 *
 * @param {string} englishWord
 * @param {string} [topicName]
 * @param {{ wordType?: string, vietnamese?: string }} [hints]
 * @returns {Promise<{ correctedWord: string|null, vietnamese: string, ipaUS: string, ipaUK: string, wordType: string, description: string }>}
 */
export async function generateWordInfo(englishWord, topicName, hints = {}) {
  const topicContext = topicName
    ? `\nThis word is being added to a vocabulary topic called "${topicName}". First, evaluate whether this topic name represents a genuine vocabulary domain or category (e.g. "Business English", "Medical Terms", "Travel", "Phrasal Verbs"). If the topic name appears to be a placeholder, random characters, or too vague to indicate a specific vocabulary domain (e.g. "abc", "test", "my topic", single letters, numbers), ignore it and provide the most common/general meaning instead. Only use the topic context to choose the relevant meaning if the topic name clearly indicates a real subject area.`
    : '';

  const hintWordType = hints.wordType && VALID_WORD_TYPES.includes(hints.wordType) ? hints.wordType : '';
  const hintVietnamese = (hints.vietnamese || '').trim();
  const hintsContext = (hintWordType || hintVietnamese)
    ? `\nThe user has provided the following hints to identify the correct meaning — treat these as strong signals:${hintWordType ? `\n- Intended word type: ${hintWordType}` : ''}${hintVietnamese ? `\n- Intended Vietnamese meaning (approximate): "${hintVietnamese}"` : ''}`
    : '';

  const systemPrompt = `You are an English-Vietnamese dictionary assistant.
Given an English word or phrase, return a JSON object with these fields:
- "correctedWord": if the input word is misspelled, provide the correct English spelling here; if spelling is correct, set to null
- "vietnamese": the most common Vietnamese translation (short, 1-5 words)
- "ipaUS": the IPA pronunciation for American English (e.g. /əˈkɑːm.plɪʃ/)
- "ipaUK": the IPA pronunciation for British English (e.g. /əˈkʌm.plɪʃ/)
- "wordType": one of exactly: noun, verb, adj, adv, phrase, other
- "description": a brief Vietnamese description or usage note (1-2 short sentences)
${topicContext}${hintsContext}
IMPORTANT:
- If the input word appears to be misspelled (e.g. "acomplish", "beutiful"), detect the most likely intended English word, provide all field values for that corrected word, and set "correctedWord" to the corrected spelling.
- If the spelling is correct, set "correctedWord" to null.
- Return ONLY valid JSON, no markdown code blocks, no extra text.
- Use standard IPA notation with slashes for both US and UK pronunciations.`;

  const userPrompt = `Word: "${englishWord}"

Return JSON:
{
  "correctedWord": null,
  "vietnamese": "...",
  "ipaUS": "...",
  "ipaUK": "...",
  "wordType": "...",
  "description": "..."
}`;

  const parsed = await callAzureOpenAI(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    { temperature: 0.5, maxTokens: 300 },
  );

  const wordType = VALID_WORD_TYPES.includes(parsed.wordType) ? parsed.wordType : 'other';

  return {
    correctedWord: parsed.correctedWord || null,
    vietnamese: parsed.vietnamese || '',
    ipaUS: parsed.ipaUS || '',
    ipaUK: parsed.ipaUK || '',
    wordType,
    description: parsed.description || '',
  };
}

/**
 * Call Azure OpenAI to auto-fill word details for multiple English words.
 * Requests are split into smaller batches to avoid oversized prompts.
 *
 * @param {string[]} englishWords
 * @param {Function} [onProgress]
 * @param {string} [topicName]
 * @returns {Promise<Array<Object>>}
 */
export async function generateBulkWordInfo(englishWords, onProgress, topicName) {
  if (!Array.isArray(englishWords) || englishWords.length === 0) {
    return [];
  }

  const allResults = [];
  for (let i = 0; i < englishWords.length; i += BULK_WORD_BATCH_SIZE) {
    const batchWords = englishWords.slice(i, i + BULK_WORD_BATCH_SIZE);
    const batchResults = await requestBulkWordInfoBatch(batchWords, topicName);
    allResults.push(...batchResults);
    if (typeof onProgress === 'function') {
      onProgress(allResults.length, englishWords.length);
    }
  }

  return allResults;
}

/**
 * Generate comprehensive AI insights for a single word.
 *
 * @param {{ english: string, wordType: string, vietnamese: string }} word
 * @param {string} topicName
 * @returns {Promise<Object>}
 */
export async function generateWordInsights(word, topicName) {
  const topicContext = topicName
    ? `\nThis word belongs to the vocabulary topic "${topicName}".`
    : '';

  const systemPrompt = `You are an advanced English language learning assistant for Vietnamese speakers.
Given an English word with its type and basic meaning, provide comprehensive learning insights.
${topicContext}
Return ONLY valid JSON with these fields:
- "synonyms": array of { "word": string, "vietnamese": string } (3-5 items)
- "antonyms": array of { "word": string, "vietnamese": string } (2-3 items, empty array if none apply)
- "collocations": array of strings (4-6 common collocations, e.g. "make a decision")
- "exampleSentences": array of { "english": string, "vietnamese": string, "level": string } where level is "A2", "B1", or "B2" (exactly 3 sentences)
- "wordFamily": array of { "word": string, "wordType": string, "vietnamese": string }
- "commonMistakes": array of { "wrong": string, "correct": string, "explanation": string } (2-3 items, explanation in Vietnamese)
- "register": one of "formal", "informal", or "neutral"
- "usageNote": string (1-2 sentences in Vietnamese about when/how to use this word)
- "grammarPatterns": array of strings (key grammar patterns like "verb + to-infinitive", empty array if not applicable)
- "phrasalVerbs": array of { "phrase": string, "meaning": string } (only if word is a verb, otherwise empty array)
- "countability": string or null (only for nouns: "countable", "uncountable", or "both"; null for non-nouns)
- "confusedWith": array of { "word": string, "difference": string } (1-2 commonly confused words, difference in Vietnamese)

IMPORTANT:
- Return ONLY valid JSON, no markdown code blocks, no extra text.
- All explanations for Vietnamese learners should be in Vietnamese.
- Example sentences should use simple vocabulary (A1-A2) except for the target word.`;

  const userPrompt = `Word: "${word.english}"
Type: ${word.wordType || 'other'}
Vietnamese meaning: ${word.vietnamese || ''}

Return JSON with all the required fields.`;

  const parsed = await callAzureOpenAI(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    { temperature: 0.7, maxTokens: 2000 },
  );

  return {
    synonyms: Array.isArray(parsed.synonyms) ? parsed.synonyms : [],
    antonyms: Array.isArray(parsed.antonyms) ? parsed.antonyms : [],
    collocations: Array.isArray(parsed.collocations) ? parsed.collocations : [],
    exampleSentences: Array.isArray(parsed.exampleSentences) ? parsed.exampleSentences : [],
    wordFamily: Array.isArray(parsed.wordFamily) ? parsed.wordFamily : [],
    commonMistakes: Array.isArray(parsed.commonMistakes) ? parsed.commonMistakes : [],
    register: parsed.register || 'neutral',
    usageNote: parsed.usageNote || '',
    grammarPatterns: Array.isArray(parsed.grammarPatterns) ? parsed.grammarPatterns : [],
    phrasalVerbs: Array.isArray(parsed.phrasalVerbs) ? parsed.phrasalVerbs : [],
    countability: parsed.countability || null,
    confusedWith: Array.isArray(parsed.confusedWith) ? parsed.confusedWith : [],
  };
}

// ----------------------------------------------------------------
// Internal: bulk batch helper
// ----------------------------------------------------------------

async function requestBulkWordInfoBatch(englishWords, topicName) {
  const wordList = englishWords.map(w => `"${w}"`).join(', ');

  const topicContext = topicName
    ? `\nThese words are being added to a vocabulary topic called "${topicName}". First, evaluate whether this topic name represents a genuine vocabulary domain or category (e.g. "Business English", "Medical Terms", "Travel", "Phrasal Verbs"). If the topic name appears to be a placeholder, random characters, or too vague to indicate a specific vocabulary domain (e.g. "abc", "test", "my topic", single letters, numbers), ignore it and provide the most common/general meaning instead. Only use the topic context to choose the relevant meaning if the topic name clearly indicates a real subject area.`
    : '';

  const systemPrompt = `You are an English-Vietnamese dictionary assistant.
Given a list of English words or phrases, return a JSON array where each element has these fields:
- "english": the correctly spelled English word/phrase (if the input has a typo, correct it here)
- "correctedWord": if the input word was misspelled, provide the corrected spelling here; if spelling was correct, set to null
- "vietnamese": the most common Vietnamese translation (short, 1-5 words)
- "ipaUS": the IPA pronunciation for American English (e.g. /əˈkɑːm.plɪʃ/)
- "ipaUK": the IPA pronunciation for British English (e.g. /əˈkʌm.plɪʃ/)
- "wordType": one of exactly: noun, verb, adj, adv, phrase, other
- "description": a brief Vietnamese description or usage note (1-2 short sentences)
${topicContext}
IMPORTANT:
- For each word: if it appears misspelled, correct it, return data for the corrected word, and set "correctedWord" to the corrected spelling. If spelling is correct, set "correctedWord" to null.
- Return ONLY a valid JSON array, no markdown code blocks, no extra text.
- The array must have exactly one element per input word, in the same order.
- Use standard IPA notation with slashes for both US and UK pronunciations.`;

  const userPrompt = `Words: [${wordList}]

Return a JSON array:
[
  { "english": "...", "correctedWord": null, "vietnamese": "...", "ipaUS": "...", "ipaUK": "...", "wordType": "...", "description": "..." },
  ...
]`;

  const maxTokens = Math.min(englishWords.length * 300, 4096);

  const parsed = await callAzureOpenAI(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    { temperature: 0.5, maxTokens },
  );

  // callAzureOpenAI returns parsed JSON — could be an array directly
  const arr = Array.isArray(parsed) ? parsed : [];
  if (!Array.isArray(parsed)) {
    throw new Error('AI response is not an array.');
  }

  return englishWords.map((originalWord, i) => {
    const item = arr[i] && typeof arr[i] === 'object' ? arr[i] : {};
    const corrected = item.correctedWord || null;
    return {
      english: corrected || item.english || originalWord || '',
      originalWord: originalWord,
      correctedWord: corrected,
      vietnamese: item.vietnamese || '',
      ipaUS: item.ipaUS || '',
      ipaUK: item.ipaUK || '',
      wordType: VALID_WORD_TYPES.includes(item.wordType) ? item.wordType : 'other',
      description: item.description || '',
    };
  });
}
