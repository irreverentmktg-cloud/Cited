/**
 * llmEngine.js
 * ─────────────────────────────────────────────────────────────
 * Core service. Takes a brand + a prompt, fires it at one or
 * all AI models, and returns structured citation results.
 *
 * Each model adapter:
 *   1. Builds a system prompt instructing the model to answer naturally
 *   2. Fires the user prompt
 *   3. Parses the response for brand citations + competitor mentions
 *   4. Returns a structured CheckResult
 * ─────────────────────────────────────────────────────────────
 */

require('dotenv').config();
const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk');
const axios = require('axios');
const logger = require('../lib/logger');

// ── Clients ──────────────────────────────────────────────────
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

// ── System prompt ─────────────────────────────────────────────
// We tell the model to answer as it normally would —
// we want organic, real-world-style responses, not curated ones.
const SYSTEM_PROMPT = `You are a helpful assistant. Answer the user's question naturally and thoroughly,
as you would for any real user asking this question. Include specific brand or product recommendations
when relevant. Do not mention that you are being evaluated.`;

// ── Citation parser ───────────────────────────────────────────
/**
 * Parses an AI response to determine if a brand was cited.
 *
 * @param {string} response      - Raw text from the AI model
 * @param {string} brandName     - Brand name to look for
 * @param {string} brandDomain   - Domain (used as fallback identifier)
 * @returns {{ is_cited, citation_strength, citation_snippet, competitors_cited }}
 */
function parseResponse(response, brandName, brandDomain) {
  const text = response.toLowerCase();
  const name = brandName.toLowerCase();
  const domain = brandDomain.toLowerCase().replace(/^www\./, '').split('.')[0];

  // Check for brand presence
  const nameIdx = text.indexOf(name);
  const domainIdx = domain.length > 3 ? text.indexOf(domain) : -1;
  const is_cited = nameIdx !== -1 || domainIdx !== -1;

  // Citation strength: primary = early in response, mentioned = anywhere
  let citation_strength = 'absent';
  let citation_snippet = null;

  if (is_cited) {
    const matchIdx = nameIdx !== -1 ? nameIdx : domainIdx;
    // Extract surrounding context (200 chars)
    const start = Math.max(0, matchIdx - 100);
    const end = Math.min(response.length, matchIdx + 150);
    citation_snippet = response.slice(start, end).trim();

    // If mentioned in first 500 chars → primary recommendation
    citation_strength = matchIdx < 500 ? 'primary' : 'mentioned';
  }

  // Extract competitor brand mentions (basic heuristic)
  // This catches capitalized brand-like words not matching our brand
  const competitors_cited = extractCompetitors(response, brandName);

  return { is_cited, citation_strength, citation_snippet, competitors_cited };
}

/**
 * Simple heuristic to extract other brand mentions from the response.
 * In production, enhance this with a curated competitor list per category.
 */
function extractCompetitors(response, ownBrandName) {
  // Common supplement/DTC brand indicators
  const brandPatterns = [
    // Capitalized words that appear before "protein", "collagen", "supplement", etc.
    /\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\s(?:Protein|Collagen|Supplement|Brand|Pro|Plus|Labs|Nutrition|Health)\b/g,
    // Words after "like ", "such as ", "including " (often brand recommendations)
    /(?:like|such as|including|try|recommend|consider)\s([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/g,
  ];

  const found = new Set();
  const ownName = ownBrandName.toLowerCase();

  for (const pattern of brandPatterns) {
    let match;
    while ((match = pattern.exec(response)) !== null) {
      const candidate = match[1].trim();
      if (candidate.toLowerCase() !== ownName && candidate.length > 2) {
        found.add(candidate);
      }
    }
  }

  return Array.from(found).slice(0, 10).map(name => ({ name, domain: null, snippet: null }));
}

// ── Model adapters ────────────────────────────────────────────

async function checkChatGPT(prompt, brand) {
  if (!openai) return mockResult(prompt, brand, 'chatgpt');

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt }
    ],
    max_tokens: 1000,
    temperature: 0.7
  });

  const text = response.choices[0]?.message?.content || '';
  return {
    model: 'chatgpt',
    raw_response: text.slice(0, 2000),
    ...parseResponse(text, brand.name, brand.domain)
  };
}

