/* ============================================================
   WRITING MODE IMPLEMENTATIONS
   Sentence, Paragraph, Translation, Dictation
   ============================================================ */

import {
  evaluateSentence,
  evaluateParagraph,
  generateTranslationChallenge,
  evaluateTranslation,
  generateDictationSentence,
} from './writing-ai.js';

// ============================================================
// SENTENCE WRITING MODE
// ============================================================

let swWords = [], swIndex = 0, swScores = [];

export function initSentenceMode(allWords, ctx) {
  swWords = ctx.shuffle(allWords);
  swIndex = 0;
  swScores = [];

  const container = document.getElementById('sw-container');
  const result = document.getElementById('sw-result');
  container.style.display = '';
  container.classList.remove('has-feedback');
  result.classList.add('hidden');

  showSentenceWord(ctx);
}

function showSentenceWord(ctx) {
  if (swIndex >= swWords.length) {
    showSentenceResults(ctx);
    return;
  }

  const w = swWords[swIndex];
  document.getElementById('sw-word').textContent = w.english;
  document.getElementById('sw-ipa').textContent = w.ipaUS || '';
  document.getElementById('sw-type').textContent = ctx.WORD_TYPE_LABELS[w.wordType] || w.wordType || '';
  document.getElementById('sw-meaning').textContent = w.vietnamese || '';

  document.getElementById('sw-current').textContent = swIndex + 1;
  document.getElementById('sw-total').textContent = swWords.length;

  const pct = Math.round((swIndex / swWords.length) * 100);
  document.getElementById('sw-progress').style.width = pct + '%';
  document.getElementById('sw-progress-text').textContent = pct + '%';

  const avg = swScores.length > 0
    ? (swScores.reduce((a, b) => a + b, 0) / swScores.length).toFixed(1)
    : '-';
  document.getElementById('sw-avg-score').textContent = avg;

  // Reset input
  const input = document.getElementById('sw-input');
  input.value = '';
  input.disabled = false;
  input.focus();

  const checkBtn = document.getElementById('sw-btn-check');
  checkBtn.disabled = true;
  document.getElementById('sw-btn-skip').style.display = '';
  document.getElementById('sw-feedback').classList.add('hidden');
  document.getElementById('sw-next-row').style.display = 'none';
  document.getElementById('sw-container').classList.remove('has-feedback');

  // Enable check when user types
  input.oninput = () => {
    checkBtn.disabled = input.value.trim().length === 0;
  };

  // Check handler
  checkBtn.onclick = () => handleSentenceCheck(ctx);

  // Skip handler
  document.getElementById('sw-btn-skip').onclick = () => {
    swScores.push(0);
    swIndex++;
    showSentenceWord(ctx);
  };

  // Next handler
  document.getElementById('sw-btn-next').onclick = () => {
    swIndex++;
    showSentenceWord(ctx);
  };
}

async function handleSentenceCheck(ctx) {
  const w = swWords[swIndex];
  const input = document.getElementById('sw-input');
  const sentence = input.value.trim();
  if (!sentence) return;

  input.disabled = true;
  document.getElementById('sw-btn-check').disabled = true;
  document.getElementById('sw-btn-skip').style.display = 'none';

  // Show loading
  const feedbackEl = document.getElementById('sw-feedback');
  feedbackEl.classList.remove('hidden');
  feedbackEl.innerHTML = '<div class="ai-loading"><div class="spinner"></div><span class="ai-loading-text">Evaluating...</span></div>';

  try {
    const result = await evaluateSentence(w, sentence);
    swScores.push(result.overallScore);

    // Record streak for good scores
    if (result.overallScore >= 6) {
      ctx.handleStreakRecord();
    }

    feedbackEl.innerHTML = buildSentenceFeedback(result, ctx);
    document.getElementById('sw-container').classList.add('has-feedback');
    document.getElementById('sw-next-row').style.display = '';

    // Update avg
    const avg = (swScores.reduce((a, b) => a + b, 0) / swScores.length).toFixed(1);
    document.getElementById('sw-avg-score').textContent = avg;
  } catch (err) {
    console.error('Sentence eval error:', err);
    feedbackEl.innerHTML = '';
    feedbackEl.classList.add('hidden');
    ctx.showToast('AI evaluation failed. ' + (err.message || ''), 'error');
    input.disabled = false;
    document.getElementById('sw-btn-check').disabled = false;
    document.getElementById('sw-btn-skip').style.display = '';
  }
}

