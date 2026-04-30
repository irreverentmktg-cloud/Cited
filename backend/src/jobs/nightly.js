/**
 * nightly.js
 * ─────────────────────────────────────────────────────────────
 * The main daily job. Runs at 2am UTC via Railway cron.
 * Can also be triggered manually: `npm run nightly`
 *
 * Flow:
 *   1. Fetch all active brands from Supabase
 *   2. For each brand → fetch active prompts
 *   3. For each prompt × model → checkPromptOnModel()
 *   4. Write results to prompt_checks
 *   5. Calculate brand_scores for today
 *   6. Update competitor stats
 *   7. Select daily_priority_prompt
 *   8. Create alerts for notable changes
 *   9. Log job completion to job_runs
 * ─────────────────────────────────────────────────────────────
 */

require('dotenv').config();
const pLimit = require('p-limit');
const { supabase } = require('../lib/supabase');
const { checkPromptOnModel } = require('../services/llmEngine');
const { calculateScores, getScoreTier, calculateDelta } = require('../services/scoreCalculator');
const logger = require('../lib/logger');

const MODELS = ['chatgpt', 'perplexity', 'gemini', 'claude'];
const BRAND_CONCURRENCY = parseInt(process.env.JOB_BRAND_CONCURRENCY || '3');
const LLM_CONCURRENCY   = parseInt(process.env.LLM_CONCURRENCY || '5');
const TODAY = new Date().toISOString().split('T')[0];

// ── Helpers ───────────────────────────────────────────────────

function makeJobId() {
  const now = new Date();
  return `run_${now.toISOString().replace(/[-:T]/g, '').slice(0, 12)}`;
}

async function dbInsert(table, rows) {
  if (!supabase) { logger.debug(`[DRY RUN] Would insert ${rows.length} rows into ${table}`); return; }
  const { error } = await supabase.from(table).insert(rows);
  if (error) logger.error(`Insert ${table} failed: ${error.message}`);
}

async function dbUpsert(table, rows, onConflict) {
  if (!supabase) { logger.debug(`[DRY RUN] Would upsert ${rows.length} rows into ${table}`); return; }
  const { error } = await supabase.from(table).upsert(rows, { onConflict });
  if (error) logger.error(`Upsert ${table} failed: ${error.message}`);
}

// ── Core: process one brand ───────────────────────────────────

async function processBrand(brand, jobId) {
  logger.info(`▶ Processing brand: ${brand.name} (${brand.domain})`);
  const llmLimit = pLimit(LLM_CONCURRENCY);

  // 1. Fetch active prompts
  let prompts = [];
  if (supabase) {
    const { data, error } = await supabase
      .from('prompts')
      .select('id, prompt_text, category, is_branded')
      .eq('brand_id', brand.id)
      .eq('status', 'active');
    if (error) { logger.error(`Failed to fetch prompts for ${brand.name}: ${error.message}`); return; }
    prompts = data || [];
  } else {
    // Dry run: use sample prompts
    prompts = [
      { id: 'sample-1', prompt_text: `best ${brand.category || 'collagen supplement'}`, category: 'Category' },
      { id: 'sample-2', prompt_text: `is ${brand.name} good`, category: 'Branded', is_branded: true },
    ];
  }

  if (prompts.length === 0) {
    logger.warn(`No active prompts for ${brand.name} — skipping`);
    return;
  }

  logger.info(`  ${prompts.length} prompts × ${MODELS.length} models = ${prompts.length * MODELS.length} checks`);

  // 2. Fire all checks concurrently (respecting LLM_CONCURRENCY)
  const checkTasks = [];
  for (const prompt of prompts) {
    for (const model of MODELS) {
      checkTasks.push(llmLimit(async () => {
        const result = await checkPromptOnModel(prompt.prompt_text, brand, model);
        return {
          prompt_id:         prompt.id,
          brand_id:          brand.id,
          model,
          is_cited:          result.is_cited,
          citation_strength: result.citation_strength,
          citation_snippet:  result.citation_snippet,
          raw_response:      result.raw_response,
          competitors_cited: result.competitors_cited,
          check_error:       result.check_error,
          job_id:            jobId,
          checked_at:        new Date().toISOString()
        };
      }));
    }
  }

  const checkResults = await Promise.all(checkTasks);
  const succeeded = checkResults.filter(r => !r.check_error).length;
  const failed    = checkResults.filter(r =>  r.check_error).length;
  logger.info(`  ✓ ${succeeded} checks completed, ${failed} failed`);

  // 3. Write prompt_checks to DB
  await dbUpsert('prompt_checks', checkResults,
    'prompt_id,model,(DATE(checked_at))');

  // 4. Calculate scores
  const enrichedChecks = checkResults.map(c => ({
    ...c,
    prompt_text: prompts.find(p => p.id === c.prompt_id)?.prompt_text
  }));
  const scores = calculateScores(enrichedChecks);
  const tier = getScoreTier(scores.overall_score);
  logger.info(`  Score: ${scores.overall_score}/100 (${tier.label})`);

  // 5. Get previous score for delta
  let previousScore = null;
  if (supabase) {
    const { data } = await supabase
      .from('brand_scores')
      .select('overall_score')
      .eq('brand_id', brand.id)
      .lt('score_date', TODAY)
      .order('score_date', { ascending: false })
      .limit(1)
      .single();
    previousScore = data?.overall_score ?? null;
  }

  const delta = calculateDelta(scores.overall_score, previousScore);

  await dbUpsert('brand_scores', [{
    brand_id:         brand.id,
    score_date:       TODAY,
    ...scores,
    score_delta:      delta
  }], 'brand_id,score_date');

  // 6. Update competitor stats from check results
  await updateCompetitors(brand, checkResults);

  // 7. Select daily priority prompt
  await selectDailyPriorityPrompt(brand, prompts, checkResults);

  // 8. Create alerts for notable changes
  await createAlerts(brand, scores, delta, checkResults, previousScore);

  return { succeeded, failed, scores };
}