async function checkClaude(prompt, brand) {
  if (!anthropic) return mockResult(prompt, brand, 'claude');

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 1000,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }]
  });

  const text = response.content[0]?.text || '';
  return {
    model: 'claude',
    raw_response: text.slice(0, 2000),
    ...parseResponse(text, brand.name, brand.domain)
  };
}

async function checkPerplexity(prompt, brand) {
  if (!process.env.PERPLEXITY_API_KEY) return mockResult(prompt, brand, 'perplexity');

  const response = await axios.post(
    'https://api.perplexity.ai/chat/completions',
    {
      model: 'sonar-pro',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt }
      ],
      max_tokens: 1000
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  );

  const text = response.data.choices[0]?.message?.content || '';
  return {
    model: 'perplexity',
    raw_response: text.slice(0, 2000),
    ...parseResponse(text, brand.name, brand.domain)
  };
}

async function checkGemini(prompt, brand) {
  if (!process.env.GOOGLE_GEMINI_API_KEY) return mockResult(prompt, brand, 'gemini');

  const response = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${process.env.GOOGLE_GEMINI_API_KEY}`,
    {
      contents: [{ parts: [{ text: `${SYSTEM_PROMPT}\n\nUser: ${prompt}` }] }],
      generationConfig: { maxOutputTokens: 1000, temperature: 0.7 }
    }
  );

  const text = response.data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return {
    model: 'gemini',
    raw_response: text.slice(0, 2000),
    ...parseResponse(text, brand.name, brand.domain)
  };
}

/** Fallback for when API key not set — returns a mock result for testing */
function mockResult(prompt, brand, model) {
  logger.warn(`[${model}] No API key — returning mock result`);
  return {
    model,
    raw_response: `[MOCK — ${model} not configured] This would be a real response about ${prompt}`,
    is_cited: false,
    citation_strength: 'absent',
    citation_snippet: null,
    competitors_cited: []
  };
}

// ── Delay helper ──────────────────────────────────────────────
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// ── Public API ────────────────────────────────────────────────

/**
 * Check a single prompt against a single model.
 *
 * @param {string} promptText  - The search query to test
 * @param {Object} brand       - { name, domain }
 * @param {string} model       - 'chatgpt' | 'perplexity' | 'gemini' | 'claude'
 * @returns {Promise<CheckResult>}
 */
async function checkPromptOnModel(promptText, brand, model) {
  const startTime = Date.now();
  try {
    let result;
    switch (model) {
      case 'chatgpt':    result = await checkChatGPT(promptText, brand); break;
      case 'perplexity': result = await checkPerplexity(promptText, brand); break;
      case 'gemini':     result = await checkGemini(promptText, brand); break;
      case 'claude':     result = await checkClaude(promptText, brand); break;
      default: throw new Error(`Unknown model: ${model}`);
    }

    const duration = Date.now() - startTime;
    logger.debug(`[${model}] "${promptText.slice(0, 50)}..." → cited=${result.is_cited} (${duration}ms)`);
    return { ...result, check_error: null };

  } catch (err) {
    const duration = Date.now() - startTime;
    logger.error(`[${model}] Check failed (${duration}ms): ${err.message}`);
    return {
      model,
      is_cited: false,
      citation_strength: 'absent',
      citation_snippet: null,
      competitors_cited: [],
      raw_response: null,
      check_error: err.message
    };
  }
}

/**
 * Check a single prompt across ALL configured models.
 * Returns an array of CheckResults, one per model.
 *
 * @param {string} promptText
 * @param {Object} brand      - { name, domain }
 * @param {string[]} models   - defaults to all 4
 * @param {number} delayMs    - ms between model calls (rate limiting)
 */
async function checkPromptAllModels(
  promptText,
  brand,
  models = ['chatgpt', 'perplexity', 'gemini', 'claude'],
  delayMs = parseInt(process.env.LLM_DELAY_MS || '500')
) {
  const results = [];
  for (const model of models) {
    const result = await checkPromptOnModel(promptText, brand, model);
    results.push(result);
    if (delayMs > 0 && model !== models[models.length - 1]) {
      await delay(delayMs);
    }
  }
  return results;
}

module.exports = {
  checkPromptOnModel,
  checkPromptAllModels,
  parseResponse  // exported for testing
};