function buildSentenceFeedback(result, ctx) {
  return `
    <div class="ai-feedback-title">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
      AI Feedback
    </div>
    <div class="score-badges">
      ${buildScoreBadge(result.grammarScore, 'Grammar')}
      ${buildScoreBadge(result.usageScore, 'Usage')}
      ${buildScoreBadge(result.naturalnessScore, 'Natural')}
      ${buildScoreBadge(result.overallScore, 'Overall')}
    </div>
    <div class="corrected-box">
      <div class="corrected-box-label">Corrected Sentence</div>
      <div class="corrected-box-text">${ctx.escapeHtml(result.correctedSentence)}</div>
    </div>
    <div class="ai-feedback-text">${ctx.escapeHtml(result.feedback)}</div>
    ${result.tips.length > 0 ? `
      <ul class="ai-tips">
        ${result.tips.map(t => `<li>${ctx.escapeHtml(t)}</li>`).join('')}
      </ul>
    ` : ''}
  `;
}

function buildScoreBadge(score, label) {
  const cls = score >= 7 ? 'score-high' : score >= 5 ? 'score-mid' : 'score-low';
  return `
    <div class="score-badge ${cls}">
      <span class="score-badge-value">${score}</span>
      <span class="score-badge-label">${label}</span>
    </div>
  `;
}

function showSentenceResults(ctx) {
  const container = document.getElementById('sw-container');
  const result = document.getElementById('sw-result');
  container.style.display = 'none';
  result.classList.remove('hidden');

  document.getElementById('sw-progress').style.width = '100%';
  document.getElementById('sw-progress-text').textContent = '100%';

  const avg = swScores.length > 0
    ? (swScores.reduce((a, b) => a + b, 0) / swScores.length).toFixed(1)
    : 0;
  const good = swScores.filter(s => s >= 6).length;
  result.innerHTML = ctx.buildResultHtml(good, swWords.length, `Avg: ${avg}/10`);
}

// ============================================================
// PARAGRAPH WRITING MODE
// ============================================================

let pwWords = [];

export function initParagraphMode(allWords, ctx) {
  pwWords = ctx.shuffle(allWords).slice(0, Math.min(5, allWords.length));

  const container = document.getElementById('pw-container');
  const result = document.getElementById('pw-result');
  container.style.display = '';
  container.classList.remove('has-feedback');
  result.classList.add('hidden');

  showParagraphPrompt(ctx);
}

function showParagraphPrompt(ctx) {
  // Display target words
  const wordsEl = document.getElementById('pw-words');
  wordsEl.innerHTML = pwWords.map(w =>
    `<span class="target-word-badge">${ctx.escapeHtml(w.english)}</span>`
  ).join('');

  // Reset input
  const input = document.getElementById('pw-input');
  input.value = '';
  input.disabled = false;
  input.focus();

  const checkBtn = document.getElementById('pw-btn-check');
  checkBtn.disabled = true;
  document.getElementById('pw-feedback').classList.add('hidden');
  document.getElementById('pw-action-row').style.display = 'none';
  document.getElementById('pw-container').classList.remove('has-feedback');

  input.oninput = () => {
    checkBtn.disabled = input.value.trim().length === 0;
  };

  checkBtn.onclick = () => handleParagraphCheck(ctx);

  document.getElementById('pw-btn-retry').onclick = () => {
    document.getElementById('pw-feedback').classList.add('hidden');
    document.getElementById('pw-action-row').style.display = 'none';
    document.getElementById('pw-container').classList.remove('has-feedback');
    input.value = '';
    input.disabled = false;
    input.focus();
    checkBtn.disabled = true;
  };

  document.getElementById('pw-btn-new').onclick = () => {
    pwWords = ctx.shuffle(ctx.shuffle(allWords || pwWords)).slice(0, Math.min(5, (allWords || pwWords).length));
    showParagraphPrompt(ctx);
  };
}

