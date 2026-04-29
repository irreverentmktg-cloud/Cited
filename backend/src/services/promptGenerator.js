/**
 * promptGenerator.js
 * ─────────────────────────────────────────────────────────────
 * Generates 50 relevant prompts for a brand based on its
 * calibrated metadata. Uses GPT-4 to generate category-specific
 * prompts, supplemented by universal templates.
 *
 * Prompt categories:
 *   - Category queries (generic "best X for Y" — most valuable)
 *   - Use case queries ("what helps with joint pain?")
 *   - Comparison queries ("X vs Y")
 *   - Ingredient/feature queries ("best collagen with X")
 *   - Branded queries (include brand name — easier wins)
 * ─────────────────────────────────────────────────────────────
 */

require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const OpenAI    = require('openai');
const logger    = require('../lib/logger');

// Prefer Claude, fall back to GPT-4
const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

/**
 * Generate prompts for a brand using GPT-4.
 *
 * @param {Object} brand - { name, domain, category, product_type, primary_claim, target_buyer, price_position, key_differentiator }
 * @param {number} count - Number of prompts to generate (default 50)
 * @returns {Promise<Prompt[]>}
 */
async function generatePrompts(brand, count = 50) {
  if (!anthropic && !openai) {
    logger.warn('No AI client configured — returning template prompts');
    return generateTemplatePrompts(brand, count);
  }

  const systemPrompt = `You are an expert in Answer Engine Optimization (AEO).
Your job is to generate the most valuable search prompts a real consumer would type into ChatGPT,
Perplexity, or Gemini when looking for products like the one described.
Return ONLY a JSON object with a "prompts" array. No other text.`;

  const userPrompt = `Generate ${count} search prompts for this brand:

Brand: ${brand.name}
Domain: ${brand.domain}
Category: ${brand.category}
Product type: ${brand.product_type}
Primary claim: ${brand.primary_claim}
Target buyer: ${brand.target_buyer}
Price position: ${brand.price_position}
Key differentiator: ${brand.key_differentiator}

Return a JSON object: { "prompts": [...] }
Each prompt object has:
- "prompt_text": the exact search query (conversational, as a real user would type it)
- "category": one of ["Category", "Use Case", "Comparison", "Ingredient/Feature", "Branded", "Problem/Solution"]
- "is_branded": true if the prompt includes the brand name, false otherwise
- "opportunity_score": 0-100 (how valuable it would be for this brand to win this prompt)

Mix: 15 Category, 12 Use Case, 8 Comparison, 8 Ingredient/Feature, 5 Branded, 12 Misc.
Order by opportunity_score descending.`;

  try {
    let content;

    if (anthropic) {
      logger.debug(`Using Claude for prompt generation (${brand.name})`);
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      });
      content = response.content[0]?.text || '';
      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found in Claude response');
      content = jsonMatch[0];
    } else {
      logger.debug(`Using GPT-4 for prompt generation (${brand.name})`);
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.8
      });
      content = response.choices[0]?.message?.content;
    }

    const parsed = JSON.parse(content);
    const prompts = parsed.prompts || parsed;
    if (!Array.isArray(prompts)) throw new Error('Expected prompts array');

    logger.info(`Generated ${prompts.length} prompts for ${brand.name}`);
    return prompts.slice(0, count);

  } catch (err) {
    logger.error(`Prompt generation failed: ${err.message} — falling back to templates`);
    return generateTemplatePrompts(brand, count);
  }
}

/**
 * Template-based fallback prompt generator.
 * Used when OpenAI is not configured or generation fails.
 */
function generateTemplatePrompts(brand, count = 50) {
  const { name, category = 'supplement', product_type = 'product',
          primary_claim = 'health benefits', target_buyer = 'adults',
          key_differentiator = 'high quality' } = brand;

  const templates = [
    // Category
    { t: `best ${product_type}`,                              cat: 'Category',          score: 90 },
    { t: `best ${category} for ${target_buyer}`,              cat: 'Category',          score: 88 },
    { t: `top rated ${product_type} brands`,                  cat: 'Category',          score: 85 },
    { t: `highest quality ${product_type}`,                   cat: 'Category',          score: 82 },
    { t: `best ${product_type} to buy`,                       cat: 'Category',          score: 80 },
    { t: `recommended ${category} brands`,                    cat: 'Category',          score: 78 },
    { t: `${product_type} that actually works`,               cat: 'Category',          score: 76 },
    // Use case
    { t: `what ${product_type} is good for ${primary_claim}`, cat: 'Use Case',          score: 85 },
    { t: `${product_type} for ${primary_claim}`,              cat: 'Use Case',          score: 83 },
    { t: `best ${category} to improve ${primary_claim}`,      cat: 'Use Case',          score: 80 },
    { t: `does ${product_type} help with ${primary_claim}`,   cat: 'Use Case',          score: 72 },
    // Comparison
    { t: `${product_type} vs ${product_type} powder`,         cat: 'Comparison',        score: 75 },
    { t: `best ${category} brand comparison`,                 cat: 'Comparison',        score: 73 },
    // Ingredient/feature
    { t: `${product_type} with ${key_differentiator}`,        cat: 'Ingredient/Feature', score: 70 },
    { t: `${key_differentiator} ${product_type}`,             cat: 'Ingredient/Feature', score: 68 },
    // Branded
    { t: `is ${name} good`,                                   cat: 'Branded',           score: 65, is_branded: true },
    { t: `${name} review`,                                    cat: 'Branded',           score: 60, is_branded: true },
    { t: `${name} ${product_type}`,                           cat: 'Branded',           score: 55, is_branded: true },
    // Problem/solution
    { t: `how to improve ${primary_claim} naturally`,         cat: 'Problem/Solution',  score: 74 },
    { t: `natural ways to support ${primary_claim}`,          cat: 'Problem/Solution',  score: 72 },
  ];

  return templates.slice(0, count).map((t, i) => ({
    prompt_text:      t.t,
    category:         t.cat,
    is_branded:       t.is_branded || false,
    opportunity_score: t.score - i * 0.5  // slight decay for ordering
  }));
}

module.exports = { generatePrompts, generateTemplatePrompts };
