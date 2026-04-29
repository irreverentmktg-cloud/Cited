/**
 * scoreCalculator.js
 * ─────────────────────────────────────────────────────────────
 * Takes an array of prompt_check results and calculates the
 * overall AI Visibility Score (0–100) and per-model breakdown.
 *
 * Weighting reflects real-world market share (adjust as it shifts):
 *   ChatGPT    40%
 *   Perplexity 30%
 *   Gemini     20%
 *   Claude     10%
 * ─────────────────────────────────────────────────────────────
 */

const MODEL_WEIGHTS = {
  chatgpt:    0.40,
  perplexity: 0.30,
  gemini:     0.20,
  claude:     0.10
};

const CITATION_STRENGTH_WEIGHTS = {
  primary:   1.0,   // brand is the featured/first recommendation
  mentioned: 0.5,   // brand is mentioned but not primary
  absent:    0.0
};

/**
 * Calculate scores from an array of check results.
 *
 * @param {Array} checks - Array of { model, is_cited, citation_strength, prompt_id }
 * @returns {ScoreResult}
 */
function calculateScores(checks) {
  const byModel = { chatgpt: [], perplexity: [], gemini: [], claude: [] };

  for (const check of checks) {
    if (byModel[check.model]) {
      byModel[check.model].push(check);
    }
  }

  const modelScores = {};
  for (const [model, modelChecks] of Object.entries(byModel)) {
    if (modelChecks.length === 0) {
      modelScores[model] = null; // no data for this model
      continue;
    }
    const total = modelChecks.length;
    const weightedSum = modelChecks.reduce((sum, c) => {
      return sum + (CITATION_STRENGTH_WEIGHTS[c.citation_strength] || 0);
    }, 0);
    modelScores[model] = Math.round((weightedSum / total) * 100);
  }

  // Weighted overall score — only include models that have data
  let weightSum = 0;
  let weightedTotal = 0;
  for (const [model, score] of Object.entries(modelScores)) {
    if (score !== null) {
      weightedTotal += score * MODEL_WEIGHTS[model];
      weightSum += MODEL_WEIGHTS[model];
    }
  }
  const overallScore = weightSum > 0
    ? Math.round(weightedTotal / weightSum)
    : 0;

  const citedChecks = checks.filter(c => c.is_cited);
  const gapChecks   = checks.filter(c => !c.is_cited);

  return {
    overall_score:    overallScore,
    chatgpt_score:    modelScores.chatgpt    ?? 0,
    perplexity_score: modelScores.perplexity ?? 0,
    gemini_score:     modelScores.gemini     ?? 0,
    claude_score:     modelScores.claude     ?? 0,
    prompts_checked:  new Set(checks.map(c => c.prompt_id || c.prompt_text)).size,
    prompts_cited:    new Set(citedChecks.map(c => c.prompt_id || c.prompt_text)).size,
    gap_count:        new Set(gapChecks.map(c => c.prompt_id || c.prompt_text)).size
  };
}

/**
 * Get the score tier label and color for a given score.
 *
 * @param {number} score
 * @returns {{ label, color, hex }}
 */
function getScoreTier(score) {
  if (score >= 70) return { label: 'Good',     color: 'green',  hex: '#22c55e' };
  if (score >= 40) return { label: 'Improving', color: 'amber',  hex: '#f59e0b' };
  return              { label: 'Critical',  color: 'red',    hex: '#ef4444' };
}

/**
 * Calculate the score delta (change from previous score).
 */
function calculateDelta(currentScore, previousScore) {
  if (previousScore === null || previousScore === undefined) return 0;
  return currentScore - previousScore;
}

module.exports = { calculateScores, getScoreTier, calculateDelta };