async function handleParagraphCheck(ctx) {
  const input = document.getElementById('pw-input');
  const paragraph = input.value.trim();
  if (!paragraph) return;

  input.disabled = true;
  document.getElementById('pw-btn-check').disabled = true;

  const feedbackEl = document.getElementById('pw-feedback');
  feedbackEl.classList.remove('hidden');
  feedbackEl.innerHTML = '<div class="ai-loading"><div class="spinner"></div><span class="ai-loading-text">Evaluating...</span></div>';

  try {
    const result = await evaluateParagraph(pwWords, paragraph);

    if (result.overallScore >= 6) {
      ctx.handleStreakRecord();
    }

    feedbackEl.innerHTML = buildParagraphFeedback(result, ctx);
    document.getElementById('pw-container').classList.add('has-feedback');
    document.getElementById('pw-action-row').style.display = '';
  } catch (err) {
    console.error('Paragraph eval error:', err);
    feedbackEl.innerHTML = '';
    feedbackEl.classList.add('hidden');
    ctx.showToast('AI evaluation failed. ' + (err.message || ''), 'error');
    input.disabled = false;
    document.getElementById('pw-btn-check').disabled = false;
  }
}

function buildParagraphFeedback(result, ctx) {
  const wordCoverage = result.wordResults.map(wr => {
    const cls = wr.usedCorrectly ? 'used-correct' : wr.used ? 'used-wrong' : 'not-used';
    const icon = wr.usedCorrectly ? '&#10003;' : wr.used ? '&#9888;' : '&#10007;';
    return `<span class="word-coverage-item ${cls}">${icon} ${ctx.escapeHtml(wr.word)}</span>`;
  }).join('');

  return `
    <div class="ai-feedback-title">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
      AI Feedback
    </div>
    <div class="score-badges">
      ${buildScoreBadge(result.grammarScore, 'Grammar')}
      ${buildScoreBadge(result.coherenceScore, 'Coherence')}
      ${buildScoreBadge(result.naturalnessScore, 'Natural')}
      ${buildScoreBadge(result.overallScore, 'Overall')}
    </div>
    <div class="word-coverage">${wordCoverage}</div>
    <div class="corrected-box">
      <div class="corrected-box-label">Improved Version</div>
      <div class="corrected-box-text">${ctx.escapeHtml(result.correctedParagraph)}</div>
    </div>
    <div class="ai-feedback-text">${ctx.escapeHtml(result.feedback)}</div>
    ${result.suggestions.length > 0 ? `
      <ul class="ai-tips">
        ${result.suggestions.map(s => `<li>${ctx.escapeHtml(s)}</li>`).join('')}
      </ul>
    ` : ''}
  `;
}

// ============================================================
// TRANSLATION MODE
// ============================================================

let trChallenge = null;

export function initTranslationMode(allWords, ctx) {
  document.getElementById('tr-content').style.display = 'none';
  document.getElementById('tr-loading').style.display = '';
  document.getElementById('tr-feedback').classList.add('hidden');
  document.getElementById('tr-next-row').style.display = 'none';

  const backBtn = document.getElementById('tr-btn-back');
  if (backBtn) backBtn.href = `topic-detail.html?topicId=${ctx.topicId}`;

  document.getElementById('tr-loading').innerHTML =
    `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none"
          stroke="var(--color-primary)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/>
      <path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/>
    </svg>
    <span class="ai-loading-text">AI will generate a Vietnamese text for you to translate.</span>
    <button class="btn btn-primary" id="tr-start-btn">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
      Start
    </button>`;
  document.getElementById('tr-start-btn').onclick = () => generateNewTranslation(allWords, ctx);
}

