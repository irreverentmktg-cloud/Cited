/**
 * POST /api/analyze
 * Landing page hero flow. Scrapes a URL + runs 5 preview prompts.
 * Creates a url_analyses row in Supabase.
 * Returns: { analysis_id, brand, preview_score, preview_results }
 */

require('dotenv').config();
const express  = require('express');
const router   = express.Router();
const { scrapeBrand, normalizeDomain } = require('../services/scraper');
const { generatePrompts }   = require('../services/promptGenerator');
const { checkPromptAllModels } = require('../services/llmEngine');
const { calculateScores, getScoreTier } = require('../services/scoreCalculator');
const { supabase } = require('../lib/supabase');
const logger = require('../lib/logger');

router.post('/', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'url is required' });

  const domain = normalizeDomain(url);
  logger.info(`/api/analyze — ${domain}`);

  try {
    // 1. Scrape
    const brand = await scrapeBrand(domain);

    // 2. Generate 5 preview prompts (fast, not the full 50)
    const prompts = await generatePrompts(brand, 5);

    // 3. Check across all models (chatgpt + perplexity only for speed)
    const previewModels = ['chatgpt', 'perplexity'];
    const allResults = [];
    for (const prompt of prompts) {
      const results = await checkPromptAllModels(prompt.prompt_text, brand, previewModels, 300);
      allResults.push(...results.map(r => ({
        ...r,
        prompt_text: prompt.prompt_text,
        category:    prompt.category
      })));
    }

    // 4. Score
    const scores   = calculateScores(allResults.map((r, i) => ({ ...r, prompt_id: String(i) })));
    const tier     = getScoreTier(scores.overall_score);

    // 5. Persist to url_analyses
    let analysisId = `local-${Date.now()}`;
    if (supabase) {
      const { data, error } = await supabase
        .from('url_analyses')
        .insert({
          domain,
          scraped_name:         brand.name,
          scraped_category:     brand.category,
          scraped_product_type: brand.product_type,
          scraped_primary_claim: brand.primary_claim,
          scraped_target_buyer:  brand.target_buyer,
          scraped_raw:           brand.scraped_content,
          preview_score:         scores.overall_score,
          preview_prompts_checked: scores.prompts_checked,
          preview_prompts_cited:   scores.prompts_cited,
          preview_results:       allResults.map(r => ({
            prompt: r.prompt_text,
            model:  r.model,
            is_cited: r.is_cited,
            snippet:  r.citation_snippet
          }))
        })
        .select('id')
        .single();

      if (!error && data) analysisId = data.id;
    }

    res.json({
      analysis_id:    analysisId,
      domain,
      brand: {
        name:             brand.name,
        category:         brand.category,
        product_type:     brand.product_type,
        primary_claim:    brand.primary_claim,
        target_buyer:     brand.target_buyer,
        price_position:   brand.price_position,
        key_differentiator: brand.key_differentiator
      },
      preview_score:  scores.overall_score,
      score_tier:     tier,
      prompts_checked: scores.prompts_checked,
      prompts_cited:   scores.prompts_cited,
      preview_results: allResults.map(r => ({
        prompt:   r.prompt_text,
        model:    r.model,
        is_cited: r.is_cited,
        snippet:  r.citation_snippet
      }))
    });

  } catch (err) {
    logger.error(`/api/analyze failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
