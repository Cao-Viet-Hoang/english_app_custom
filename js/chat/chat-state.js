/* ============================================================
   CHAT STATE
   Shared state, DOM refs, suggestion data
   ============================================================ */

// Mutable state — shared across all chat modules
export const state = {
  getContext: () => ({}),
  history: [],
  isOpen: false,
  isBusy: false,
  unreadCount: 0,
  generation: 0,
  initialized: false,
  viewMode: 'bubble', // 'bubble' | 'modal'
};

// DOM refs — populated by buildWidget()
export const dom = {
  bubble: null,
  panel: null,
  messagesEl: null,
  inputEl: null,
  sendBtn: null,
  typingEl: null,
  suggestionsEl: null,
  contextBarEl: null,
  badgeEl: null,
  backdropEl: null,
  modeBtnEl: null,
};

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

export function getSuggestions(context) {
  if (context?.word) return WORD_SUGGESTIONS(context.word);
  return GENERAL_SUGGESTIONS;
}

// ----------------------------------------------------------------
// Time helper
// ----------------------------------------------------------------

export function nowTime() {
  return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}