async function generateNewTranslation(allWords, ctx) {
  document.getElementById('tr-content').style.display = 'none';
  document.getElementById('tr-loading').style.display = '';
  document.getElementById('tr-loading').innerHTML =
    '<div class="spinner spinner-lg"></div><span class="ai-loading-text">Generating translation challenge...</span>';

  try {
    trChallenge = await generateTranslationChallenge(allWords);

    document.getElementById('tr-source').textContent = trChallenge.vietnameseText;
    document.getElementById('tr-loading').style.display = 'none';
    document.getElementById('tr-content').style.display = '';

    // Reset input
    const input = document.getElementById('tr-input');
    input.value = '';
    input.disabled = false;
    input.focus();

    const checkBtn = document.getElementById('tr-btn-check');
    checkBtn.disabled = true;
    document.getElementById('tr-feedback').classList.add('hidden');
    document.getElementById('tr-next-row').style.display = 'none';
    document.getElementById('tr-container').classList.remove('has-feedback');

    input.oninput = () => {
      checkBtn.disabled = input.value.trim().length === 0;
    };

    checkBtn.onclick = () => handleTranslationCheck(allWords, ctx);
    document.getElementById('tr-btn-next').onclick = () => generateNewTranslation(allWords, ctx);

  } catch (err) {
    console.error('Translation gen error:', err);
    document.getElementById('tr-loading').innerHTML =
      '<div class="ai-loading"><span class="ai-loading-text" style="color:var(--color-danger)">Failed to generate challenge.</span>' +
      '<button class="btn btn-primary btn-sm" onclick="this.closest(\'.ai-loading\').querySelector(\'.ai-loading-text\').textContent=\'Retrying...\';this.remove()">Retry</button></div>';
    ctx.showToast('Failed to generate translation challenge.', 'error');
  }
}

async function handleTranslationCheck(allWords, ctx) {
  const input = document.getElementById('tr-input');
  const userTranslation = input.value.trim();
  if (!userTranslation || !trChallenge) return;

  input.disabled = true;
  document.getElementById('tr-btn-check').disabled = true;

  const feedbackEl = document.getElementById('tr-feedback');
  feedbackEl.classList.remove('hidden');
  feedbackEl.innerHTML = '<div class="ai-loading"><div class="spinner"></div><span class="ai-loading-text">Evaluating...</span></div>';

  try {
    const result = await evaluateTranslation(
      trChallenge.vietnameseText,
      userTranslation,
      trChallenge.referenceEnglish,
    );

    if (result.overallScore >= 6) {
      ctx.handleStreakRecord();
    }

    feedbackEl.innerHTML = buildTranslationFeedback(result, userTranslation, ctx);
    document.getElementById('tr-container').classList.add('has-feedback');
    document.getElementById('tr-next-row').style.display = '';
  } catch (err) {
    console.error('Translation eval error:', err);
    feedbackEl.innerHTML = '';
    feedbackEl.classList.add('hidden');
    ctx.showToast('AI evaluation failed. ' + (err.message || ''), 'error');
    input.disabled = false;
    document.getElementById('tr-btn-check').disabled = false;
  }
}

