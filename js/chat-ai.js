/* ============================================================
   CHAT AI MODULE
   Azure OpenAI chat completions with 2-layer cache.
   L1: in-memory Map (fast, per session)
   L2: sessionStorage (persists across page navigation)
   ============================================================ */

import { getSession } from './router.js';

// ----------------------------------------------------------------
// Cache constants
// ----------------------------------------------------------------
const CACHE_TTL_MS   = 30 * 60 * 1000; // 30 minutes
const CACHE_MAX_SIZE = 50;              // max entries (LRU eviction)
const CACHE_STORAGE_KEY = 'wordcraft_chat_cache';

// L1 — in-memory (fast lookup, lost on full page reload)
const memoryCache = new Map();

// ----------------------------------------------------------------
// Cache key
// ----------------------------------------------------------------

/**
 * Produce a lightweight string key from context + user message.
 * Not cryptographic — just needs to be stable and collision-resistant
 * enough for a chat cache.
 */
function makeCacheKey(userMessage, context) {
  const word  = (context?.word  || '').toLowerCase().trim();
  const topic = (context?.topic || '').toLowerCase().trim();
  const msg   = userMessage.toLowerCase().trim();
  return `${word}::${topic}::${msg}`;
}

// ----------------------------------------------------------------
// L2 — sessionStorage helpers
// ----------------------------------------------------------------

function readStorageCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeStorageCache(store) {
  try {
    sessionStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // sessionStorage quota — clear and retry once
    try {
      sessionStorage.removeItem(CACHE_STORAGE_KEY);
      sessionStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(store));
    } catch { /* give up silently */ }
  }
}

// ----------------------------------------------------------------
// LRU eviction — remove oldest entries when over limit
// ----------------------------------------------------------------

function evictOldest(store) {
  const entries = Object.entries(store);
  if (entries.length <= CACHE_MAX_SIZE) return store;
  entries.sort((a, b) => a[1].ts - b[1].ts); // oldest first
  const trimmed = entries.slice(entries.length - CACHE_MAX_SIZE);
  return Object.fromEntries(trimmed);
}

// ----------------------------------------------------------------
// Should this message bypass cache?
// ----------------------------------------------------------------

const BYPASS_PATTERNS = [
  /thêm ví dụ/i, /ví dụ khác/i, /cho.*ví dụ mới/i,
  /another example/i, /different example/i, /one more/i,
  /khác đi/i, /cách khác/i, /try again/i,
];

function shouldBypassCache(message) {
  return BYPASS_PATTERNS.some(p => p.test(message));
}

// ----------------------------------------------------------------
// Public cache API
// ----------------------------------------------------------------

function getCached(key) {
  const now = Date.now();

  // L1 check
  if (memoryCache.has(key)) {
    const entry = memoryCache.get(key);
    if (now - entry.ts < CACHE_TTL_MS) return entry.value;
    memoryCache.delete(key);
  }

  // L2 check
  const store = readStorageCache();
  const entry = store[key];
  if (entry && now - entry.ts < CACHE_TTL_MS) {
    // Warm L1 from L2
    memoryCache.set(key, { value: entry.value, ts: entry.ts });
    return entry.value;
  }

  return null;
}

