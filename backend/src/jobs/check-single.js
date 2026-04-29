/**
 * check-single.js
 * ─────────────────────────────────────────────────────────────
 * Run a quick visibility check on any brand from the CLI.
 * No database required — outputs results directly to console.
 *
 * Usage:
 *   npm run check -- --domain bloom-collagen.com
 *   npm run check -- --domain athletic-greens.com --models chatgpt,perplexity
 *   npm run check -- --domain vital-proteins.com --prompts 3
 * ─────────────────────────────────────────────────────────────
 */

require('dotenv').config();
const { scrapeBrand }       = require('../services/scraper');
const { generatePrompts }   = require('../services/promptGenerator');
const { checkPromptAllModels } = require('../services/llmEngine');
const { calculateScores, getScoreTier } = require('../services/scoreCalculator');
const logger = require('../lib/logger');

// ── Parse CLI args ────────────────────────────────────────────
const args = process.argv.slice(2).reduce((acc, arg, i, arr) => {
  if (arg.startsWith('--')) acc[arg.slice(2)] = arr[i + 1] || true;
  return acc;
}, {});

const domain       = args.domain || args.d || 'vital-proteins.com';
const promptCount  = parseInt(args.prompts || args.p || '5');
const modelFilter  = args.models ? args.models.split(',') : ['chatgpt', 'perplexity', 'gemini', 'claude'];

async function main() {
  console.log('\n' + '═'.repeat(60));
  console.log(`🔍 CITED — Quick Brand Check`);
  console.log(`   Domain:  ${domain}`);
  console.log(`   Prompts: ${promptCount}`);
  console.log(`   Models:  ${modelFilter.join(', ')}`);
  console.log('═'.repeat(60) + '\n');

  // Step 1: Scrape
  console.log('📡 Step 1/3 — Scraping site...');
  let brand;
  try {
    brand = await scrapeBrand(domain);
    console.log(`   ✓ Found: ${brand.name}`);
    console.log(`   Category: ${brand.category}`);
    console.log(`   Product:  ${brand.product_type}`);
    console.log(`   Claim:    ${brand.primary_claim}`);
    console.log(`   Buyer:    ${brand.target_buyer}`);
  } catch (err) {
    console.error(`   ✗ Scrape failed: ${err.message}`);
    console.log('   Continuing with domain as brand name...');
    brand = { name: domain.split('.')[0], domain, category: 'Product', product_type: 'product', primary_claim: 'quality', target_buyer: 'consumers', price_position: 'Mid-range', key_differentiator: 'quality' };
  }

  // Step 2: Generate prompts
  console.log(`\n📝 Step 2/3 — Generating ${promptCount} prompts...`);
  const prompts = await generatePrompts(brand, promptCount);
  console.log(`   ✓ Generated ${prompts.length} prompts`);
  prompts.forEach((p, i) => {
    console.log(`   ${i + 1}. [${p.category}] "${p.prompt_text}" (score: ${Math.round(p.opportunity_score)})`);
  });

  // Step 3: Check each prompt
  console.log(`\n🤖 Step 3/3 — Checking prompts across ${modelFilter.join(', ')}...\n`);
  const allResults = [];

  for (let i = 0; i < prompts.length; i++) {
    const prompt = prompts[i];
    console.log(`Prompt ${i + 1}/${prompts.length}: "${prompt.prompt_text}"`);

    const results = await checkPromptAllModels(
      prompt.prompt_text,
      brand,
      modelFilter,
      500  // 500ms between model calls
    );

    for (const r of results) {
      const icon = r.is_cited ? '✅' : '❌';
      const strength = r.is_cited ? ` (${r.citation_strength})` : '';
      console.log(`  ${icon} ${r.model.padEnd(12)} cited=${r.is_cited}${strength}`);
      if (r.citation_snippet) {
        console.log(`     └─ "${r.citation_snippet.slice(0, 120)}..."`);
      }
      if (r.check_error) {
        console.log(`     └─ Error: ${r.check_error}`);
      }
    }

    allResults.push(...results.map(r => ({
      ...r,
      prompt_id:   `prompt-${i}`,
      prompt_text: prompt.prompt_text
    })));
    console.log('');
  }

  // Step 4: Score summary
  const scores = calculateScores(allResults);
  const tier   = getScoreTier(scores.overall_score);

  console.log('═'.repeat(60));
  console.log(`📊 AI VISIBILITY SCORE: ${scores.overall_score}/100 — ${tier.label.toUpperCase()}`);
  console.log('─'.repeat(60));
  console.log(`ChatGPT:    ${scores.chatgpt_score}/100`);
  console.log(`Perplexity: ${scores.perplexity_score}/100`);
  console.log(`Gemini:     ${scores.gemini_score}/100`);
  console.log(`Claude:     ${scores.claude_score}/100`);
  console.log('─'.repeat(60));
  console.log(`Prompts checked: ${scores.prompts_checked}`);
  console.log(`Prompts cited:   ${scores.prompts_cited}`);
  console.log(`Gaps (not cited): ${scores.gap_count}`);
  console.log('═'.repeat(60) + '\n');

  // Competitor summary
  const allCompetitors = allResults
    .flatMap(r => r.competitors_cited || [])
    .map(c => c.name);
  const competitorCounts = allCompetitors.reduce((acc, name) => {
    acc[name] = (acc[name] || 0) + 1;
    return acc;
  }, {});
  const topCompetitors = Object.entries(competitorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  if (topCompetitors.length > 0) {
    console.log('🏆 Top competitors mentioned in responses:');
    topCompetitors.forEach(([name, count]) => {
      console.log(`   ${name}: mentioned ${count}x`);
    });
    console.log('');
  }
}

main().catch(err => {
  logger.error(`Check failed: ${err.message}`);
  process.exit(1);
});