function buildTranslationFeedback(result, userTranslation, ctx) {
  const corrected = result.correctedTranslation || result.suggestedTranslation;
  const diffHtml = buildInlineDiff(userTranslation, corrected, ctx);
  const hasErrors = result.grammarErrors && result.grammarErrors.length > 0;

  const errorTypeLabels = {
    grammar: 'Grammar',
    word_choice: 'Word Choice',
    spelling: 'Spelling',
    punctuation: 'Punctuation',
    word_order: 'Word Order',
  };

  const errorsHtml = hasErrors ? `
    <div class="tr-errors-section">
      <div class="tr-errors-title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        Error Details (${result.grammarErrors.length})
      </div>
      ${result.grammarErrors.map((err, i) => `
        <div class="tr-error-card">
          <div class="tr-error-header">
            <span class="tr-error-num">${i + 1}</span>
            <span class="tr-error-type tr-error-type--${ctx.escapeHtml(err.type || 'grammar')}">${errorTypeLabels[err.type] || 'Error'}</span>
          </div>
          <div class="tr-error-diff">
            <div class="tr-error-wrong">
              <span class="tr-error-icon">&#10007;</span>
              <span>${ctx.escapeHtml(err.original || '')}</span>
            </div>
            <div class="tr-error-arrow">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg>
            </div>
            <div class="tr-error-right">
              <span class="tr-error-icon">&#10003;</span>
              <span>${ctx.escapeHtml(err.corrected || '')}</span>
            </div>
          </div>
          <div class="tr-error-explanation">${ctx.escapeHtml(err.explanation || '')}</div>
        </div>
      `).join('')}
    </div>
  ` : '';

  return `
    <div class="ai-feedback-title">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
      AI Feedback
    </div>
    <div class="score-badges">
      ${buildScoreBadge(result.accuracyScore, 'Accuracy')}
      ${buildScoreBadge(result.grammarScore, 'Grammar')}
      ${buildScoreBadge(result.overallScore, 'Overall')}
    </div>
    <div class="tr-diff-comparison">
      <div class="tr-diff-col tr-diff-col--user">
        <div class="tr-diff-col-label">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          Your Translation
        </div>
        <div class="tr-diff-col-text">${diffHtml.userHtml}</div>
      </div>
      <div class="tr-diff-col tr-diff-col--corrected">
        <div class="tr-diff-col-label">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
          Corrected Version
        </div>
        <div class="tr-diff-col-text">${diffHtml.correctedHtml}</div>
      </div>
    </div>
    ${errorsHtml}
    <div class="ai-feedback-text">${ctx.escapeHtml(result.feedback)}</div>
    <div class="corrected-box">
      <div class="corrected-box-label">Suggested Translation</div>
      <div class="corrected-box-text">${ctx.escapeHtml(result.suggestedTranslation)}</div>
    </div>
  `;
}

/**
 * Build inline diff between user text and corrected text.
 * Uses word-level comparison to highlight additions, deletions and changes.
 */
function buildInlineDiff(userText, correctedText, ctx) {
  const userWords = userText.split(/(\s+)/);
  const corrWords = correctedText.split(/(\s+)/);

  // Simple LCS-based diff on words
  const lcs = buildLCS(
    userWords.filter(w => w.trim()),
    corrWords.filter(w => w.trim()),
  );

  const userTokens = userWords.filter(w => w.trim());
  const corrTokens = corrWords.filter(w => w.trim());

  let ui = 0, ci = 0, li = 0;
  let userParts = [], corrParts = [];

  while (ui < userTokens.length || ci < corrTokens.length) {
    if (li < lcs.length && ui < userTokens.length && ci < corrTokens.length
        && userTokens[ui].toLowerCase() === lcs[li].toLowerCase()
        && corrTokens[ci].toLowerCase() === lcs[li].toLowerCase()) {
      // Matching word
      userParts.push(ctx.escapeHtml(userTokens[ui]));
      corrParts.push(ctx.escapeHtml(corrTokens[ci]));
      ui++; ci++; li++;
    } else if (li < lcs.length && ci < corrTokens.length
               && corrTokens[ci].toLowerCase() === lcs[li].toLowerCase()) {
      // Word removed from user (exists in user but not in LCS at this point)
      userParts.push(`<span class="tr-diff-del">${ctx.escapeHtml(userTokens[ui])}</span>`);
      ui++;
    } else if (li < lcs.length && ui < userTokens.length
               && userTokens[ui].toLowerCase() === lcs[li].toLowerCase()) {
      // Word added in corrected
      corrParts.push(`<span class="tr-diff-add">${ctx.escapeHtml(corrTokens[ci])}</span>`);
      ci++;
    } else {
      // Both differ from LCS — treat as a change
      if (ui < userTokens.length) {
        userParts.push(`<span class="tr-diff-del">${ctx.escapeHtml(userTokens[ui])}</span>`);
        ui++;
      }
      if (ci < corrTokens.length) {
        corrParts.push(`<span class="tr-diff-add">${ctx.escapeHtml(corrTokens[ci])}</span>`);
        ci++;
      }
    }
  }

  return {
    userHtml: userParts.join(' '),
    correctedHtml: corrParts.join(' '),
  };
}

