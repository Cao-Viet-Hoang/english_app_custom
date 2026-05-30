/* ============================================================
   WRITING AI MODULE
   Azure OpenAI integration for writing practice evaluation
   and content generation.
   ============================================================ */

import { callAzureOpenAI } from '../core/ai-client.js';

// ----------------------------------------------------------------
// Sentence Writing — evaluate a user's sentence
// ----------------------------------------------------------------

/**
 * Evaluate a sentence written by the user for a given vocabulary word.
 *
 * @param {{ english: string, vietnamese: string, wordType: string, description?: string }} word
 * @param {string} sentence  The user's sentence
 * @param {string} [topicName]
 * @param {Array<{ english: string, vietnamese: string, wordType: string }>} [topicWords]  All words in the topic
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
export async function evaluateSentence(word, sentence, topicName = '', topicWords = []) {
  const wordDescription = word.description ? ` — ${word.description}` : '';

  const topicContext = topicName
    ? `\nThis word belongs to the topic "${topicName}".`
    : '';

  const otherWords = topicWords
    .filter(w => w.english.toLowerCase() !== word.english.toLowerCase())
    .slice(0, 10)
    .map(w => `${w.english} (${w.wordType || 'other'}) — ${w.vietnamese || ''}`)
    .join(', ');

  const encourageContext = otherWords
    ? `\n\nOther vocabulary words in the same topic: ${otherWords}
If the user naturally used any of these topic words in their sentence, acknowledge it positively in your feedback.
In your tips, you may gently suggest incorporating other topic words if it would fit the context naturally — but NEVER penalize the score for not using them. This is encouragement only, not a requirement.`
    : '';

  const systemPrompt = `You are an English writing tutor for Vietnamese learners.
Evaluate the user's English sentence that should use the vocabulary word "${word.english}" (${word.wordType || 'other'} — meaning: ${word.vietnamese || ''}${wordDescription}).${topicContext}

Score each criterion from 0 to 10:
- "grammarScore": Is the grammar correct?
- "usageScore": Is the vocabulary word used correctly and appropriately?
- "naturalnessScore": Does the sentence sound natural to a native speaker?
- "overallScore": Average of the three scores, rounded to nearest integer.

Also provide:
- "correctedSentence": The user's sentence with ALL errors fixed. Keep as close to the user's original wording as possible — only fix what is wrong. If the sentence is already perfect, return it unchanged.
- "grammarErrors": An array of specific errors found. Each entry has:
  - "original": The exact wrong phrase from the user's sentence.
  - "corrected": The corrected version of that phrase.
  - "vietnameseOriginal": The Vietnamese meaning of the original (wrong) phrase — what the user actually said in English.
  - "vietnameseCorrected": The Vietnamese meaning of the corrected phrase — what the user intended to say.
  - "explanation": A clear explanation in Vietnamese of why it is wrong and the grammar rule involved.
  - "type": Error category — one of "grammar", "word_choice", "spelling", "punctuation", "word_order".
  If there are no errors, return an empty array.
- "wordChoiceSuggestions": An array of word choice suggestions. For any word/phrase the user used that does not fit the intended Vietnamese meaning well, suggest a better alternative. Each entry has:
  - "userWord": The English word/phrase the user used.
  - "suggestedWord": A more precise/natural English word/phrase.
  - "reason": Brief reason in Vietnamese why the suggested word is better.
  If all word choices are fine, return an empty array.
- "feedback": A brief overall feedback message in Vietnamese (2-3 sentences).
- "tips": An array of 1-3 short improvement tips in Vietnamese.
${encourageContext}
IMPORTANT:
- Return ONLY valid JSON, no markdown code blocks, no extra text.
- All feedback, tips and explanations must be in Vietnamese for the learner.`;

  const userPrompt = `Vocabulary word: "${word.english}"
User's sentence: "${sentence}"

Return JSON:
{
  "grammarScore": 0,
  "usageScore": 0,
  "naturalnessScore": 0,
  "overallScore": 0,
  "correctedSentence": "...",
  "grammarErrors": [
    {
      "original": "...",
      "corrected": "...",
      "vietnameseOriginal": "...",
      "vietnameseCorrected": "...",
      "explanation": "...",
      "type": "grammar"
    }
  ],
  "wordChoiceSuggestions": [
    {
      "userWord": "...",
      "suggestedWord": "...",
      "reason": "..."
    }
  ],
  "feedback": "...",
  "tips": ["..."]
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
    usageScore: Number(parsed.usageScore) || 0,
    naturalnessScore: Number(parsed.naturalnessScore) || 0,
    overallScore: Number(parsed.overallScore) || 0,
    correctedSentence: parsed.correctedSentence || sentence,
    grammarErrors: Array.isArray(parsed.grammarErrors) ? parsed.grammarErrors : [],
    wordChoiceSuggestions: Array.isArray(parsed.wordChoiceSuggestions) ? parsed.wordChoiceSuggestions : [],
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
 * @param {Array<{ english: string, vietnamese: string, wordType: string, description?: string }>} words  Target words
 * @param {string} paragraph  The user's paragraph
 * @param {string} [topicName]
 * @param {Array<{ english: string, vietnamese: string, wordType: string }>} [allTopicWords]  All words in the topic
 * @returns {Promise<Object>}
 */
