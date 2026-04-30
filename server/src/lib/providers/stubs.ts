import type { Platform } from '@cited/shared'
import { env } from '../../env.js'
import type { LLMProvider } from './types.js'
import { unavailableResult } from './types.js'

// Stubs for providers we haven't wired yet. They report `available: false` so
// the dashboard can render an honest "not yet connected" state instead of
// faking citations. Drop in a real implementation here when the API key arrives.

class StubProvider implements LLMProvider {
  readonly model = ''
  readonly available: boolean
  constructor(
    public readonly platform: Platform,
    keyPresent: boolean,
  ) {
    this.available = false
    void keyPresent
  }
  async ask() {
    return unavailableResult(this.platform)
  }
}

export const openAIProvider: LLMProvider = new StubProvider(
  'chatgpt',
  Boolean(env.OPENAI_API_KEY),
)
export const perplexityProvider: LLMProvider = new StubProvider(
  'perplexity',
  Boolean(env.PERPLEXITY_API_KEY),
)
export const geminiProvider: LLMProvider = new StubProvider(
  'gemini',
  Boolean(env.GOOGLE_API_KEY),
)
