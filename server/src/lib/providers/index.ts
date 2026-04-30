import type { Platform } from '@cited/shared'
import { ClaudeProvider } from './claude.js'
import {
  geminiProvider,
  openAIProvider,
  perplexityProvider,
} from './stubs.js'
import type { LLMProvider } from './types.js'

const claudeProvider = new ClaudeProvider()

export const providers: Record<Platform, LLMProvider> = {
  claude: claudeProvider,
  chatgpt: openAIProvider,
  perplexity: perplexityProvider,
  gemini: geminiProvider,
}

export function listAvailable(): Platform[] {
  return (Object.keys(providers) as Platform[]).filter(
    (p) => providers[p].available,
  )
}
