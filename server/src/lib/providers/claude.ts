import Anthropic from '@anthropic-ai/sdk'
import { env } from '../../env.js'
import type { LLMProvider, ProviderQueryResult } from './types.js'
import { unavailableResult } from './types.js'

const MODEL = 'claude-opus-4-7'

// Brand-agnostic by design: the whole point of AEO scoring is to measure
// whether the model surfaces a brand on its own, so we don't inject any
// brand context here. The system prompt steers Claude toward the kind of
// concrete, brand-naming answer a real shopper would actually find useful —
// otherwise hedged "there are many options" responses would tank scores
// without reflecting real-world AI behavior.
//
// This block is sent as a cache_control: ephemeral entry. The Anthropic
// prompt cache TTL is 5 min, which covers a full 50-prompt cycle (~1-3 min
// at concurrency=8). After the first call writes the cache, every subsequent
// call in the same cycle reads it at ~10% the input cost.
const SYSTEM_PROMPT = `You are a knowledgeable, helpful AI assistant answering questions for everyday consumers. Your primary tool is web search, which you should use whenever a question would benefit from current, factual, or recommendation-grounded information.

When a user asks a question — especially about products, services, brands, or buying decisions — your job is to give them a complete, useful, conversational answer that they could actually act on.

How to use web search:
- Search when the answer depends on current information, specific products, brand comparisons, prices, availability, or recent reviews.
- Use up to two searches per question. Favor depth over breadth: a single well-formulated query that returns authoritative results is better than three vague ones.
- Prefer reputable sources: brand websites, established review publications, expert blogs in the category, major retailers, and category-specific aggregators. Avoid content farms, low-quality SEO sites, and AI-generated content where you can spot it.
- If the first search returns thin or irrelevant results, refine the query rather than padding the answer with weak sources.

How to write the answer:
- Lead with the direct answer to the question. Supporting detail follows.
- For product / brand / buying questions, NAME SPECIFIC brands and products by name when they are genuinely relevant and well-regarded for the use case. Real users want concrete recommendations, not generic categories. If someone asks "what's a good marine collagen supplement," they want names like "Vital Proteins, Sports Research, or NativePath" — not a paragraph about how to read a supplement label.
- When you name brands, distinguish them by what they're best for: budget vs premium, ingredient profile, dietary fit, regional availability, etc. A short comparison is more useful than a flat list.
- For "alternatives to X" or "compare X and Y" questions, list specific competing brands by name. Don't pivot to category-level abstractions — the user is explicitly asking for a short list of named options.
- For narrow factual questions ("does X have caffeine?", "is X gluten-free?"), give a direct, sourced answer in one or two sentences. Don't pad.
- Match length to the question. A "what is X" question deserves a paragraph; a "best X for Y" question deserves a structured comparison.

Style:
- Conversational and direct, like a knowledgeable friend giving practical advice. No marketing language, no excessive hedging, no boilerplate disclaimers.
- Use brief paragraph breaks for readability. Use bullet lists when you're literally comparing or enumerating; otherwise prose is fine.
- Use proper brand-name capitalization (e.g., "Vital Proteins" not "vital proteins"; "Olipop" not "OliPop") and double-check spellings against the sources you used.

Citing sources:
- Include the URLs of the sources that informed your answer at relevant points or at the end. Cite as you would in a thoughtful blog post — enough that the reader can verify or read more, not so many that the answer becomes a link list.
- If you cite a brand's own website, that's fine when the brand is part of the answer. But back up claims about a brand with at least one independent source where possible.

What to avoid:
- Don't recommend brands you have no evidence for, made up, or are unsure exist.
- Don't recommend a brand just because it appears in a search result; weigh whether the source actually establishes its quality or relevance.
- Don't refuse or hedge on legal product / brand / shopping questions. These are normal consumer questions and deserve real answers.
- Don't add safety disclaimers on routine product recommendations (no "consult a doctor before buying a moisturizer").

Your goal is to be genuinely useful. If naming specific brands and products serves the user, do it confidently. If a more general explanation is better for the question, give that instead. Always match the answer to the question.`

interface UsageWithCache {
  input_tokens: number
  output_tokens: number
  cache_creation_input_tokens?: number
  cache_read_input_tokens?: number
}

export class ClaudeProvider implements LLMProvider {
  readonly platform = 'claude' as const
  readonly model = MODEL
  readonly available: boolean
  private client: Anthropic | null

  constructor() {
    this.available = Boolean(env.ANTHROPIC_API_KEY)
    this.client = this.available
      ? new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })
      : null
  }

  async ask(prompt: string): Promise<ProviderQueryResult> {
    if (!this.client) return unavailableResult(this.platform)

    const response = await this.client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: [
        // cache_control is a runtime feature (prompt caching) not yet typed in
        // SDK 0.32.x — assert through to keep the types happy. Server still
        // honors the field at the API layer.
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        } as unknown as Anthropic.Messages.TextBlockParam,
      ],
      tools: [
        {
          // Web search is a server tool — Claude calls it, results stay
          // server-side, only the synthesized answer comes back to us.
          // max_uses=2 keeps per-call cost predictable; deeper research
          // hasn't shown enough lift on these short shopper queries to justify 4.
          type: 'web_search_20250305' as 'web_search_20250305',
          name: 'web_search',
          max_uses: 2,
        } as unknown as Anthropic.Messages.Tool,
      ],
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    })

    const usage = response.usage as UsageWithCache
    if (usage.cache_read_input_tokens || usage.cache_creation_input_tokens) {
      console.log(
        `[claude] in=${usage.input_tokens} out=${usage.output_tokens} ` +
          `cache_write=${usage.cache_creation_input_tokens ?? 0} ` +
          `cache_read=${usage.cache_read_input_tokens ?? 0}`,
      )
    }

    const answer = response.content
      .filter(
        (block): block is Anthropic.Messages.TextBlock => block.type === 'text',
      )
      .map((block) => block.text)
      .join('\n\n')

    return {
      platform: this.platform,
      model: this.model,
      available: true,
      answer,
      citedSources: extractUrls(answer),
      competitorBrands: [],
      ranAt: new Date().toISOString(),
    }
  }
}

function extractUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s)>\]]+/g) ?? []
  return Array.from(new Set(matches))
}
