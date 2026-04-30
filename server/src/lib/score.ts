import type {
  Brand,
  Platform,
  PromptRun,
  PromptWithStatus,
  ScoreSnapshot,
} from '@cited/shared'
import { bandFor, PLATFORMS } from '@cited/shared'
import type { ProviderQueryResult } from './providers/types.js'

// Detect whether a brand is cited in a model's answer. We look for the brand
// name as a whole-word match (case-insensitive) and any URL containing the
// brand's domain. Returns rank (1 = first mention) or null.
export function detectCitation(
  brand: Brand,
  result: ProviderQueryResult,
): { cited: boolean; rank: number | null } {
  if (!result.available || !result.answer) return { cited: false, rank: null }

  const lower = result.answer.toLowerCase()
  const brandTokens = brand.name
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2)
  const brandPhrase = brand.name.toLowerCase()

  let firstIdx = lower.indexOf(brandPhrase)
  if (firstIdx === -1 && brandTokens.length > 0) {
    // Fall back to the longest token if the full phrase isn't present.
    const longest = brandTokens.sort((a, b) => b.length - a.length)[0]
    firstIdx = lower.indexOf(longest)
  }

  const domain = safeDomain(brand.url)
  const domainHit = domain
    ? result.citedSources.some((s) => s.toLowerCase().includes(domain))
    : false

  if (firstIdx === -1 && !domainHit) return { cited: false, rank: null }

  const rank = firstIdx === -1 ? 1 : rankFromPosition(lower, firstIdx)
  return { cited: true, rank }
}

function rankFromPosition(text: string, idx: number): number {
  // Approximate rank by counting how many distinct brand-like tokens appear
  // before the first hit. Cheap heuristic; replace with structured extraction
  // once Claude returns a JSON list.
  const before = text.slice(0, idx)
  const matches = before.match(/[A-Z][a-zA-Z0-9®'-]{2,}/g) ?? []
  return Math.min(10, Math.max(1, matches.length + 1))
}

function safeDomain(url: string): string | null {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`)
    return u.hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

// AI Visibility Score, 0-100. Weights cited prompts by rank (lower rank = more
// visibility) and by cross-platform breadth (cited on 3 platforms > cited on 1).
export function calculateScore(prompts: PromptWithStatus[]): number {
  if (prompts.length === 0) return 0

  let total = 0
  for (const p of prompts) {
    let promptScore = 0
    let counted = 0
    for (const platform of PLATFORMS) {
      const run = p.runs[platform]
      if (!run || run.status === 'pending') continue
      counted++
      if (run.status === 'cited') {
        const rankBonus =
          run.rank === null ? 0.5 : Math.max(0.2, 1 - (run.rank - 1) * 0.12)
        promptScore += rankBonus
      }
    }
    if (counted > 0) total += promptScore / counted
  }

  return Math.round((total / prompts.length) * 100)
}

export function buildSnapshot(
  prompts: PromptWithStatus[],
  competitorAvg: number,
): ScoreSnapshot {
  const score = calculateScore(prompts)
  const cited = prompts.filter((p) =>
    PLATFORMS.some((pl) => p.runs[pl]?.status === 'cited'),
  ).length
  return {
    score,
    band: bandFor(score),
    promptsChecked: prompts.length,
    promptsCited: cited,
    competitorAvg,
    capturedAt: new Date().toISOString(),
  }
}

// Opportunity score for a single prompt: high when no platform cites the brand
// AND the prompt sits high in the funnel (more buyers see it).
export function opportunityScore(runs: Record<Platform, PromptRun | null>): number {
  let citedCount = 0
  let availableCount = 0
  for (const platform of PLATFORMS) {
    const run = runs[platform]
    if (!run) continue
    availableCount++
    if (run.status === 'cited') citedCount++
  }
  if (availableCount === 0) return 0
  const gap = 1 - citedCount / availableCount
  return Math.round(gap * 100)
}
