/* ============================================================
   AI CLIENT
   Shared LiteLLM HTTP client (OpenAI-compatible Chat Completions) —
   single source of truth for all API calls (non-streaming JSON and
   streaming SSE).
   ============================================================ */

import { getSession } from './router.js';

export const DEFAULT_AI_MODEL = 'claude-haiku-5-5';

// ----------------------------------------------------------------
// Config helper
// ----------------------------------------------------------------

/**
 * Extract and validate LiteLLM config from the current session.
 * @returns {{ url: string, apiKey: string, model: string }}
 */
export function getAIConfig() {
  const session = getSession();
  if (!session?.litellm) {
    throw new Error('LiteLLM config not found. Please log in again.');
  }

  const { endpoint, apiKey, model } = session.litellm;
  const base = String(endpoint).trim().replace(/\/+$/, '');
  const url = base.endsWith('/chat/completions') ? base : `${base}/chat/completions`;

  return { url, apiKey, model: model || DEFAULT_AI_MODEL };
}

// `temperature` is accepted by callers but intentionally not sent: the default
// model (claude-haiku-5-5) only supports temperature=1 and LiteLLM rejects
// any other value with a 400, so we let the server use its default.
function buildBody({ config, messages, maxTokens, extra = {} }) {
  return { model: config.model, messages, max_tokens: maxTokens, ...extra };
}

function buildHeaders(config) {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${config.apiKey}`,
  };
}

// ----------------------------------------------------------------
// Non-streaming call (returns parsed JSON)
// ----------------------------------------------------------------

/**
 * Call LiteLLM Chat Completions and return parsed JSON.
 *
 * Handles: session validation, URL construction, fetch, error handling,
 * markdown code-fence cleanup, and JSON parsing.
 *
 * @param {Array<{role: string, content: string}>} messages
 * @param {Object} [options]
 * @param {number} [options.temperature=0.7]
 * @param {number} [options.maxTokens=800]
 * @returns {Promise<Object>} Parsed JSON response
 */
export async function callAI(messages, { temperature = 0.7, maxTokens = 800 } = {}) {
  const config = getAIConfig();

  const response = await fetch(config.url, {
    method: 'POST',
    headers: buildHeaders(config),
    body: JSON.stringify(buildBody({ config, messages, temperature, maxTokens })),
  });

  if (!response.ok) {
    const errBody = await response.text();
    console.error('LiteLLM error:', response.status, errBody);
    throw new Error(`LiteLLM request failed (${response.status}).`);
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty response from LiteLLM.');

  // Strip markdown code fences if present
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
// Streaming call (SSE → onChunk callbacks)
// ----------------------------------------------------------------

/**
 * Call LiteLLM Chat Completions with streaming enabled.
 * Calls onChunk(delta) for each text piece as it arrives.
 *
 * @param {Array<{role: string, content: string}>} messages
 * @param {Object} [options]
 * @param {number} [options.temperature=0.7]
 * @param {number} [options.maxTokens=800]
 * @param {Function} [options.onChunk] Called with each text delta string
 * @returns {Promise<string>} Full accumulated reply
 */
export async function streamAI(messages, { temperature = 0.7, maxTokens = 800, onChunk = () => {} } = {}) {
  const config = getAIConfig();

  const response = await fetch(config.url, {
    method: 'POST',
    headers: buildHeaders(config),
    body: JSON.stringify(buildBody({ config, messages, temperature, maxTokens, extra: { stream: true } })),
  });

  if (!response.ok) {
    const errBody = await response.text();
    console.error('LiteLLM streaming error:', response.status, errBody);
    throw new Error(`AI request failed (${response.status}). Please try again.`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullReply = '';
  let buffer = '';

  function processLines(lines) {
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data: ')) continue;
      const data = trimmed.slice(6);
      if (data === '[DONE]') continue;
      try {
        const parsed = JSON.parse(data);
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) {
          fullReply += delta;
          onChunk(delta);
        }
      } catch { /* ignore malformed SSE chunks */ }
    }
  }

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop(); // keep incomplete trailing line
    processLines(lines);
  }

  // Flush decoder for split multi-byte chars at stream boundary
  buffer += decoder.decode();
  if (buffer.trim()) {
    processLines(buffer.split('\n'));
  }

  if (!fullReply) throw new Error('Empty response from AI. Please try again.');
  return fullReply;
}
