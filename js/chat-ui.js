/* ============================================================
   CHAT UI MODULE
   Floating bubble + chat panel widget.
   Usage:
     import { initChatWidget } from './chat-ui.js';
     initChatWidget(() => ({ word, wordType, vietnamese, topic, page }));
   ============================================================ */

import { sendChatMessageStream, clearChatCache } from './chat-ai.js';
import { escapeHtml } from './ui.js';

// ----------------------------------------------------------------
// State
// ----------------------------------------------------------------

let _getContext   = () => ({});
let _history      = [];   // [{role, content}]
let _isOpen       = false;
let _isBusy       = false;
let _unreadCount  = 0;
let _generation   = 0;    // bumped on clear; lets streaming callbacks detect stale context

// DOM refs (set after render)
let _bubble, _panel, _messagesEl, _inputEl, _sendBtn,
    _typingEl, _suggestionsEl, _contextBarEl, _badgeEl;

// ----------------------------------------------------------------
// Suggestion chips — contextual
// ----------------------------------------------------------------

const GENERAL_SUGGESTIONS = [
  'What does this word mean?',
  'Give me a real example sentence',
  'What are common mistakes with this?',
];

const WORD_SUGGESTIONS = (word) => [
  `How do I use "${word}" in a sentence?`,
  `Synonyms for "${word}"`,
  `Example sentences with "${word}"`,
  `Pronunciation tips for "${word}"`,
];

function getSuggestions(context) {
  if (context?.word) return WORD_SUGGESTIONS(context.word);
  return GENERAL_SUGGESTIONS;
}

// ----------------------------------------------------------------
// Simple markdown-lite renderer for AI responses
// ----------------------------------------------------------------

