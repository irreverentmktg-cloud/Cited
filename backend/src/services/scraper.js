/**
 * scraper.js
 * ─────────────────────────────────────────────────────────────
 * Scrapes a brand's website and extracts structured metadata
 * used for onboarding calibration and prompt generation.
 *
 * Returns:
 *   { name, domain, category, product_type, primary_claim,
 *     target_buyer, price_position, key_differentiator,
 *     raw: { title, meta_desc, headings, body_excerpt } }
 * ─────────────────────────────────────────────────────────────
 */

require('dotenv').config();
const axios      = require('axios');
const cheerio    = require('cheerio');
const Anthropic  = require('@anthropic-ai/sdk');
const OpenAI     = require('openai');
const logger     = require('../lib/logger');

// Prefer Anthropic (Claude) for extraction — falls back to OpenAI if only that key is set
const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

/**
 * Normalize a domain string (strip protocol, www, trailing slash).
 */
function normalizeDomain(input) {
  return input
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
    .toLowerCase()
    .trim();
}

/**
 * Fetch and parse raw content from a URL.
 */
async function fetchSiteContent(domain) {
  const url = `https://www.${domain}`;
  const response = await axios.get(url, {
    timeout: 10000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; Cited-Bot/1.0; +https://cited.io/bot)',
      'Accept': 'text/html,application/xhtml+xml'
    },
    maxRedirects: 5
  });

  const $ = cheerio.load(response.data);

  // Remove noise
  $('script, style, nav, footer, header, .cookie-banner, #cookie-notice').remove();

  const title = $('title').text().trim();
  const metaDesc = $('meta[name="description"]').attr('content') ||
                   $('meta[property="og:description"]').attr('content') || '';
  const headings = $('h1, h2, h3')
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(h => h.length > 5 && h.length < 200)
    .slice(0, 15);

  // Body text — main content area
  const bodyText = $('main, article, .product-description, .product-content, body')
    .first()
    .text()
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 3000);

  return { title, metaDesc, headings, bodyText };
}

/**
 * Extract brand metadata using whichever AI client is available.
 * Priority: Anthropic (Claude) → OpenAI (GPT-4) → fallback heuristic
 */
async function extractMetadataWithAI(domain, raw) {
  const extractionPrompt = `You are extracting structured metadata from a DTC brand website.
Analyze the following scraped content and return ONLY a JSON object with these exact fields:

{
  "name": "Brand name (short, clean)",
  "category": "Product category (e.g. 'Marine Collagen Supplement')",
  "product_type": "Specific product type (e.g. 'Collagen peptide powder')",
  "primary_claim": "Main health/benefit claim (e.g. 'Joint health & skin elasticity')",
  "target_buyer": "Target customer (e.g. 'Women 35-55 focused on wellness')",
  "price_position": "One of: Budget/Value, Mid-range, Premium, Luxury",
  "key_differentiator": "What makes them different (e.g. 'Grass-fed, hydrolyzed, unflavored')"
}

Website domain: ${domain}
Page title: ${raw.title}
Meta description: ${raw.metaDesc}
Headings: ${raw.headings.join(' | ')}
Body excerpt: ${raw.bodyText.slice(0, 1500)}

Return only valid JSON. No explanation.`;

  // Try Claude first
  if (anthropic) {
    logger.debug('Using Claude for metadata extraction');
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',  // fast + cheap for extraction
      max_tokens: 500,
      messages: [{ role: 'user', content: extractionPrompt }]
    });
    const text = response.content[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  }

  // Fall back to OpenAI
  if (openai) {
    logger.debug('Using GPT-4 for metadata extraction');
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: extractionPrompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3
    });
    return JSON.parse(response.choices[0]?.message?.content);
  }

  // No AI available
  logger.warn('No AI client configured — using heuristic fallback');
  return fallbackMetadata(domain, raw);
}

/**
 * Simple fallback when GPT is unavailable.
 */
function fallbackMetadata(domain, raw) {
  return {
    name: raw.title.split(/[-|·]/)[0].trim() || domain.split('.')[0],
    category: 'Product',
    product_type: 'Consumer product',
    primary_claim: raw.metaDesc.slice(0, 100) || 'Health and wellness',
    target_buyer: 'General consumers',
    price_position: 'Mid-range',
    key_differentiator: raw.headings[0] || 'Quality ingredients'
  };
}

/**
 * Main scrape function — the one called by the API route.
 *
 * @param {string} inputUrl - e.g. "bloom-collagen.com" or "https://www.bloom-collagen.com"
 * @returns {Promise<ScrapedBrand>}
 */
async function scrapeBrand(inputUrl) {
  const domain = normalizeDomain(inputUrl);
  logger.info(`Scraping ${domain}...`);

  let raw;
  try {
    raw = await fetchSiteContent(domain);
    logger.debug(`Fetched ${domain}: title="${raw.title}", ${raw.headings.length} headings`);
  } catch (err) {
    logger.error(`Failed to fetch ${domain}: ${err.message}`);
    throw new Error(`Could not reach ${domain}. Please check the URL and try again.`);
  }

  let metadata;
  try {
    metadata = await extractMetadataWithAI(domain, raw);
  } catch (err) {
    logger.error(`Metadata extraction failed: ${err.message} — using fallback`);
    metadata = fallbackMetadata(domain, raw);
  }

  return {
    domain,
    ...metadata,
    scraped_content: {
      title:        raw.title,
      meta_desc:    raw.metaDesc,
      headings:     raw.headings,
      body_excerpt: raw.bodyText.slice(0, 500)
    }
  };
}

module.exports = { scrapeBrand, normalizeDomain };