// ── Competitor updating ───────────────────────────────────────

async function updateCompetitors(brand, checkResults) {
  const allCompetitors = checkResults
    .flatMap(r => r.competitors_cited || [])
    .filter(c => c.name);

  // Aggregate by competitor name
  const competitorMap = {};
  for (const comp of allCompetitors) {
    const key = comp.name.toLowerCase();
    if (!competitorMap[key]) {
      competitorMap[key] = { name: comp.name, domain: comp.domain, count: 0 };
    }
    competitorMap[key].count++;
  }

  // Upsert each competitor
  for (const comp of Object.values(competitorMap)) {
    if (comp.count < 2) continue; // only track if seen in 2+ checks

    const rows = [{
      brand_id:    brand.id,
      name:        comp.name,
      domain:      comp.domain,
      prompts_owned: comp.count,
      updated_at:  new Date().toISOString()
    }];
    await dbUpsert('competitors', rows, 'brand_id,domain');
  }
}

// ── Daily priority prompt selection ──────────────────────────

async function selectDailyPriorityPrompt(brand, prompts, checkResults) {
  // Find prompts where brand NOT cited but competitors ARE cited
  const citedPromptIds = new Set(
    checkResults.filter(c => c.is_cited).map(c => c.prompt_id)
  );
  const competitorCitedPromptIds = new Set(
    checkResults
      .filter(c => !c.is_cited && (c.competitors_cited || []).length > 0)
      .map(c => c.prompt_id)
  );

  // Gap prompts: competitor wins, brand loses
  const gapPrompts = prompts.filter(p =>
    !citedPromptIds.has(p.id) && competitorCitedPromptIds.has(p.id)
  );

  if (gapPrompts.length === 0) {
    logger.debug(`  No gap prompts for ${brand.name} today`);
    return;
  }

  // Pick the highest opportunity_score gap prompt
  const priorityPrompt = gapPrompts.reduce((best, p) =>
    (p.opportunity_score || 0) > (best.opportunity_score || 0) ? p : best
  );

  await dbUpsert('daily_priority_prompts', [{
    brand_id:           brand.id,
    prompt_id:          priorityPrompt.id,
    priority_date:      TODAY,
    opportunity_score:  priorityPrompt.opportunity_score || 50,
    selection_reason:   'Competitor cited; brand absent. High opportunity gap.',
    recommended_content_type: 'FAQ page or blog post',
    recommendation_text: `Create content directly answering: "${priorityPrompt.prompt_text}". Include your brand name, key claims, and structured data markup.`
  }], 'brand_id,priority_date');

  logger.info(`  Daily prompt: "${priorityPrompt.prompt_text}"`);
}

// ── Alert creation ────────────────────────────────────────────

