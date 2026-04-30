// Shared types between @cited/web and @cited/server.
// Keep this surface tight — it's the API contract.

export type Platform = 'claude' | 'chatgpt' | 'perplexity' | 'gemini'

export const PLATFORMS: readonly Platform[] = [
  'claude',
  'chatgpt',
  'perplexity',
  'gemini',
] as const

export type ScoreBand = 'critical' | 'warning' | 'good'

export function bandFor(score: number): ScoreBand {
  if (score < 40) return 'critical'
  if (score < 70) return 'warning'
  return 'good'
}

export interface Brand {
  id: string
  url: string
  name: string
  category: string
  productType: string
  primaryClaim: string
  targetBuyer: string
  pricePosition: string
  differentiator: string
  createdAt: string
}

export interface CalibrationDraft {
  url: string
  name: string
  category: string
  productType: string
  primaryClaim: string
  targetBuyer: string
  pricePosition: string
  differentiator: string
}

export interface Prompt {
  id: string
  brandId: string
  text: string
  awarenessStage:
    | 'unaware'
    | 'problem-aware'
    | 'solution-aware'
    | 'product-aware'
    | 'most-aware'
  createdAt: string
}

export type CitationStatus = 'cited' | 'not-cited' | 'pending' | 'error'

export interface PromptRun {
  id: string
  promptId: string
  platform: Platform
  // Specific model that produced the run, e.g. "claude-opus-4-7",
  // "claude-sonnet-4-6", "gpt-5", "perplexity-sonar". Lets us compare model
  // versions over time and run controlled A/B tests without losing history.
  model: string
  status: CitationStatus
  rank: number | null
  competitors: string[]
  recommendedContent: string | null
  rawAnswer: string | null
  ranAt: string
}

export interface PromptWithStatus {
  prompt: Prompt
  runs: Record<Platform, PromptRun | null>
  opportunityScore: number
}

export interface ScoreSnapshot {
  score: number
  band: ScoreBand
  promptsChecked: number
  promptsCited: number
  competitorAvg: number
  capturedAt: string
}

export interface AnalyzeRequest {
  url: string
}

export interface AnalyzeResponse {
  draft: CalibrationDraft
}

export interface CreateBrandRequest {
  draft: CalibrationDraft
  confirmedFields: Array<keyof CalibrationDraft>
}

export interface CreateBrandResponse {
  brand: Brand
  initialScore: ScoreSnapshot
}

export type BrandPatch = Partial<Omit<Brand, 'id' | 'createdAt'>>

export interface UpdateBrandRequest {
  patch: BrandPatch
}

export interface UpdateBrandResponse {
  brand: Brand
}

export interface BrandSummary {
  brand: Brand
  current: ScoreSnapshot
  history: ScoreSnapshot[]
}

export interface BrandDetail {
  summary: BrandSummary
  prompts: PromptWithStatus[]
  cycleActive: boolean
}

export interface RefreshResponse {
  started: boolean
  cycleActive: boolean
}

export interface ApiError {
  error: string
  message: string
}
