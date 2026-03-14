/* ============================================================
   READING AI MODULE
   Azure OpenAI integration for reading practice —
   passage generation with comprehension questions.
   ============================================================ */

import { getSession } from './router.js';

/**
 * Private helper — call Azure OpenAI Chat Completions.
 * @param {Array} messages  Chat messages array
 * @param {Object} options  { temperature, maxTokens }
 * @returns {Promise<Object>}  Parsed JSON response
 */
async function callAzureOpenAI(messages, { temperature = 0.8, maxTokens = 2500 } = {}) {
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
// Reading Passage + Questions (single API call)
// ----------------------------------------------------------------

/**
 * Generate a reading passage using vocabulary words, plus
 * comprehension questions (MCQ or True/False).
 *
 * @param {Array<{ english: string, vietnamese: string, wordType: string }>} words
 * @param {'mcq'|'truefalse'} questionType
 * @returns {Promise<{
 *   passage: string,
 *   highlightWords: string[],
 *   questions: Array
 * }>}
 */
export async function generateReadingPassage(words, questionType) {
  const wordList = words.map(w => `"${w.english}" (${w.wordType || 'other'})`).join(', ');

  const questionInstructions = questionType === 'mcq'
    ? `Generate 3-5 multiple choice questions about the passage.
Each question must have exactly 4 options and one correct answer.
Format each question as: { "question": "...", "options": ["A", "B", "C", "D"], "correctIndex": 0, "explanation": "..." }
- "correctIndex" is the 0-based index of the correct option.
- "explanation" should be in Vietnamese, briefly explaining why the answer is correct.`
    : `Generate 4-6 true/false statements about the passage.
Each statement should be clearly true or false based on the passage content.
Format each statement as: { "statement": "...", "isTrue": true/false, "explanation": "..." }
- "explanation" should be in Vietnamese, briefly explaining why the statement is true or false.`;

  const systemPrompt = `You are an English reading comprehension tutor for Vietnamese learners.
Generate a reading passage (200-300 words) that naturally uses these vocabulary words: ${wordList}.

The passage should:
- Tell a coherent story or describe a situation.
- Use ALL of the provided vocabulary words.
- Keep non-target vocabulary at A1-A2 level so learners focus on the target words.
- Be engaging and educational.
- Use clear paragraph structure (2-4 paragraphs).

Then generate comprehension questions.

${questionInstructions}

IMPORTANT:
- Return ONLY valid JSON, no markdown code blocks, no extra text.
- The "highlightWords" array should list the exact vocabulary words as they appear in the passage.`;

  const userPrompt = `Vocabulary words: ${wordList}
Question type: ${questionType}

Return JSON:
{
  "passage": "...",
  "highlightWords": ["word1", "word2"],
  "questions": [...]
}`;

  const parsed = await callAzureOpenAI(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    { temperature: 0.8, maxTokens: 2500 },
  );

  return {
    passage: parsed.passage || '',
    highlightWords: Array.isArray(parsed.highlightWords) ? parsed.highlightWords : [],
    questions: Array.isArray(parsed.questions) ? parsed.questions : [],
  };
}
