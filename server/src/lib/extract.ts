// Provider-agnostic structured extraction.
//
// Takes a raw answer from any AI provider (Claude, ChatGPT, Perplexity,
// Gemini, etc.) and returns a normalized citation verdict. Replaces the
// regex-based detectCitation in score.ts with a Sonnet call that handles:
//   - brand-name variants ("Kaci Baum" matches "Kaci Baum Photography")
//   - URL-only citations
//   - rank inference (1 = first brand mentioned, etc.)
//   - competitor extraction (other brands mentioned that compete with us)
//
// One Sonnet 4.6 call per provider answer. With prompt caching on the
// system prompt + brand context, repeated extractions in a cycle hit cache
// at ~10% normal input cost.

import Anthropic from '@anthropic-ai/sdk'
import type { Brand } from '@cited/shared'
import { z } from 'zod'
import { env } from '../env.js'

export const EXTRACTOR_MODEL = 'claude-sonnet-4-6'

const SYSTEM_PROMPT = `You analyze AI-generated answers to consumer questions and return a structured citation verdict for a target brand.

Your job is to determine three things, given a target brand and an AI assistant's answer:

1. CITED — Did the answer mention or recommend the target brand by name? Match common variations of the brand name (case-insensitive, with/without legal suffixes, with/without category words like "Photography" or "Studios"). A URL pointing to the brand's domain also counts as a citation. Don't count accidental substring matches — "kaci" alone in a different context is not a citation of "Kaci Baum Photography".

2. RANK — If cited, what position is the brand in relative to other named brands in the answer? 1 = first brand mentioned. 2 = second. Etc. If the brand is mentioned only in passing (e.g. inside a long URL list at the end) and not as a recommended option, set rank to null even though cited may be true. The rank reflects "where in the answer's recommended list does this brand appear" — if it isn't a recommended pick, no rank.

3. COMPETITOR_BRANDS — All OTHER named brands mentioned in the answer that compete with or could substitute for the target brand. Include only real product/service brands relevant to the brand's category. Exclude:
   - The target brand itself
   - Generic terms ("photographers", "studios", "supplements")
   - Retailers and platforms ("Amazon", "Shopify", "Instagram") unless they themselves compete in the brand's category
   - Publications and review sites
   - People (unless they operate under their name as a brand, like a freelance photographer)
   - Fictional or made-up names

Use sensible judgment. The point is to give the brand owner a useful list of "who else got recommended in this answer."

Output ONLY valid JSON of the exact shape (no prose, no code fences):
{ "cited": boolean, "rank": number | null, "competitorBrands": string[] }

Where rank, when present, is an integer >= 1.`

const ExtractSchema = z.object({
  cited: z.boolean(),
  rank: z.number().int().min(1).nullable(),
  competitorBrands: z.array(z.string()),
})

export interface ExtractedCitation {
  cited: boolean
  rank: number | null
  competitorBrands: string[]
}

let _client: Anthropic | null = null
function client(): Anthropic {
  if (!_client) {
    _client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })
  }
  return _client
}

export async function extractCitation(
  brand: Brand,
  answer: string,
): Promise<ExtractedCitation> {
  // Empty / errored answer can't possibly cite. Skip the model call.
  if (!answer.trim()) {
    return { cited: false, rank: null, competitorBrands: [] }
  }

  const userMessage = `Target brand:
- Name: ${brand.name}
- URL: ${brand.url}
- Category: ${brand.category}
- What they sell: ${brand.productType}

AI assistant's answer:
"""
${answer}
"""

Return JSON only.`

  const response = await client().messages.create({
    model: EXTRACTOR_MODEL,
    max_tokens: 512,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      } as unknown as Anthropic.Messages.TextBlockParam,
    ],
    messages: [{ role: 'user', content: userMessage }],
  })

  const text = response.content
    .filter(
      (block): block is Anthropic.Messages.TextBlock => block.type === 'text',
    )
    .map((block) => block.text)
    .join('')
    .trim()

  // Tolerate accidental code fences even though the system prompt forbids them.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const jsonText = (fenced ? fenced[1] : text).trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonText)
  } catch {
    // Defensive: if Sonnet ever returns malformed JSON, fall back to a
    // not-cited verdict rather than failing the whole cycle.
    return { cited: false, rank: null, competitorBrands: [] }
  }

  const validated = ExtractSchema.safeParse(parsed)
  if (!validated.success) {
    return { cited: false, rank: null, competitorBrands: [] }
  }
  return validated.data
}
