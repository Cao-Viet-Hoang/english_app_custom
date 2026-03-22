/* ============================================================
   AI CLIENT
   Shared Azure OpenAI HTTP client — single source of truth for
   all API calls (non-streaming JSON and streaming SSE).
   ============================================================ */

import { getSession } from './router.js';

// ----------------------------------------------------------------
// Config helper
// ----------------------------------------------------------------

/**
 * Extract and validate Azure OpenAI config from the current session.
 * @returns {{ endpoint: string, apiKey: string, deploymentName: string, apiVersion: string }}
 */
export function getAzureConfig() {
  const session = getSession();
  if (!session?.azureOpenAI) {
    throw new Error('Azure OpenAI config not found. Please log in again.');
  }

  const { endpoint, apiKey, deploymentName, apiVersion } = session.azureOpenAI;
  const baseUrl = endpoint.replace(/\/+$/, '');
  const version = apiVersion || '2024-08-01-preview';

  return { baseUrl, apiKey, deploymentName, version };
}

/**
 * Build the full Azure OpenAI Chat Completions URL.
 */
function buildUrl({ baseUrl, deploymentName, version }) {
  return `${baseUrl}/openai/deployments/${deploymentName}/chat/completions?api-version=${version}`;
}

// ----------------------------------------------------------------
// Non-streaming call (returns parsed JSON)
// ----------------------------------------------------------------

/**
 * Call Azure OpenAI Chat Completions and return parsed JSON.
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
export async function callAzureOpenAI(messages, { temperature = 0.7, maxTokens = 800 } = {}) {
  const config = getAzureConfig();
  const url = buildUrl(config);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': config.apiKey,
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
 * Call Azure OpenAI Chat Completions with streaming enabled.
 * Calls onChunk(delta) for each text piece as it arrives.
 *
 * @param {Array<{role: string, content: string}>} messages
 * @param {Object} [options]
 * @param {number} [options.temperature=0.7]
 * @param {number} [options.maxTokens=800]
 * @param {Function} [options.onChunk] Called with each text delta string
 * @returns {Promise<string>} Full accumulated reply
 */
export async function streamAzureOpenAI(messages, { temperature = 0.7, maxTokens = 800, onChunk = () => {} } = {}) {
  const config = getAzureConfig();
  const url = buildUrl(config);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': config.apiKey,
    },
    body: JSON.stringify({
      messages,
      temperature,
      max_completion_tokens: maxTokens,
      stream: true,
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    console.error('Azure OpenAI streaming error:', response.status, errBody);
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
