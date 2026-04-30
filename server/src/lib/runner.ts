import type {
  Brand,
  Platform,
  Prompt,
  PromptRun,
  PromptWithStatus,
  ScoreSnapshot,
} from '@cited/shared'
import { PLATFORMS } from '@cited/shared'
import { repo } from '../db/repo.js'
import { extractCitation } from './extract.js'
import { providers } from './providers/index.js'
import { recommendContent } from './recommend.js'
import { buildSnapshot, opportunityScore } from './score.js'

const CONCURRENCY = 8

const activeBrands = new Set<string>()

export function isCycleActive(brandId: string): boolean {
  return activeBrands.has(brandId)
}

// Seed a `pending` run for every (prompt, available-platform) pair so the
// dashboard can render the full prompt grid immediately while real results
// stream in. Idempotent — recordRun upserts on (prompt, platform, run_day).
export async function seedPendingRuns(prompts: Prompt[]): Promise<void> {
  const r = repo()
  const now = new Date().toISOString()
  const writes: Promise<unknown>[] = []
  for (const prompt of prompts) {
    for (const platform of PLATFORMS) {
      const provider = providers[platform]
      if (!provider.available) continue
      writes.push(
        r.recordRun({
          promptId: prompt.id,
          platform,
          model: provider.model,
          status: 'pending',
          rank: null,
          competitors: [],
          recommendedContent: null,
          rawAnswer: null,
          ranAt: now,
        }),
      )
    }
  }
  await Promise.all(writes)
}

// Fire-and-forget cycle starter. Safe to call repeatedly: returns false (and
// does nothing) if a cycle is already in flight for this brand. Errors inside
// the cycle are logged but never propagate — the caller has already returned.
export function startScoreCycle(brand: Brand): boolean {
  if (activeBrands.has(brand.id)) return false
  activeBrands.add(brand.id)
  void runScoreCycle(brand)
    .catch((err) => {
      console.error(`[runScoreCycle ${brand.id}]`, err)
    })
    .finally(() => {
      activeBrands.delete(brand.id)
    })
  return true
}

// Run every prompt for a brand against every available provider, write results
// as they land, then snapshot a daily score. Prompts run with bounded
// concurrency so 50-prompt cycles finish in 1-3 min instead of 10-25 min.
//
// Per-prompt-per-provider flow:
//   1. provider.ask() — expensive call (web-search Opus), returns raw answer
//   2. extractCitation() — cheap Sonnet call, structured citation verdict
//   3. recordRun() — persist with both raw answer and extracted fields
// Step 2 replaces the older regex-based detectCitation. Extraction failures
// degrade gracefully to "not cited" rather than failing the whole cycle.
export async function runScoreCycle(brand: Brand): Promise<{
  snapshot: ScoreSnapshot
  prompts: PromptWithStatus[]
}> {
  const r = repo()
  const prompts = await r.listPrompts(brand.id)

  await seedPendingRuns(prompts)

  const promptResults: PromptWithStatus[] = await runWithConcurrency(
    prompts,
    CONCURRENCY,
    async (prompt) => {
      const runs = emptyRunsMap()

      for (const platform of PLATFORMS) {
        const provider = providers[platform]
        if (!provider.available) {
          runs[platform] = null
          continue
        }
        try {
          const result = await provider.ask(prompt.text)
          const extracted = await safeExtract(brand, result.answer)
          const recommended = await safeRecommend({
            brand,
            prompt: prompt.text,
            answer: result.answer ?? '',
            cited: extracted.cited,
            rank: extracted.rank,
            competitors: extracted.competitorBrands,
          })
          runs[platform] = await r.recordRun({
            promptId: prompt.id,
            platform,
            model: result.model,
            status: extracted.cited ? 'cited' : 'not-cited',
            rank: extracted.rank,
            competitors: extracted.competitorBrands,
            recommendedContent: recommended,
            rawAnswer: result.answer,
            ranAt: result.ranAt,
          })
        } catch (err) {
          runs[platform] = await r.recordRun({
            promptId: prompt.id,
            platform,
            model: provider.model,
            status: 'error',
            rank: null,
            competitors: [],
            recommendedContent: null,
            rawAnswer: err instanceof Error ? err.message : String(err),
            ranAt: new Date().toISOString(),
          })
        }
      }

      return {
        prompt,
        runs,
        opportunityScore: opportunityScore(runs),
      }
    },
  )

  const snapshot = buildSnapshot(promptResults, 0)
  await r.recordScore(brand.id, snapshot)

  return { snapshot, prompts: promptResults }
}

// Extraction is best-effort: a single failed Sonnet call shouldn't tank a
// whole 50-prompt cycle. Logs and falls back to "not cited" / no competitors.
async function safeExtract(brand: Brand, answer: string | null) {
  if (!answer) return { cited: false, rank: null, competitorBrands: [] }
  try {
    return await extractCitation(brand, answer)
  } catch (err) {
    console.error('[extractCitation]', err instanceof Error ? err.message : err)
    return { cited: false, rank: null, competitorBrands: [] }
  }
}

// Recommendation is also best-effort. If it fails, the dashboard's UI falls
// back to its hardcoded template — better than killing the cycle.
async function safeRecommend(input: Parameters<typeof recommendContent>[0]) {
  if (!input.answer.trim()) return null
  try {
    return await recommendContent(input)
  } catch (err) {
    console.error('[recommendContent]', err instanceof Error ? err.message : err)
    return null
  }
}

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  const runners = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (true) {
        const i = next++
        if (i >= items.length) return
        results[i] = await worker(items[i])
      }
    },
  )
  await Promise.all(runners)
  return results
}

function emptyRunsMap(): Record<Platform, PromptRun | null> {
  return {
    claude: null,
    chatgpt: null,
    perplexity: null,
    gemini: null,
  }
}
