/* ============================================================
   READING AI MODULE
   Azure OpenAI integration for reading practice —
   passage generation with comprehension questions.
   ============================================================ */

import { callAzureOpenAI } from '../core/ai-client.js';

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
- ALL questions and options MUST be written in English only.
- "explanation" should be in English, briefly explaining why the answer is correct.`
    : `Generate 4-6 true/false statements about the passage.
Each statement should be clearly true or false based on the passage content.
Format each statement as: { "statement": "...", "isTrue": true/false, "explanation": "..." }
- ALL statements MUST be written in English only.
- "explanation" should be in English, briefly explaining why the statement is true or false.`;

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
