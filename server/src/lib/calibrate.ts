import Anthropic from '@anthropic-ai/sdk'
import type { CalibrationDraft } from '@cited/shared'
import { z } from 'zod'
import { env } from '../env.js'
import type { ScrapeResult } from './scraper.js'

const MODEL = 'claude-opus-4-7'

const draftSchema = z.object({
  name: z.string(),
  category: z.string(),
  productType: z.string(),
  primaryClaim: z.string(),
  targetBuyer: z.string(),
  pricePosition: z.string(),
  differentiator: z.string(),
})

const SYSTEM = `You analyze a DTC brand's website and extract a structured calibration profile so we can find the right AI-search prompts to track for them.

Output ONLY valid JSON matching this exact shape — no prose, no code fences:
{
  "name": "Brand name as it appears on the site",
  "category": "Broad shopping category, e.g. 'Supplements · Beauty', 'Beverages', 'Skincare'",
  "productType": "What the product literally is, e.g. 'Marine collagen peptide supplement'",
  "primaryClaim": "The #1 benefit they sell on, e.g. 'Joint health & skin elasticity'",
  "targetBuyer": "Who this is for, e.g. 'Women 35-55'",
  "pricePosition": "One of: Budget / value, Mid-market, Premium, Luxury",
  "differentiator": "What makes this product different, e.g. 'Grass-fed, unflavored, hydrolyzed'"
}

Be specific and concise. If signal is weak, infer from context but stay honest.`

export async function calibrateFromScrape(
  scrape: ScrapeResult,
): Promise<CalibrationDraft> {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })

  const userMessage = [
    `URL: ${scrape.finalUrl}`,
    `TITLE: ${scrape.title}`,
    `META: ${scrape.description}`,
    `HEADINGS:\n- ${scrape.headings.join('\n- ')}`,
    '',
    `BODY (truncated):\n${scrape.bodyText}`,
  ].join('\n')

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 600,
    system: SYSTEM,
    messages: [{ role: 'user', content: userMessage }],
  })

  const text = response.content
    .filter(
      (block): block is Anthropic.Messages.TextBlock => block.type === 'text',
    )
    .map((block) => block.text)
    .join('')
    .trim()

  const json = extractJson(text)
  const parsed = draftSchema.parse(json)

  return {
    url: scrape.url,
    ...parsed,
  }
}

function extractJson(text: string): unknown {
  // Models sometimes wrap output in fences despite instructions. Strip if so.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const candidate = (fenced ? fenced[1] : text).trim()
  return JSON.parse(candidate)
}