export async function evaluateParagraph(words, paragraph, topicName = '', allTopicWords = []) {
  const wordList = words.map(w => {
    const parts = [`"${w.english}" (${w.wordType || 'other'})`];
    if (w.vietnamese) parts.push(`— ${w.vietnamese}`);
    if (w.description) parts.push(`[${w.description}]`);
    return parts.join(' ');
  }).join('\n  • ');

  const topicContext = topicName
    ? `\nThis paragraph is for the topic "${topicName}".`
    : '';

  const targetSet = new Set(words.map(w => w.english.toLowerCase()));
  const otherWords = allTopicWords
    .filter(w => !targetSet.has(w.english.toLowerCase()))
    .slice(0, 10)
    .map(w => `${w.english} (${w.wordType || 'other'}) — ${w.vietnamese || ''}`)
    .join(', ');

  const encourageContext = otherWords
    ? `\n\nOther vocabulary words in the same topic (NOT required targets): ${otherWords}
If the user naturally used any of these words in their paragraph, acknowledge it positively in your feedback.
In your suggestions, you may gently suggest incorporating other topic words if it would fit the context naturally — but NEVER penalize the score for not using them. This is encouragement only, not a requirement.`
    : '';

  const systemPrompt = `You are an English writing tutor for Vietnamese learners.
Evaluate the user's English paragraph that should incorporate the target vocabulary words listed below.${topicContext}

Target vocabulary words:
  • ${wordList}

Score each criterion from 0 to 10:
- "grammarScore": Is the grammar correct throughout?
- "coherenceScore": Is the paragraph coherent and well-structured?
- "naturalnessScore": Does the writing sound natural?
- "overallScore": Weighted average, rounded to nearest integer.

Also provide:
- "wordResults": An array with one entry per target word: { "word": string, "used": boolean, "usedCorrectly": boolean }
  Use the Vietnamese meanings and descriptions to judge whether each word was used with the correct meaning.
- "correctedParagraph": The user's paragraph with ALL errors fixed. Keep as close to the user's original wording as possible — only fix what is wrong.
- "grammarErrors": An array of specific errors found. Each entry has:
  - "original": The exact wrong phrase from the user's paragraph.
  - "corrected": The corrected version of that phrase.
  - "vietnameseOriginal": The Vietnamese meaning of the original (wrong) phrase — what the user actually said in English.
  - "vietnameseCorrected": The Vietnamese meaning of the corrected phrase — what the user intended to say.
  - "explanation": A clear explanation in Vietnamese of why it is wrong and the grammar rule involved.
  - "type": Error category — one of "grammar", "word_choice", "spelling", "punctuation", "word_order".
  If there are no errors, return an empty array.
- "wordChoiceSuggestions": An array of word choice suggestions. For any word/phrase the user used that does not fit the intended Vietnamese meaning well, suggest a better alternative. Each entry has:
  - "userWord": The English word/phrase the user used.
  - "suggestedWord": A more precise/natural English word/phrase.
  - "reason": Brief reason in Vietnamese why the suggested word is better.
  If all word choices are fine, return an empty array.
- "feedback": Brief overall feedback in Vietnamese (2-3 sentences).
- "suggestions": Array of 1-3 specific improvement suggestions in Vietnamese.
${encourageContext}
IMPORTANT:
- Return ONLY valid JSON, no markdown code blocks, no extra text.
- All feedback, suggestions and explanations must be in Vietnamese.`;

  const userPrompt = `Target words:
  • ${wordList}

User's paragraph: "${paragraph}"

Return JSON:
{
  "grammarScore": 0,
  "coherenceScore": 0,
  "naturalnessScore": 0,
  "overallScore": 0,
  "wordResults": [],
  "correctedParagraph": "...",
  "grammarErrors": [
    {
      "original": "...",
      "corrected": "...",
      "vietnameseOriginal": "...",
      "vietnameseCorrected": "...",
      "explanation": "...",
      "type": "grammar"
    }
  ],
  "wordChoiceSuggestions": [
    {
      "userWord": "...",
      "suggestedWord": "...",
      "reason": "..."
    }
  ],
  "feedback": "...",
  "suggestions": []
}`;

  const parsed = await callAzureOpenAI(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    { temperature: 0.7, maxTokens: 1800 },
  );

  return {
    grammarScore: Number(parsed.grammarScore) || 0,
    coherenceScore: Number(parsed.coherenceScore) || 0,
    naturalnessScore: Number(parsed.naturalnessScore) || 0,
    overallScore: Number(parsed.overallScore) || 0,
    wordResults: Array.isArray(parsed.wordResults) ? parsed.wordResults : [],
    correctedParagraph: parsed.correctedParagraph || paragraph,
    grammarErrors: Array.isArray(parsed.grammarErrors) ? parsed.grammarErrors : [],
    wordChoiceSuggestions: Array.isArray(parsed.wordChoiceSuggestions) ? parsed.wordChoiceSuggestions : [],
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
 * @param {Array<{ english: string, vietnamese: string, wordType?: string, description?: string }>} words
 * @param {string} [topicName]
 * @returns {Promise<{ vietnameseText: string, referenceEnglish: string, usedWords: string[] }>}
 */
export async function generateTranslationChallenge(words, topicName = '') {
  const wordList = words.map(w => {
    const parts = [`"${w.english}" (${w.wordType || 'other'})`];
    if (w.vietnamese) parts.push(`— ${w.vietnamese}`);
    if (w.description) parts.push(`[${w.description}]`);
    return parts.join(' ');
  }).join('\n  • ');

  const topicContext = topicName
    ? `\nThese words belong to the topic "${topicName}". If this topic represents a clear subject area, create a scenario related to it.`
    : '';

  const systemPrompt = `You are an English-Vietnamese language tutor.
Generate a short Vietnamese paragraph (2-4 sentences) that a student would translate to English.
The paragraph should be designed so that the student needs to use the provided English vocabulary words in their translation.${topicContext}

The Vietnamese text should:
- Be natural and grammatically correct Vietnamese.
- Be clearly translatable using the target vocabulary words with their correct meanings (refer to the Vietnamese translations and descriptions provided).
- Use simple supporting vocabulary so the focus is on the target words.

Also provide a reference English translation.

IMPORTANT:
- Return ONLY valid JSON, no markdown code blocks, no extra text.`;

  const userPrompt = `Target English vocabulary:
  • ${wordList}

Use the Vietnamese meanings and descriptions to understand each word's intended meaning when creating the translation challenge.

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
 * @param {string} [topicName]
 * @param {Array<{ english: string, vietnamese: string, wordType: string }>} [topicWords]  All words in the topic
 * @returns {Promise<Object>}
 */
export async function evaluateTranslation(vietnameseText, userTranslation, referenceTranslation, topicName = '', topicWords = []) {
  const topicContext = topicName
    ? `\nThis translation exercise is for the topic "${topicName}".`
    : '';

  const topicWordList = topicWords.length > 0
    ? topicWords.slice(0, 15).map(w => `${w.english} (${w.wordType || 'other'}) — ${w.vietnamese || ''}`).join(', ')
    : '';

  const encourageContext = topicWordList
    ? `\n\nVocabulary words in the learner's topic: ${topicWordList}
If the user naturally used any of these topic words in their translation, acknowledge it positively in your feedback.
In your feedback, you may gently suggest using specific topic vocabulary where it fits the translation naturally — but NEVER penalize the score for not using them. This is encouragement only.`
    : '';

  const systemPrompt = `You are an English-Vietnamese translation evaluator.
Compare the user's English translation against the reference translation of a Vietnamese text.${topicContext}

Score each criterion from 0 to 10:
- "accuracyScore": How accurately does the translation convey the original meaning?
- "grammarScore": Is the English grammar correct?
- "overallScore": Weighted average, rounded to nearest integer.

Also provide:
- "correctedTranslation": The user's translation with ALL errors fixed (grammar, word choice, spelling). Keep as close to the user's original wording as possible — only fix what is wrong.
- "grammarErrors": An array of specific errors found. Each entry has:
  - "original": The exact wrong phrase/sentence from the user's translation.
  - "corrected": The corrected version of that phrase/sentence.
  - "vietnameseOriginal": The Vietnamese meaning of the original (wrong) phrase — what the user actually said in English.
  - "vietnameseCorrected": The Vietnamese meaning of the corrected phrase — what the user intended to say.
  - "explanation": A clear explanation in Vietnamese of why it is wrong and the grammar rule involved.
  - "type": Error category — one of "grammar", "word_choice", "spelling", "punctuation", "word_order".
  If there are no errors, return an empty array.
- "wordChoiceSuggestions": An array of word choice suggestions. For any English word/phrase the user used that does not accurately convey the Vietnamese meaning, suggest a better alternative. Each entry has:
  - "userWord": The English word/phrase the user used.
  - "suggestedWord": A more precise/natural English word/phrase.
  - "reason": Brief reason in Vietnamese why the suggested word better conveys the Vietnamese meaning.
  If all word choices are fine, return an empty array.
- "feedback": Brief overall evaluation in Vietnamese (2-3 sentences).
- "suggestedTranslation": Your best suggested English translation (may differ from correctedTranslation — this is an ideal/natural version).
${encourageContext}
IMPORTANT:
- The user's translation does NOT need to be identical to the reference — accept valid alternatives.
- "correctedTranslation" must be based on the user's original text with minimal changes.
- "grammarErrors" should list ALL errors, not just grammar — include word choice, spelling, etc.
- For "wordChoiceSuggestions", focus on words that don't accurately match the Vietnamese source text meaning.
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
      "vietnameseOriginal": "...",
      "vietnameseCorrected": "...",
      "explanation": "...",
      "type": "grammar"
    }
  ],
  "wordChoiceSuggestions": [
    {
      "userWord": "...",
      "suggestedWord": "...",
      "reason": "..."
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
    wordChoiceSuggestions: Array.isArray(parsed.wordChoiceSuggestions) ? parsed.wordChoiceSuggestions : [],
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
 * @param {Array<{ english: string, vietnamese: string, wordType?: string, description?: string }>} words
 * @param {string} [topicName]
 * @returns {Promise<{ sentence: string, usedWords: string[] }>}
 */
export async function generateDictationSentence(words, topicName = '') {
  const wordList = words.map(w => {
    const parts = [`"${w.english}" (${w.wordType || 'other'})`];
    if (w.vietnamese) parts.push(`— ${w.vietnamese}`);
    if (w.description) parts.push(`[${w.description}]`);
    return parts.join(' ');
  }).join('\n  • ');

  const topicContext = topicName
    ? `\nThese words belong to the topic "${topicName}". If this topic represents a clear subject area, use a context related to it.`
    : '';

  const systemPrompt = `You are an English language tutor.
Generate ONE clear, natural English sentence (10-20 words) that uses 1-2 of the provided vocabulary words.${topicContext}

Rules:
- The sentence should be clear when spoken aloud (good for dictation practice).
- Use the words with their correct meanings (refer to the Vietnamese translations and descriptions provided).
- Use simple supporting vocabulary (A1-A2 level) so the focus is on the target words.
- Do NOT use complex punctuation — keep it simple with commas and periods only.
- The sentence should tell something meaningful (not just list words).

IMPORTANT:
- Return ONLY valid JSON, no markdown code blocks, no extra text.`;

  const userPrompt = `Vocabulary words:
  • ${wordList}

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

// ----------------------------------------------------------------
// Listen and Fill — generate a passage with strategic blanks
// ----------------------------------------------------------------

/**
 * Generate an English passage at the requested CEFR level with words
 * removed for the user to fill in while listening.
 *
 * @param {Object} opts
 * @param {string} opts.level   CEFR level: A1, A2, B1, B2, C1, C2
 * @param {string} [opts.topic] Topic name/description, or empty for random
 * @param {string} [opts.length]  'short' (≈60w) | 'medium' (≈110w) | 'long' (≈180w)
 * @returns {Promise<{
 *   title: string,
 *   topic: string,
 *   level: string,
 *   sentences: Array<{ text: string, blanks: string[] }>
 * }>}
 *
 * Each sentence's `text` contains `{0}`, `{1}` placeholders that map
 * positionally to the `blanks` array for that sentence.
 */
export async function generateListenAndFillPassage({ level = 'A2', topic = '', length = 'medium' } = {}) {
  const wordCount = length === 'short' ? '50-70' : length === 'long' ? '160-200' : '100-130';
  const blankRange = length === 'short' ? '5-8' : length === 'long' ? '12-18' : '8-12';

  const topicLine = topic.trim()
    ? `The topic is: "${topic.trim()}". Build the scenario around this topic.`
    : `Choose any engaging, everyday topic appropriate for the learner level. Pick something concrete (e.g. a daily routine, a short story, a description of a place, a hobby, a small adventure).`;

  const levelGuide = {
    A1: 'A1 — very simple vocabulary, short sentences, present tense, basic everyday topics. Blanks should target very common words (objects, verbs, places).',
    A2: 'A2 — simple vocabulary, mostly present and simple past, familiar everyday topics. Blanks target common nouns, verbs, adjectives.',
    B1: 'B1 — intermediate vocabulary, mixed tenses, slightly more nuanced topics. Blanks target useful intermediate words and a few collocations.',
    B2: 'B2 — upper-intermediate vocabulary, varied tenses, abstract ideas welcomed. Blanks target less common content words, phrasal verbs, and collocations.',
    C1: 'C1 — advanced vocabulary, idiomatic expressions, complex sentence structures. Blanks target advanced content words, collocations, and idiomatic phrases.',
    C2: 'C2 — proficient/native-like vocabulary, sophisticated phrasing. Blanks target nuanced word choices, idiomatic expressions, and precise terminology.',
  }[level] || 'A2 — simple vocabulary.';

  const systemPrompt = `You are an English listening-comprehension content creator.
Generate an English passage (${wordCount} words) for a dictation "Listen and Fill" exercise at CEFR level ${level}.

LEVEL GUIDANCE: ${levelGuide}

TOPIC: ${topicLine}

The passage should:
- Tell a coherent mini-story or describe a clear situation.
- Use natural, spoken-friendly language that reads aloud well.
- Use clear punctuation — periods and commas only, no semicolons/colons/em-dashes.
- Split into ${length === 'long' ? '8-12' : length === 'short' ? '4-6' : '6-9'} sentences.

BLANKING RULES:
- Insert ${blankRange} blanks total across the whole passage, distributed across sentences.
- Each blank must be a SINGLE word (no multi-word blanks).
- Choose words that are PRONOUNCEABLE and clearly hearable — never blank out tiny function words like "a", "the", "of", "is", "to" unless they are stressed/critical.
- For ${level}: blanks should target content words appropriate to the level (see level guidance).
- Each sentence may have 0, 1, or 2 blanks — vary the density naturally.
- The first sentence should have no blank OR an easy blank, to anchor the user.

OUTPUT FORMAT (CRITICAL):
- "sentences" is an array; each entry has:
  - "text": the sentence with blanks replaced by positional placeholders "{0}", "{1}", "{2}" (zero-indexed within that sentence).
  - "blanks": array of the actual answer words for {0}, {1}, ... in order.
- The placeholder "{i}" in text MUST appear exactly once per blank and match the index in "blanks".
- "title" is a short 2-6 word title for the passage.

IMPORTANT:
- Return ONLY valid JSON, no markdown, no extra text.
- All text MUST be English only.`;

  const userPrompt = `Return JSON:
{
  "title": "...",
  "topic": "...",
  "level": "${level}",
  "sentences": [
    { "text": "I {0} the bus to school every {1}.", "blanks": ["take", "morning"] },
    { "text": "It usually arrives on time.", "blanks": [] }
  ]
}`;

  const parsed = await callAzureOpenAI(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    { temperature: 0.85, maxTokens: 1400 },
  );

  const sentences = Array.isArray(parsed.sentences) ? parsed.sentences : [];

  // Sanitize: ensure each sentence has text + blanks array, and that
  // the number of {i} placeholders matches blanks.length.
  const safeSentences = sentences
    .map(s => {
      const text = typeof s.text === 'string' ? s.text : '';
      const blanks = Array.isArray(s.blanks) ? s.blanks.map(b => String(b ?? '').trim()) : [];
      const placeholders = (text.match(/\{\d+\}/g) || []).length;
      if (placeholders !== blanks.length) return null;
      return { text, blanks };
    })
    .filter(Boolean);

  return {
    title: parsed.title || 'Listen and Fill',
    topic: parsed.topic || topic || '',
    level: parsed.level || level,
    sentences: safeSentences,
  };
}