function renderMarkdown(text) {
  let html = escapeHtml(text);

  // Inline code `text`
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Bold **text**
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Italic *text*
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  const lines = html.split('\n');
  let result   = '';
  let listTag  = '';  // '' | 'ul' | 'ol'

  function closeList() {
    if (listTag) { result += `</${listTag}>`; listTag = ''; }
  }

  for (const line of lines) {
    const trimmed = line.trim();

    // Bullet list
    if (/^[-•]\s+/.test(trimmed)) {
      if (listTag !== 'ul') { closeList(); result += '<ul>'; listTag = 'ul'; }
      result += `<li>${trimmed.replace(/^[-•]\s+/, '')}</li>`;
    // Numbered list
    } else if (/^\d+\.\s+/.test(trimmed)) {
      if (listTag !== 'ol') { closeList(); result += '<ol>'; listTag = 'ol'; }
      result += `<li>${trimmed.replace(/^\d+\.\s+/, '')}</li>`;
    // Header ### text
    } else if (/^#{1,4}\s+/.test(trimmed)) {
      closeList();
      const level = trimmed.match(/^(#{1,4})/)[1].length;
      const tag = `h${Math.min(level + 3, 6)}`; // ###→h4 so it stays small in chat
      result += `<${tag}>${trimmed.replace(/^#{1,4}\s+/, '')}</${tag}>`;
    // Blank line
    } else if (!trimmed) {
      closeList();
    // Regular paragraph
    } else {
      closeList();
      result += `<p>${trimmed}</p>`;
    }
  }
  closeList();

  return result;
}

// ----------------------------------------------------------------
// Time helper
// ----------------------------------------------------------------

function nowTime() {
  return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

// ----------------------------------------------------------------
// DOM builders
// ----------------------------------------------------------------

function buildWidget() {
  // Floating bubble
  _bubble = document.createElement('button');
  _bubble.className = 'chat-bubble-btn';
  _bubble.setAttribute('aria-label', 'Open AI assistant');
  _bubble.innerHTML = `
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
  _panel = document.createElement('div');
  _panel.className = 'chat-panel';
  _panel.setAttribute('role', 'dialog');
  _panel.setAttribute('aria-label', 'WordCraft AI Assistant');
  _panel.innerHTML = `
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

  document.body.appendChild(_bubble);
  document.body.appendChild(_panel);

  // Cache DOM refs
  _messagesEl    = _panel.querySelector('#chat-messages');
  _inputEl       = _panel.querySelector('#chat-input');
  _sendBtn       = _panel.querySelector('#chat-send-btn');
  _suggestionsEl = _panel.querySelector('#chat-suggestions');
  _contextBarEl  = _panel.querySelector('#chat-context-bar');
  _badgeEl       = _bubble.querySelector('.chat-unread-badge');
}

// ----------------------------------------------------------------
// Panel open / close
// ----------------------------------------------------------------

function openPanel() {
  _isOpen = true;
  _bubble.classList.add('panel-open');
  _panel.classList.add('open');
  _unreadCount = 0;
  _badgeEl.textContent = '';
  _badgeEl.classList.remove('visible');
  refreshContext();
  renderSuggestions();
  setTimeout(() => _inputEl.focus(), 250);
}

function closePanel() {
  _isOpen = false;
  _bubble.classList.remove('panel-open');
  _panel.classList.remove('open');
}

function togglePanel() {
  _isOpen ? closePanel() : openPanel();
}

// ----------------------------------------------------------------
// Context bar
// ----------------------------------------------------------------

function refreshContext() {
  const ctx = _getContext();
  const sub = document.getElementById('chat-header-sub');

  if (ctx.word) {
    _contextBarEl.classList.remove('hidden');
    _contextBarEl.innerHTML = `
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
    _contextBarEl.classList.add('hidden');
    if (sub) sub.textContent = 'Ask anything about English';
  }
}

// ----------------------------------------------------------------
// Suggestion chips
// ----------------------------------------------------------------

function renderSuggestions() {
  const ctx = _getContext();
  const chips = getSuggestions(ctx);

  _suggestionsEl.innerHTML = chips
    .map(c => `<button class="chat-suggestion-chip">${escapeHtml(c)}</button>`)
    .join('');
  _suggestionsEl.classList.remove('hidden');

  _suggestionsEl.querySelectorAll('.chat-suggestion-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      _inputEl.value = btn.textContent;
      autoResizeInput();
      updateSendBtn();
      handleSend();
    });
  });
}

function hideSuggestions() {
  _suggestionsEl.classList.add('hidden');
}

// ----------------------------------------------------------------
// Message rendering
// ----------------------------------------------------------------

function appendMessage(role, content) {
  // Hide welcome on first message
  const welcome = _messagesEl.querySelector('#chat-welcome');
  if (welcome) welcome.remove();

  const isUser  = role === 'user';
  const isError = role === 'error';

  const msgEl = document.createElement('div');
  msgEl.className = `chat-msg chat-msg--${isError ? 'error' : isUser ? 'user' : 'ai'}`;

  const bubbleEl = document.createElement('div');
  bubbleEl.className = 'chat-msg-bubble';

  if (isUser || isError) {
    bubbleEl.textContent = content;
  } else {
    bubbleEl.innerHTML = renderMarkdown(content);
  }

  const timeEl = document.createElement('div');
  timeEl.className = 'chat-msg-time';
  timeEl.textContent = nowTime();

  msgEl.appendChild(bubbleEl);
  msgEl.appendChild(timeEl);
  _messagesEl.appendChild(msgEl);
  scrollToBottom();

  return msgEl;
}

function showTyping() {
  _typingEl = document.createElement('div');
  _typingEl.className = 'chat-typing';
  _typingEl.innerHTML = `
    <div class="chat-typing-dots">
      <span class="chat-typing-dot"></span>
      <span class="chat-typing-dot"></span>
      <span class="chat-typing-dot"></span>
    </div>
  `;
  _messagesEl.appendChild(_typingEl);
  scrollToBottom();
}

function hideTyping() {
  if (_typingEl) {
    _typingEl.remove();
    _typingEl = null;
  }
}

function scrollToBottom() {
  _messagesEl.scrollTop = _messagesEl.scrollHeight;
}

// ----------------------------------------------------------------
// Unread badge (when panel is closed and AI replies)
// ----------------------------------------------------------------

function bumpUnread() {
  if (_isOpen) return;
  _unreadCount++;
  _badgeEl.textContent = _unreadCount > 9 ? '9+' : String(_unreadCount);
  _badgeEl.classList.add('visible');
}

// ----------------------------------------------------------------
// Send flow
// ----------------------------------------------------------------

async function handleSend() {
  const text = _inputEl.value.trim();
  if (!text || _isBusy) return;

  _isBusy = true;
  updateSendBtn();
  hideSuggestions();

  appendMessage('user', text);

  const historySnapshot = [..._history];
  _history.push({ role: 'user', content: text });

  _inputEl.value = '';
  autoResizeInput();

  showTyping();

  // Capture generation so streaming callbacks can detect if conversation was cleared
  const gen = _generation;

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
    _messagesEl.appendChild(msgEl);
  }

  try {
    const context = _getContext();
    const fullReply = await sendChatMessageStream(
      historySnapshot,
      text,
      context,
      (delta) => {
        if (gen !== _generation) return; // conversation was cleared mid-stream
        if (!streamBubble) initStreamBubble();
        accumulated += delta;
        streamBubble.textContent = accumulated;
        scrollToBottom();
      },
    );

    // If cleared mid-stream, discard result silently
    if (gen !== _generation) return;

    // Apply markdown once streaming is complete
    if (streamBubble) {
      streamBubble.innerHTML = renderMarkdown(fullReply);
      scrollToBottom();
    }

    _history.push({ role: 'assistant', content: fullReply });
    bumpUnread();

  } catch (err) {
    if (gen !== _generation) return; // cleared mid-stream, ignore error
    hideTyping();
    if (streamBubble) {
      streamBubble.innerHTML = renderMarkdown(accumulated) +
        `<p style="color:var(--color-danger);font-size:var(--fs-xs);margin-top:var(--sp-2)">${escapeHtml(err.message)}</p>`;
    } else {
      appendMessage('error', err.message || 'An unknown error occurred. Please try again.');
    }
    _history.pop();
  } finally {
    _isBusy = false;
    updateSendBtn();
  }
}

// ----------------------------------------------------------------
// Input helpers
// ----------------------------------------------------------------

function autoResizeInput() {
  _inputEl.style.height = 'auto';
  const sh = _inputEl.scrollHeight;
  _inputEl.style.height = Math.min(sh, 100) + 'px';
  _inputEl.style.overflowY = sh > 100 ? 'auto' : 'hidden';
}

function updateSendBtn() {
  const hasText = _inputEl.value.trim().length > 0;
  _sendBtn.disabled = !hasText || _isBusy;
}

// ----------------------------------------------------------------
// Clear conversation
// ----------------------------------------------------------------

function clearConversation() {
  _generation++;  // invalidate any in-flight streaming callbacks
  _history = [];
  _messagesEl.innerHTML = `
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

// ----------------------------------------------------------------
// Event wiring
// ----------------------------------------------------------------

function wireEvents() {
  // Bubble toggle
  _bubble.addEventListener('click', togglePanel);

  // Send button
  _sendBtn.addEventListener('click', handleSend);

  // Input: auto-resize + enable send btn
  _inputEl.addEventListener('input', () => {
    autoResizeInput();
    updateSendBtn();
  });

  // Enter to send (Shift+Enter = newline)
  _inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  // Clear button
  _panel.querySelector('#chat-clear-btn').addEventListener('click', clearConversation);

  // Escape key closes panel
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && _isOpen) closePanel();
  });
}

// ----------------------------------------------------------------
// Public init
// ----------------------------------------------------------------

/**
 * Initialise the chat widget and inject it into the page.
 *
 * @param {() => { word?: string, wordType?: string, vietnamese?: string, topic?: string, page?: string }} getContextFn
 *   Called each time the panel opens or a message is sent to retrieve
 *   the current page context (e.g. which word the user is viewing).
 */
let _initialized = false;

export function initChatWidget(getContextFn) {
  if (typeof getContextFn === 'function') {
    _getContext = getContextFn;
  }

  // Guard against double init (e.g. HMR or accidental duplicate call)
  if (_initialized) return;
  _initialized = true;

  buildWidget();
  wireEvents();
}
