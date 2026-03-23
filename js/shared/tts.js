/* ============================================================
   TTS (Text-to-Speech) UTILITY
   Web Speech API wrapper with preferred voice selection.
   ============================================================ */

const PREFERRED_VOICES = [
  'Google US English',
  'Microsoft Aria Online (Natural) - English (United States)',
  'Microsoft David - English (United States)',
  'Microsoft Zira - English (United States)',
  'Samantha',
];

let _voice = null;
let _ready = false;

function loadVoice() {
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return;
  for (const name of PREFERRED_VOICES) {
    const v = voices.find(v => v.name === name);
    if (v) { _voice = v; _ready = true; return; }
  }
  _voice = voices.find(v => v.lang === 'en-US') || null;
  _ready = true;
}

// Eagerly attempt to load, then listen for async voice list
loadVoice();
if ('speechSynthesis' in window) {
  window.speechSynthesis.addEventListener('voiceschanged', loadVoice);
}

/**
 * Speak text aloud using Web Speech API.
 * @param {string} text
 * @param {number} [rate=0.85] Speech rate (0.1 – 10)
 */
export function speakText(text, rate = 0.85) {
  if (!('speechSynthesis' in window)) return;

  function doSpeak() {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.rate = rate;
    if (_voice) u.voice = _voice;
    window.speechSynthesis.speak(u);
  }

  if (_ready) {
    doSpeak();
  } else {
    window.speechSynthesis.addEventListener('voiceschanged', function once() {
      window.speechSynthesis.removeEventListener('voiceschanged', once);
      loadVoice();
      doSpeak();
    });
    loadVoice();
    if (_ready) doSpeak();
  }
}