/** Compute LCS of two string arrays (case-insensitive). */
function buildLCS(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1].toLowerCase() === b[j - 1].toLowerCase()
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  const result = [];
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1].toLowerCase() === b[j - 1].toLowerCase()) {
      result.unshift(a[i - 1]);
      i--; j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }
  return result;
}

// ============================================================
// DICTATION MODE
// ============================================================

let dcWords = [], dcIndex = 0, dcScore = 0, dcTotal = 5;
let dcSentences = [];

export function initDictationMode(allWords, ctx) {
  dcWords = allWords;
  dcIndex = 0;
  dcScore = 0;
  dcTotal = Math.min(5, allWords.length);
  dcSentences = [];

  const container = document.getElementById('dc-container');
  const result = document.getElementById('dc-result');
  container.style.display = '';
  result.classList.add('hidden');

  document.getElementById('dc-total').textContent = dcTotal;

  document.getElementById('dc-content').style.display = 'none';
  document.getElementById('dc-loading').style.display = '';
  document.getElementById('dc-loading').innerHTML =
    `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none"
          stroke="var(--color-primary)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 18v-6a9 9 0 0 1 18 0v6"/>
      <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>
    </svg>
    <span class="ai-loading-text">AI will generate sentences for dictation practice.</span>
    <button class="btn btn-primary" id="dc-start-btn">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
      Start
    </button>`;
  document.getElementById('dc-start-btn').onclick = () => generateAllDictation(ctx);
}

async function generateAllDictation(ctx) {
  document.getElementById('dc-content').style.display = 'none';
  document.getElementById('dc-loading').style.display = '';
  document.getElementById('dc-loading').innerHTML =
    `<div class="spinner spinner-lg"></div>
     <span class="ai-loading-text">Generating ${dcTotal} dictation sentences...</span>
     <span class="ai-loading-text" id="dc-gen-progress" style="font-size:var(--fs-xs)">0 / ${dcTotal}</span>`;

  dcSentences = [];

  try {
    for (let i = 0; i < dcTotal; i++) {
      const result = await generateDictationSentence(dcWords);
      dcSentences.push(result.sentence);
      const progressEl = document.getElementById('dc-gen-progress');
      if (progressEl) progressEl.textContent = `${i + 1} / ${dcTotal}`;
    }

    dcIndex = 0;
    dcScore = 0;
    showDictationSentence(ctx);

  } catch (err) {
    console.error('Dictation gen error:', err);
    document.getElementById('dc-loading').innerHTML =
      `<span class="ai-loading-text" style="color:var(--color-danger)">Failed to generate sentences.</span>
       <button class="btn btn-primary btn-sm" id="dc-retry-btn">Retry</button>`;
    document.getElementById('dc-retry-btn').onclick = () => generateAllDictation(ctx);
    ctx.showToast('Failed to generate dictation sentences.', 'error');
  }
}

function showDictationSentence(ctx) {
  const sentence = dcSentences[dcIndex];

  document.getElementById('dc-loading').style.display = 'none';
  document.getElementById('dc-content').style.display = '';

  document.getElementById('dc-current').textContent = dcIndex + 1;
  const pct = Math.round((dcIndex / dcTotal) * 100);
  document.getElementById('dc-progress').style.width = pct + '%';
  document.getElementById('dc-progress-text').textContent = pct + '%';
  document.getElementById('dc-score').textContent = dcScore;

  // Reset input
  const input = document.getElementById('dc-input');
  input.value = '';
  input.disabled = false;
  input.focus();

  const checkBtn = document.getElementById('dc-btn-check');
  checkBtn.disabled = true;
  document.getElementById('dc-diff').classList.add('hidden');
  document.getElementById('dc-next-row').style.display = 'none';

  input.oninput = () => {
    checkBtn.disabled = input.value.trim().length === 0;
  };

  // Auto-play
  const speed = parseFloat(document.getElementById('dc-speed').value) || 0.85;
  ctx.speakText(sentence, speed);

  // Play button
  document.getElementById('dc-play-btn').onclick = () => {
    const spd = parseFloat(document.getElementById('dc-speed').value) || 0.85;
    ctx.speakText(sentence, spd);
  };

  checkBtn.onclick = () => handleDictationCheck(ctx);
  document.getElementById('dc-btn-next').onclick = () => {
    dcIndex++;
    if (dcIndex >= dcTotal) {
      showDictationResults(ctx);
    } else {
      showDictationSentence(ctx);
    }
  };
}

