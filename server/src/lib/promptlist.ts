import Anthropic from '@anthropic-ai/sdk'
import type { Brand, Prompt } from '@cited/shared'
import { z } from 'zod'
import { env } from '../env.js'

const MODEL = 'claude-opus-4-7'

const ITEM = z.object({
  text: z.string(),
  awarenessStage: z.enum([
    'unaware',
    'problem-aware',
    'solution-aware',
    'product-aware',
    'most-aware',
  ]),
})

const listSchema = z.object({ prompts: z.array(ITEM) })

const SYSTEM = `You are a senior DTC growth marketer. Generate EXACTLY 50 prompts (no more, no fewer) that real shoppers would type into ChatGPT or Perplexity when researching a purchase in this brand's category.

Distribute across the awareness ladder so we cover the funnel — these counts must sum to 50:
- 10 prompts: unaware (broad symptom or curiosity, no product in mind)
- 12 prompts: problem-aware (knows the problem, hunting for solutions)
- 14 prompts: solution-aware (knows the solution category exists, comparing approaches)
- 10 prompts: product-aware (comparing specific products / brands)
- 4 prompts: most-aware (ready to buy — discount, where to buy, ingredient checks)

Use natural, conversational phrasing — how people actually talk to AI. No marketing language. No brand names invented out of thin air; only reference brands the user might plausibly mention.

Output ONLY JSON of the shape (the prompts array must contain exactly 50 entries):
{ "prompts": [{ "text": "...", "awarenessStage": "..." }, ...] }`

export async function generatePromptList(brand: Brand): Promise<
  Array<Omit<Prompt, 'id' | 'brandId' | 'createdAt'>>
> {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })

  const user = [
    `Brand: ${brand.name}`,
    `Category: ${brand.category}`,
    `Product type: ${brand.productType}`,
    `Primary claim: ${brand.primaryClaim}`,
    `Target buyer: ${brand.targetBuyer}`,
    `Price position: ${brand.pricePosition}`,
    `Differentiator: ${brand.differentiator}`,
  ].join('\n')

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: SYSTEM,
    messages: [{ role: 'user', content: user }],
  })

  const text = response.content
    .filter(
      (block): block is Anthropic.Messages.TextBlock => block.type === 'text',
    )
    .map((block) => block.text)
    .join('')
    .trim()

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const json = JSON.parse((fenced ? fenced[1] : text).trim())
  const parsed = listSchema.parse(json)

  // Hard-cap to 50 in case Claude generates 51+. The system prompt says
  // "exactly 50" but belt-and-suspenders.
  return parsed.prompts.slice(0, 50).map((p) => ({
    text: p.text,
    awarenessStage: p.awarenessStage,
  }))
}
