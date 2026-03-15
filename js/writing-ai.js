/* ============================================================
   WRITING AI MODULE
   Azure OpenAI integration for writing practice evaluation
   and content generation.
   ============================================================ */

import { getSession } from './router.js';

/**
 * Private helper — call Azure OpenAI Chat Completions.
 * @param {Array} messages  Chat messages array
 * @param {Object} options  { temperature, maxTokens }
 * @returns {Promise<Object>}  Parsed JSON response
 */
async function callAzureOpenAI(messages, { temperature = 0.7, maxTokens = 800 } = {}) {
  const session = getSession();
  if (!session || !session.azureOpenAI) {
    throw new Error('Azure OpenAI config not found. Please log in again.');
  }

  const { endpoint, apiKey, deploymentName, apiVersion } = session.azureOpenAI;
  const baseUrl = endpoint.replace(/\/+$/, '');
  const version = apiVersion || '2024-08-01-preview';
  const url = `${baseUrl}/openai/deployments/${deploymentName}/chat/completions?api-version=${version}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify({
      messages,
      temperature,
      max_completion_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    console.error('Azure OpenAI error:', response.status, errBody);
    throw new Error(`Azure OpenAI request failed (${response.status}).`);
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty response from Azure OpenAI.');

  // Parse JSON — handle possible markdown code fence
  let cleaned = content.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error('Could not parse AI response as JSON.');
  }
}

// ----------------------------------------------------------------
// Sentence Writing — evaluate a user's sentence
// ----------------------------------------------------------------

/**
 * Evaluate a sentence written by the user for a given vocabulary word.
 *
 * @param {{ english: string, vietnamese: string, wordType: string }} word
 * @param {string} sentence  The user's sentence
 * @returns {Promise<{
 *   grammarScore: number,
 *   usageScore: number,
 *   naturalnessScore: number,
 *   overallScore: number,
 *   correctedSentence: string,
 *   feedback: string,
 *   tips: string[]
 * }>}
 */
export async function evaluateSentence(word, sentence) {
  const systemPrompt = `You are an English writing tutor for Vietnamese learners.
Evaluate the user's English sentence that should use the vocabulary word "${word.english}" (${word.wordType || 'other'} — meaning: ${word.vietnamese || ''}).

Score each criterion from 0 to 10:
- "grammarScore": Is the grammar correct?
- "usageScore": Is the vocabulary word used correctly and appropriately?
- "naturalnessScore": Does the sentence sound natural to a native speaker?
- "overallScore": Average of the three scores, rounded to nearest integer.

Also provide:
- "correctedSentence": The corrected/improved version of the sentence. If the sentence is already perfect, return it unchanged.
- "feedback": A brief overall feedback message in Vietnamese (2-3 sentences).
- "tips": An array of 1-3 short improvement tips in Vietnamese.

IMPORTANT:
- Return ONLY valid JSON, no markdown code blocks, no extra text.
- All feedback and tips must be in Vietnamese for the learner.`;

  const userPrompt = `Vocabulary word: "${word.english}"
User's sentence: "${sentence}"

Return JSON:
{
  "grammarScore": 0,
  "usageScore": 0,
  "naturalnessScore": 0,
  "overallScore": 0,
  "correctedSentence": "...",
  "feedback": "...",
  "tips": ["..."]
}`;

  const parsed = await callAzureOpenAI(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    { temperature: 0.7, maxTokens: 800 },
  );

  return {
    grammarScore: Number(parsed.grammarScore) || 0,
    usageScore: Number(parsed.usageScore) || 0,
    naturalnessScore: Number(parsed.naturalnessScore) || 0,
    overallScore: Number(parsed.overallScore) || 0,
    correctedSentence: parsed.correctedSentence || sentence,
    feedback: parsed.feedback || '',
    tips: Array.isArray(parsed.tips) ? parsed.tips : [],
  };
}

// ----------------------------------------------------------------
// Paragraph Writing — evaluate a user's paragraph
// ----------------------------------------------------------------

/**
 * Evaluate a paragraph written by the user that should incorporate
 * the given vocabulary words.
 *
 * @param {Array<{ english: string, vietnamese: string, wordType: string }>} words
 * @param {string} paragraph  The user's paragraph
 * @returns {Promise<Object>}
 */
export async function evaluateParagraph(words, paragraph) {
  const wordList = words.map(w => `"${w.english}" (${w.wordType || 'other'})`).join(', ');

  const systemPrompt = `You are an English writing tutor for Vietnamese learners.
Evaluate the user's English paragraph that should incorporate these vocabulary words: ${wordList}.

Score each criterion from 0 to 10:
- "grammarScore": Is the grammar correct throughout?
- "coherenceScore": Is the paragraph coherent and well-structured?
- "naturalnessScore": Does the writing sound natural?
- "overallScore": Weighted average, rounded to nearest integer.

Also provide:
- "wordResults": An array with one entry per target word: { "word": string, "used": boolean, "usedCorrectly": boolean }
- "correctedParagraph": The corrected/improved version of the paragraph.
- "feedback": Brief overall feedback in Vietnamese (2-3 sentences).
- "suggestions": Array of 1-3 specific improvement suggestions in Vietnamese.

IMPORTANT:
- Return ONLY valid JSON, no markdown code blocks, no extra text.
- All feedback and suggestions must be in Vietnamese.`;

  const userPrompt = `Target words: ${wordList}
User's paragraph: "${paragraph}"

Return JSON:
{
  "grammarScore": 0,
  "coherenceScore": 0,
  "naturalnessScore": 0,
  "overallScore": 0,
  "wordResults": [],
  "correctedParagraph": "...",
  "feedback": "...",
  "suggestions": []
}`;

  const parsed = await callAzureOpenAI(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    { temperature: 0.7, maxTokens: 1200 },
  );

  return {
    grammarScore: Number(parsed.grammarScore) || 0,
    coherenceScore: Number(parsed.coherenceScore) || 0,
    naturalnessScore: Number(parsed.naturalnessScore) || 0,
    overallScore: Number(parsed.overallScore) || 0,
    wordResults: Array.isArray(parsed.wordResults) ? parsed.wordResults : [],
    correctedParagraph: parsed.correctedParagraph || paragraph,
    feedback: parsed.feedback || '',
    suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
  };
}

// ----------------------------------------------------------------
// Translation — generate a Vietnamese challenge text
// ----------------------------------------------------------------

/**
 * Generate a Vietnamese text for translation practice,
 * incorporating the given vocabulary context.
 *
 * @param {Array<{ english: string, vietnamese: string }>} words
 * @returns {Promise<{ vietnameseText: string, referenceEnglish: string, usedWords: string[] }>}
 */
export async function generateTranslationChallenge(words) {
  const wordList = words.map(w => `"${w.english}" (${w.vietnamese || ''})`).join(', ');

  const systemPrompt = `You are an English-Vietnamese language tutor.
Generate a short Vietnamese paragraph (2-4 sentences) that a student would translate to English.
The paragraph should be designed so that the student needs to use these English vocabulary words in their translation: ${wordList}.

The Vietnamese text should:
- Be natural and grammatically correct Vietnamese.
- Be clearly translatable using the target vocabulary words.
- Use simple supporting vocabulary so the focus is on the target words.

Also provide a reference English translation.

IMPORTANT:
- Return ONLY valid JSON, no markdown code blocks, no extra text.`;

  const userPrompt = `Target English vocabulary: ${wordList}

Return JSON:
{
  "vietnameseText": "...",
  "referenceEnglish": "...",
  "usedWords": ["word1", "word2"]
}`;

  const parsed = await callAzureOpenAI(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    { temperature: 0.9, maxTokens: 600 },
  );

  return {
    vietnameseText: parsed.vietnameseText || '',
    referenceEnglish: parsed.referenceEnglish || '',
    usedWords: Array.isArray(parsed.usedWords) ? parsed.usedWords : [],
  };
}

// ----------------------------------------------------------------
// Translation — evaluate a user's translation
// ----------------------------------------------------------------

/**
 * Evaluate the user's English translation of a Vietnamese text.
 *
 * @param {string} vietnameseText      Original Vietnamese text
 * @param {string} userTranslation     User's English translation
 * @param {string} referenceTranslation  Reference English translation
 * @returns {Promise<Object>}
 */
export async function evaluateTranslation(vietnameseText, userTranslation, referenceTranslation) {
  const systemPrompt = `You are an English-Vietnamese translation evaluator.
Compare the user's English translation against the reference translation of a Vietnamese text.

Score each criterion from 0 to 10:
- "accuracyScore": How accurately does the translation convey the original meaning?
- "grammarScore": Is the English grammar correct?
- "overallScore": Weighted average, rounded to nearest integer.

Also provide:
- "correctedTranslation": The user's translation with ALL errors fixed (grammar, word choice, spelling). Keep as close to the user's original wording as possible — only fix what is wrong.
- "grammarErrors": An array of specific errors found. Each entry has:
  - "original": The exact wrong phrase/sentence from the user's translation.
  - "corrected": The corrected version of that phrase/sentence.
  - "explanation": A clear explanation in Vietnamese of why it is wrong and the grammar rule involved.
  - "type": Error category — one of "grammar", "word_choice", "spelling", "punctuation", "word_order".
  If there are no errors, return an empty array.
- "feedback": Brief overall evaluation in Vietnamese (2-3 sentences).
- "suggestedTranslation": Your best suggested English translation (may differ from correctedTranslation — this is an ideal/natural version).

IMPORTANT:
- The user's translation does NOT need to be identical to the reference — accept valid alternatives.
- "correctedTranslation" must be based on the user's original text with minimal changes.
- "grammarErrors" should list ALL errors, not just grammar — include word choice, spelling, etc.
- Return ONLY valid JSON, no markdown code blocks, no extra text.
- All explanations and feedback must be in Vietnamese.`;

  const userPrompt = `Vietnamese text: "${vietnameseText}"
Reference translation: "${referenceTranslation}"
User's translation: "${userTranslation}"

Return JSON:
{
  "accuracyScore": 0,
  "grammarScore": 0,
  "overallScore": 0,
  "correctedTranslation": "...",
  "grammarErrors": [
    {
      "original": "...",
      "corrected": "...",
      "explanation": "...",
      "type": "grammar"
    }
  ],
  "feedback": "...",
  "suggestedTranslation": "..."
}`;

  const parsed = await callAzureOpenAI(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    { temperature: 0.5, maxTokens: 1500 },
  );

  return {
    accuracyScore: Number(parsed.accuracyScore) || 0,
    grammarScore: Number(parsed.grammarScore) || 0,
    overallScore: Number(parsed.overallScore) || 0,
    correctedTranslation: parsed.correctedTranslation || parsed.suggestedTranslation || referenceTranslation,
    grammarErrors: Array.isArray(parsed.grammarErrors) ? parsed.grammarErrors : [],
    feedback: parsed.feedback || '',
    suggestedTranslation: parsed.suggestedTranslation || referenceTranslation,
  };
}

// ----------------------------------------------------------------
// Dictation — generate a sentence for listening practice
// ----------------------------------------------------------------

/**
 * Generate an English sentence using 1-2 vocabulary words
 * for dictation practice.
 *
 * @param {Array<{ english: string, vietnamese: string }>} words
 * @returns {Promise<{ sentence: string, usedWords: string[] }>}
 */
export async function generateDictationSentence(words) {
  const wordList = words.map(w => `"${w.english}"`).join(', ');

  const systemPrompt = `You are an English language tutor.
Generate ONE clear, natural English sentence (10-20 words) that uses 1-2 of these vocabulary words: ${wordList}.

Rules:
- The sentence should be clear when spoken aloud (good for dictation practice).
- Use simple supporting vocabulary (A1-A2 level) so the focus is on the target words.
- Do NOT use complex punctuation — keep it simple with commas and periods only.
- The sentence should tell something meaningful (not just list words).

IMPORTANT:
- Return ONLY valid JSON, no markdown code blocks, no extra text.`;

  const userPrompt = `Vocabulary words: ${wordList}

Return JSON:
{
  "sentence": "...",
  "usedWords": ["word1"]
}`;

  const parsed = await callAzureOpenAI(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    { temperature: 0.9, maxTokens: 200 },
  );

  return {
    sentence: parsed.sentence || '',
    usedWords: Array.isArray(parsed.usedWords) ? parsed.usedWords : [],
  };
}