async function createAlerts(brand, scores, delta, checkResults, previousScore) {
  const alerts = [];

  // Score drop alert
  if (delta <= -5) {
    alerts.push({
      brand_id: brand.id,
      type:     'score_drop',
      title:    `Score dropped ${Math.abs(delta)} points`,
      body:     `Your AI Visibility Score fell from ${previousScore} to ${scores.overall_score}. Check your prompt report for details.`,
      created_at: new Date().toISOString()
    });
  }

  // Score rise alert
  if (delta >= 5) {
    alerts.push({
      brand_id: brand.id,
      type:     'score_rise',
      title:    `Score improved ${delta} points! 🎉`,
      body:     `Your AI Visibility Score rose from ${previousScore} to ${scores.overall_score}.`,
      created_at: new Date().toISOString()
    });
  }

  // New citation alerts (cited checks with recent timestamp)
  const newCitations = checkResults.filter(c => c.is_cited && c.citation_strength === 'primary');
  if (newCitations.length > 0) {
    alerts.push({
      brand_id: brand.id,
      type:     'citation_gained',
      model:    newCitations[0].model,
      title:    `You were cited in ${newCitations[0].model}`,
      body:     newCitations[0].citation_snippet || 'Your brand appeared as a primary recommendation.',
      created_at: new Date().toISOString()
    });
  }

  if (alerts.length > 0) {
    await dbInsert('alerts', alerts);
    logger.info(`  Created ${alerts.length} alerts`);
  }
}

// ── Main runner ───────────────────────────────────────────────

async function runNightlyJob() {
  const jobId = makeJobId();
  const startTime = Date.now();
  logger.info(`\n${'═'.repeat(60)}`);
  logger.info(`🌙 CITED NIGHTLY JOB STARTED — ${jobId}`);
  logger.info(`${'═'.repeat(60)}\n`);

  // Log job start
  await dbInsert('job_runs', [{
    id:         jobId,
    run_type:   'nightly',
    started_at: new Date().toISOString(),
    status:     'running'
  }]);

  let brands = [];

  if (supabase) {
    const { data, error } = await supabase
      .from('brands')
      .select('id, name, domain, category, product_type, primary_claim, target_buyer')
      .eq('is_active', true)
      .eq('calibration_confirmed', true);

    if (error) {
      logger.error(`Failed to fetch brands: ${error.message}`);
      return;
    }
    brands = data || [];
  } else {
    // Dry run with sample brand
    logger.warn('⚠️  No Supabase configured — running DRY RUN with sample brand');
    brands = [{
      id:           'sample-brand-id',
      name:         'Athletic Greens',
      domain:       'athleticgreens.com',
      category:     'Greens Supplement',
      product_type: 'Daily greens powder',
      primary_claim: 'Comprehensive daily nutrition',
      target_buyer:  'Health-conscious adults 25-45'
    }];
  }

  logger.info(`Processing ${brands.length} active brand(s)...\n`);

  const brandLimit = pLimit(BRAND_CONCURRENCY);
  let totalSucceeded = 0;
  let totalFailed    = 0;
  let brandsProcessed = 0;

  const brandResults = await Promise.all(
    brands.map(brand => brandLimit(async () => {
      try {
        const result = await processBrand(brand, jobId);
        brandsProcessed++;
        totalSucceeded += result?.succeeded || 0;
        totalFailed    += result?.failed    || 0;
        return result;
      } catch (err) {
        logger.error(`Brand ${brand.name} failed: ${err.message}`);
        return null;
      }
    }))
  );

  const duration = Math.round((Date.now() - startTime) / 1000);

  // Update job_runs with completion stats
  if (supabase) {
    await supabase.from('job_runs').update({
      completed_at:      new Date().toISOString(),
      brands_processed:  brandsProcessed,
      prompts_checked:   totalSucceeded + totalFailed,
      checks_succeeded:  totalSucceeded,
      checks_failed:     totalFailed,
      status:            totalFailed === 0 ? 'completed' : 'partial'
    }).eq('id', jobId);
  }

  logger.info(`\n${'═'.repeat(60)}`);
  logger.info(`✅ NIGHTLY JOB COMPLETE — ${duration}s`);
  logger.info(`   Brands: ${brandsProcessed} | Checks: ${totalSucceeded + totalFailed} | Errors: ${totalFailed}`);
  logger.info(`${'═'.repeat(60)}\n`);
}

// ── Entry point ───────────────────────────────────────────────
// Run directly: node src/jobs/nightly.js
// Or imported by scheduler.js for cron scheduling

if (require.main === module) {
  runNightlyJob().catch(err => {
    logger.error(`Fatal job error: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { runNightlyJob };
