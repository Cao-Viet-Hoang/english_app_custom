/* ============================================================
   CHAT RENDERER
   Markdown rendering, message display, typing indicator
   ============================================================ */

import { state, dom, nowTime, getSuggestions } from './chat-state.js';
import { escapeHtml } from '../ui/index.js';

// ----------------------------------------------------------------
// Simple markdown-lite renderer for AI responses
// ----------------------------------------------------------------

export function renderMarkdown(text) {
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
// Message rendering
// ----------------------------------------------------------------

export function appendMessage(role, content) {
  // Hide welcome on first message
  const welcome = dom.messagesEl.querySelector('#chat-welcome');
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
  dom.messagesEl.appendChild(msgEl);
  scrollToBottom();

  return msgEl;
}

// ----------------------------------------------------------------
// Typing indicator
// ----------------------------------------------------------------

export function showTyping() {
  dom.typingEl = document.createElement('div');
  dom.typingEl.className = 'chat-typing';
  dom.typingEl.innerHTML = `
    <div class="chat-typing-dots">
      <span class="chat-typing-dot"></span>
      <span class="chat-typing-dot"></span>
      <span class="chat-typing-dot"></span>
    </div>
  `;
  dom.messagesEl.appendChild(dom.typingEl);
  scrollToBottom();
}

export function hideTyping() {
  if (dom.typingEl) {
    dom.typingEl.remove();
    dom.typingEl = null;
  }
}

export function scrollToBottom() {
  dom.messagesEl.scrollTop = dom.messagesEl.scrollHeight;
}

// ----------------------------------------------------------------
// Unread badge (when panel is closed and AI replies)
// ----------------------------------------------------------------

export function bumpUnread() {
  if (state.isOpen) return;
  state.unreadCount++;
  dom.badgeEl.textContent = state.unreadCount > 9 ? '9+' : String(state.unreadCount);
  dom.badgeEl.classList.add('visible');
}

// ----------------------------------------------------------------
// Suggestion chips
// ----------------------------------------------------------------

export function renderSuggestions() {
  const ctx = state.getContext();
  const chips = getSuggestions(ctx);

  dom.suggestionsEl.innerHTML = chips
    .map(c => `<button class="chat-suggestion-chip">${escapeHtml(c)}</button>`)
    .join('');
  dom.suggestionsEl.classList.remove('hidden');
}

export function hideSuggestions() {
  dom.suggestionsEl.classList.add('hidden');
}
