/* ============================================================
   CHAT INPUT
   Send flow, auto-resize, clear conversation
   ============================================================ */

import { state, dom, nowTime } from './chat-state.js';
import { sendChatMessageStream, clearChatCache } from '../ai/chat-ai.js';
import { escapeHtml } from '../ui/index.js';
import {
  appendMessage,
  showTyping,
  hideTyping,
  scrollToBottom,
  renderMarkdown,
  bumpUnread,
  hideSuggestions,
  renderSuggestions,
} from './chat-renderer.js';

// ----------------------------------------------------------------
// Input helpers
// ----------------------------------------------------------------

export function autoResizeInput() {
  dom.inputEl.style.height = 'auto';
  const sh = dom.inputEl.scrollHeight;
  dom.inputEl.style.height = Math.min(sh, 100) + 'px';
  dom.inputEl.style.overflowY = sh > 100 ? 'auto' : 'hidden';
}

export function updateSendBtn() {
  const hasText = dom.inputEl.value.trim().length > 0;
  dom.sendBtn.disabled = !hasText || state.isBusy;
}

// ----------------------------------------------------------------
// Send flow
// ----------------------------------------------------------------

export async function handleSend() {
  const text = dom.inputEl.value.trim();
  if (!text || state.isBusy) return;

  state.isBusy = true;
  updateSendBtn();
  hideSuggestions();

  appendMessage('user', text);

  const historySnapshot = [...state.history];
  state.history.push({ role: 'user', content: text });

  dom.inputEl.value = '';
  autoResizeInput();

  showTyping();

  // Capture generation so streaming callbacks can detect if conversation was cleared
  const gen = state.generation;

  // Stream target — created on first chunk
  let streamBubble = null;
  let accumulated  = '';

  function initStreamBubble() {
    hideTyping();
    const msgEl = document.createElement('div');
    msgEl.className = 'chat-msg chat-msg--ai';
    streamBubble = document.createElement('div');
    streamBubble.className = 'chat-msg-bubble';
    const timeEl = document.createElement('div');
    timeEl.className = 'chat-msg-time';
    timeEl.textContent = nowTime();
    msgEl.appendChild(streamBubble);
    msgEl.appendChild(timeEl);
    dom.messagesEl.appendChild(msgEl);
  }

  try {
    const context = state.getContext();
    const fullReply = await sendChatMessageStream(
      historySnapshot,
      text,
      context,
      (delta) => {
        if (gen !== state.generation) return; // conversation was cleared mid-stream
        if (!streamBubble) initStreamBubble();
        accumulated += delta;
        streamBubble.textContent = accumulated;
        scrollToBottom();
      },
    );

    // If cleared mid-stream, discard result silently
    if (gen !== state.generation) return;

    // Apply markdown once streaming is complete
    if (streamBubble) {
      streamBubble.innerHTML = renderMarkdown(fullReply);
      scrollToBottom();
    }

    state.history.push({ role: 'assistant', content: fullReply });
    bumpUnread();

  } catch (err) {
    if (gen !== state.generation) return; // cleared mid-stream, ignore error
    hideTyping();
    if (streamBubble) {
      streamBubble.innerHTML = renderMarkdown(accumulated) +
        `<p style="color:var(--color-danger);font-size:var(--fs-xs);margin-top:var(--sp-2)">${escapeHtml(err.message)}</p>`;
    } else {
      appendMessage('error', err.message || 'An unknown error occurred. Please try again.');
    }
    state.history.pop();
  } finally {
    state.isBusy = false;
    updateSendBtn();
  }
}

// ----------------------------------------------------------------
// Clear conversation
// ----------------------------------------------------------------

export function clearConversation() {
  state.generation++;  // invalidate any in-flight streaming callbacks
  state.history = [];
  dom.messagesEl.innerHTML = `
    <div class="chat-welcome" id="chat-welcome">
      <div class="chat-welcome-icon">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      </div>
      <h4>Conversation cleared</h4>
      <p>Ask me anything about vocabulary, grammar,<br>or how to use English words.</p>
    </div>
  `;
  clearChatCache();
  renderSuggestions();
}
