import type { Platform } from '@cited/shared'

export interface ProviderQueryResult {
  platform: Platform
  // Specific model the provider used (e.g. "claude-opus-4-7", "gpt-5",
  // "perplexity-sonar"). Empty string when unavailable.
  model: string
  available: boolean
  answer: string | null
  citedSources: string[]
  competitorBrands: string[]
  ranAt: string
}

export interface LLMProvider {
  platform: Platform
  // Public so the runner can stamp pending rows with the right model name
  // before the first ask() resolves.
  model: string
  available: boolean
  ask(prompt: string): Promise<ProviderQueryResult>
}

export function unavailableResult(platform: Platform): ProviderQueryResult {
  return {
    platform,
    model: '',
    available: false,
    answer: null,
    citedSources: [],
    competitorBrands: [],
    ranAt: new Date().toISOString(),
  }
}