function handleDictationCheck(ctx) {
  const input = document.getElementById('dc-input');
  const userText = input.value.trim();
  if (!userText) return;

  input.disabled = true;
  document.getElementById('dc-btn-check').disabled = true;

  // Word-level diff
  const currentSentence = dcSentences[dcIndex];
  const expected = currentSentence.toLowerCase().replace(/[.,!?;:'"]/g, '').split(/\s+/).filter(Boolean);
  const actual = userText.toLowerCase().replace(/[.,!?;:'"]/g, '').split(/\s+/).filter(Boolean);

  let correctCount = 0;
  const maxLen = Math.max(expected.length, actual.length);
  let diffHtml = '';

  for (let i = 0; i < maxLen; i++) {
    const exp = expected[i] || '';
    const act = actual[i] || '';

    if (exp === act) {
      correctCount++;
      diffHtml += `<span class="diff-correct">${ctx.escapeHtml(exp)}</span> `;
    } else if (!act && exp) {
      diffHtml += `<span class="diff-missing">${ctx.escapeHtml(exp)}</span> `;
    } else if (act && !exp) {
      diffHtml += `<span class="diff-extra">${ctx.escapeHtml(act)}</span> `;
    } else {
      diffHtml += `<span class="diff-wrong">${ctx.escapeHtml(act)}</span><span class="diff-expected"> [${ctx.escapeHtml(exp)}]</span> `;
    }
  }

  const isCorrect = correctCount === expected.length && actual.length === expected.length;
  if (isCorrect) dcScore++;

  if (isCorrect && correctCount >= expected.length) {
    ctx.handleStreakRecord();
  }

  const diffEl = document.getElementById('dc-diff');
  diffEl.classList.remove('hidden');
  diffEl.innerHTML = `
    <div class="dc-diff-header ${isCorrect ? 'dc-diff-correct' : 'dc-diff-wrong'}">
      ${isCorrect ? '✓ Correct!' : `${correctCount}/${expected.length} words correct`}
    </div>
    <div class="dc-diff-section">
      <div class="dc-diff-label">Your answer</div>
      <div class="dc-diff-text">${diffHtml}</div>
    </div>
    <div class="dc-diff-section dc-diff-answer">
      <div class="dc-diff-label">Correct sentence</div>
      <div class="dc-diff-text">${ctx.escapeHtml(currentSentence)}</div>
    </div>
  `;

  document.getElementById('dc-score').textContent = dcScore;
  document.getElementById('dc-next-row').style.display = '';
}

function showDictationResults(ctx) {
  const container = document.getElementById('dc-container');
  const result = document.getElementById('dc-result');
  container.style.display = 'none';
  result.classList.remove('hidden');

  document.getElementById('dc-progress').style.width = '100%';
  document.getElementById('dc-progress-text').textContent = '100%';

  result.innerHTML = ctx.buildResultHtml(dcScore, dcTotal);
}

// Keyboard: R to replay in dictation mode
document.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 'r' && document.activeElement?.tagName !== 'TEXTAREA') {
    const panel = document.getElementById('panel-dictation');
    if (panel && panel.classList.contains('active')) {
      const playBtn = document.getElementById('dc-play-btn');
      if (playBtn && playBtn.offsetParent !== null) {
        playBtn.click();
      }
    }
  }
});
