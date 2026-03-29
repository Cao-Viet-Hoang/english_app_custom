/* ============================================================
   CHAT WIDGET — Orchestrator
   Builds DOM, wires events, exports initChatWidget
   ============================================================ */

import { state, dom } from './chat-state.js';
import { escapeHtml } from '../ui/index.js';
import { renderSuggestions } from './chat-renderer.js';
import { autoResizeInput, updateSendBtn, handleSend, clearConversation } from './chat-input.js';

// ----------------------------------------------------------------
// DOM builder
// ----------------------------------------------------------------

function buildWidget() {
  // Floating bubble
  dom.bubble = document.createElement('button');
  dom.bubble.className = 'chat-bubble-btn';
  dom.bubble.setAttribute('aria-label', 'Open AI assistant');
  dom.bubble.innerHTML = `
    <span class="chat-unread-badge" aria-hidden="true"></span>
    <svg class="icon-chat" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
         fill="none" stroke="currentColor" stroke-width="2"
         stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
    <svg class="icon-close" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
         fill="none" stroke="currentColor" stroke-width="2.5"
         stroke-linecap="round" stroke-linejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  `;

  // Chat panel
  dom.panel = document.createElement('div');
  dom.panel.className = 'chat-panel';
  dom.panel.setAttribute('role', 'dialog');
  dom.panel.setAttribute('aria-label', 'WordCraft AI Assistant');
  dom.panel.innerHTML = `
    <div class="chat-panel-header">
      <div class="chat-panel-header-icon">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      </div>
      <div class="chat-panel-header-info">
        <div class="chat-panel-header-title">WordCraft AI Assistant</div>
        <div class="chat-panel-header-sub" id="chat-header-sub">Ask anything about English</div>
      </div>
      <div class="chat-panel-header-actions">
        <button class="chat-header-btn" id="chat-clear-btn" title="Clear conversation">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14H6L5 6"/>
            <path d="M10 11v6"/><path d="M14 11v6"/>
            <path d="M9 6V4h6v2"/>
          </svg>
        </button>
      </div>
    </div>

    <div class="chat-context-bar hidden" id="chat-context-bar"></div>

    <div class="chat-messages" id="chat-messages">
      <div class="chat-welcome" id="chat-welcome">
        <div class="chat-welcome-icon">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </div>
        <h4>Hi! I'm your AI assistant</h4>
        <p>Ask me anything about vocabulary, grammar,<br>or how to use English words.</p>
      </div>
    </div>

    <div class="chat-suggestions hidden" id="chat-suggestions"></div>

    <div class="chat-input-area">
      <textarea
        class="chat-input"
        id="chat-input"
        placeholder="Ask about vocabulary, grammar..."
        rows="1"
        autocomplete="off"
        spellcheck="false"
      ></textarea>
      <button class="chat-send-btn" id="chat-send-btn" disabled aria-label="Send">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="22" y1="2" x2="11" y2="13"/>
          <polygon points="22 2 15 22 11 13 2 9 22 2"/>
        </svg>
      </button>
    </div>
  `;

  document.body.appendChild(dom.bubble);
  document.body.appendChild(dom.panel);

  // Cache DOM refs
  dom.messagesEl    = dom.panel.querySelector('#chat-messages');
  dom.inputEl       = dom.panel.querySelector('#chat-input');
  dom.sendBtn       = dom.panel.querySelector('#chat-send-btn');
  dom.suggestionsEl = dom.panel.querySelector('#chat-suggestions');
  dom.contextBarEl  = dom.panel.querySelector('#chat-context-bar');
  dom.badgeEl       = dom.bubble.querySelector('.chat-unread-badge');
}

// ----------------------------------------------------------------
// Panel open / close
// ----------------------------------------------------------------

function openPanel() {
  state.isOpen = true;
  dom.bubble.classList.add('panel-open');
  dom.panel.classList.add('open');
  state.unreadCount = 0;
  dom.badgeEl.textContent = '';
  dom.badgeEl.classList.remove('visible');
  refreshContext();
  renderSuggestions();
  setTimeout(() => dom.inputEl.focus(), 250);
}

function closePanel() {
  state.isOpen = false;
  dom.bubble.classList.remove('panel-open');
  dom.panel.classList.remove('open');
}

function togglePanel() {
  state.isOpen ? closePanel() : openPanel();
}

// ----------------------------------------------------------------
// Context bar
// ----------------------------------------------------------------

function refreshContext() {
  const ctx = state.getContext();
  const sub = document.getElementById('chat-header-sub');

  if (ctx.word) {
    dom.contextBarEl.classList.remove('hidden');
    dom.contextBarEl.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24"
           fill="none" stroke="currentColor" stroke-width="2"
           stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      Context:
      <span class="chat-context-chip">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
        </svg>
        ${escapeHtml(ctx.word)}
      </span>
      ${ctx.topic ? `in topic <strong>${escapeHtml(ctx.topic)}</strong>` : ''}
    `;
    if (sub) sub.textContent = `Ask about "${ctx.word}" or any word`;
  } else {
    dom.contextBarEl.classList.add('hidden');
    if (sub) sub.textContent = 'Ask anything about English';
  }
}

// ----------------------------------------------------------------
// Event wiring
// ----------------------------------------------------------------

function wireEvents() {
  // Bubble toggle
  dom.bubble.addEventListener('click', togglePanel);

  // Send button
  dom.sendBtn.addEventListener('click', handleSend);

  // Input: auto-resize + enable send btn
  dom.inputEl.addEventListener('input', () => {
    autoResizeInput();
    updateSendBtn();
  });

  // Enter to send (Shift+Enter = newline)
  dom.inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  // Clear button
  dom.panel.querySelector('#chat-clear-btn').addEventListener('click', clearConversation);

  // Suggestion chip clicks (event delegation)
  dom.suggestionsEl.addEventListener('click', (e) => {
    const chip = e.target.closest('.chat-suggestion-chip');
    if (!chip) return;
    dom.inputEl.value = chip.textContent;
    autoResizeInput();
    updateSendBtn();
    handleSend();
  });

  // Escape key closes panel
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.isOpen) closePanel();
  });
}

// ----------------------------------------------------------------
// Public init
// ----------------------------------------------------------------

/**
 * Initialise the chat widget and inject it into the page.
 *
 * @param {() => { word?: string, wordType?: string, vietnamese?: string, topic?: string, page?: string, words?: Array }} getContextFn
 */
export function initChatWidget(getContextFn) {
  if (typeof getContextFn === 'function') {
    state.getContext = getContextFn;
  }

  // Guard against double init
  if (state.initialized) return;
  state.initialized = true;

  buildWidget();
  wireEvents();
}

/**
 * Open the chat panel and pre-fill the input with a message.
 * Does NOT auto-send — waits for user to press Enter / Send.
 *
 * @param {string} message  Text to place in the chat input
 */
export function sendToChat(message) {
  if (!state.initialized) return;

  // Open panel if closed
  if (!state.isOpen) {
    openPanel();
  }

  // Pre-fill input
  dom.inputEl.value = message;
  autoResizeInput();
  updateSendBtn();
  dom.inputEl.focus();

  // Scroll input into view
  dom.inputEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