function setCached(key, value) {
  const ts = Date.now();

  // Write L1
  memoryCache.set(key, { value, ts });
  // Trim L1 if oversized
  if (memoryCache.size > CACHE_MAX_SIZE) {
    const oldest = [...memoryCache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
    memoryCache.delete(oldest[0]);
  }

  // Write L2
  let store = readStorageCache();
  store[key] = { value, ts };
  store = evictOldest(store);
  writeStorageCache(store);
}

// ----------------------------------------------------------------
// System prompt builder
// ----------------------------------------------------------------

function buildSystemPrompt(context) {
  const { word, wordType, vietnamese, topic, page, words } = context || {};

  const contextLines = [];
  if (page)  contextLines.push(`- Current page: ${page}`);
  if (topic) contextLines.push(`- Topic: "${topic}"`);
  if (word)  contextLines.push(`- Word in focus: "${word}"${wordType ? ` (${wordType})` : ''}${vietnamese ? ` — ${vietnamese}` : ''}`);

  // Compact word list — max 30 to keep prompt size reasonable
  let wordListBlock = '';
  if (Array.isArray(words) && words.length > 0) {
    const capped = words.slice(0, 30);
    const list = capped.map(w =>
      `${w.english} (${w.wordType || '?'})${w.vietnamese ? ' — ' + w.vietnamese : ''}`
    ).join(', ');
    wordListBlock = `\nTopic vocabulary (${words.length} words): ${list}${words.length > 30 ? ', ...' : ''}\n`;
  }

  const contextBlock = contextLines.length
    ? `\nCurrent learning context:\n${contextLines.join('\n')}\n`
    : '';

  return `You are a smart English vocabulary assistant for WordCraft, an English learning app.
${contextBlock}${wordListBlock}
RESPONSE RULES:
- Always respond entirely in English.
- Be concise and direct. No filler phrases.
- Do not repeat the user's question back to them.
- If context includes a word in focus, prioritize explaining that word.
- When possible, use other words from the topic vocabulary in your example sentences so the learner sees them in context together.
- If the user asks a general question (e.g. "compare these words"), reference words from the topic vocabulary list.
- If the question is unrelated to English learning, politely decline and redirect.

FORMATTING (simple markdown only):
- **bold** for key words or emphasis.
- *italic* for example sentences.
- Bullet lists (- item) or numbered lists (1. item) for multiple items.
- DO NOT use code blocks, tables, or horizontal rules.
- Keep headings minimal (### only when truly needed).`;
}

// ----------------------------------------------------------------
// Main export: streaming chat message
// ----------------------------------------------------------------

/**
 * Send a message to Azure OpenAI and stream the response.
 * Calls onChunk(delta) for each text piece as it arrives.
 * Cache hit: calls onChunk once with the full cached text (no network request).
 * Returns the full reply string when complete.
 *
 * @param {Array<{role: 'user'|'assistant', content: string}>} history
 * @param {string}   userMessage
 * @param {Object}   context     { word, wordType, vietnamese, topic, page }
 * @param {Function} onChunk     Called with each text delta (string)
 * @returns {Promise<string>}    Full accumulated reply
 */
export async function sendChatMessageStream(history, userMessage, context = {}, onChunk = () => {}) {
  const session = getSession();
  if (!session?.azureOpenAI) {
    throw new Error('Not logged in or missing Azure OpenAI config.');
  }

  const cacheKey = makeCacheKey(userMessage, context);
  const bypass   = shouldBypassCache(userMessage);

  // Cache hit — deliver full text immediately, skip network
  if (!bypass && history.length === 0) {
    const cached = getCached(cacheKey);
    if (cached) {
      onChunk(cached);
      return cached;
    }
  }

  const { endpoint, apiKey, deploymentName, apiVersion } = session.azureOpenAI;
  const baseUrl = endpoint.replace(/\/+$/, '');
  const version = apiVersion || '2024-08-01-preview';
  const url = `${baseUrl}/openai/deployments/${deploymentName}/chat/completions?api-version=${version}`;

  // Keep only the last MAX_HISTORY_PAIRS exchanges to stay within token limits
  const MAX_HISTORY_MSGS = 20; // 10 user + 10 assistant turns
  const trimmedHistory = history.length > MAX_HISTORY_MSGS
    ? history.slice(-MAX_HISTORY_MSGS)
    : history;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: buildSystemPrompt(context) },
        ...trimmedHistory,
        { role: 'user', content: userMessage },
      ],
      temperature: 0.7,
      max_completion_tokens: 800,
      stream: true,
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    console.error('Chat AI error:', response.status, errBody);
    throw new Error(`AI request failed (${response.status}). Please try again.`);
  }

  // Read SSE stream
  const reader  = response.body.getReader();
  const decoder = new TextDecoder();
  let fullReply = '';
  let buffer    = '';

  function processLines(lines) {
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data: ')) continue;
      const data = trimmed.slice(6);
      if (data === '[DONE]') continue;
      try {
        const parsed = JSON.parse(data);
        const delta  = parsed.choices?.[0]?.delta?.content;
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
    buffer = lines.pop(); // keep any incomplete trailing line
    processLines(lines);
  }

  // Flush TextDecoder (handles split multi-byte chars at stream boundary)
  buffer += decoder.decode();

  // Process any residual data left in buffer after stream ends
  if (buffer.trim()) {
    processLines(buffer.split('\n'));
  }

  if (!fullReply) throw new Error('Empty response from AI. Please try again.');

  // Cache the complete reply for future identical requests
  if (!bypass && history.length === 0) {
    setCached(cacheKey, fullReply);
  }

  return fullReply;
}

/**
 * Clear all chat cache (both L1 and L2).
 */
export function clearChatCache() {
  memoryCache.clear();
  sessionStorage.removeItem(CACHE_STORAGE_KEY);
}
