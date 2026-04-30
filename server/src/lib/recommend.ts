// Per-prompt content recommendations.
//
// Takes (brand profile, prompt, AI's actual answer, extraction verdict) and
// returns a concrete, actionable suggestion for what the brand should publish
// to win the prompt. Replaces the three hardcoded templates that previously
// rendered in the dashboard's RECOMMENDED CONTENT block.
//
// One Sonnet 4.6 call per (prompt, provider). With prompt caching on the
// system prompt, repeated calls in a cycle hit cache at ~10% input cost.
// Estimated $0.55 per 50-prompt cycle (one provider).

import Anthropic from '@anthropic-ai/sdk'
import type { Brand } from '@cited/shared'
import { env } from '../env.js'

export const RECOMMENDER_MODEL = 'claude-sonnet-4-6'

const SYSTEM_PROMPT = `You are a content strategist helping a DTC brand win recommendations from AI search assistants (ChatGPT, Perplexity, Gemini, Claude).

You will be given:
1. A brand's profile (name, category, product, primary claim, target buyer, differentiator).
2. A shopper question ("prompt") people might type into an AI assistant.
3. The actual answer the AI assistant gave to that question.
4. Whether this brand is currently cited in that answer, with rank if so.
5. The names of competitors mentioned in the AI's answer.

Your job: write ONE specific, actionable content recommendation the brand could publish to claim or reinforce its position on this prompt next time it's asked.

Tailor the recommendation to the situation:
- If the brand is NOT cited: focus on what gap to fill. What's the AI's current answer missing that the brand uniquely covers? What angle would force AI assistants to mention this brand the next time?
- If the brand IS cited (rank > 1 or weak mention): focus on consolidating the position. What supporting content would push them to rank 1 or get a stronger pitch?
- If the brand is cited at rank 1: focus on defending — what would competitors need to say to displace them, and what content forecloses that?
- If the AI's answer is empty, sparse (under ~200 chars), or errored: fall back to a general "publish a post that directly answers this question with specific details on X, Y, Z" suggestion based on the brand profile alone.

Be concrete. Include:
- The format (blog post, comparison page, FAQ entry, landing page section, video script, etc.)
- A working title or headline
- 3–5 specific things the content should cover, ideally addressing weak spots in the AI's current answer
- A clear anchor on the brand's actual differentiator
- Where useful, name the competitors that appeared in the AI's answer so the recommendation directly counters or co-mentions them

Style:
- 2–3 short paragraphs, about 80–120 words total
- Direct and practical, no marketing fluff, no excessive hedging
- Treat the reader as a marketer who knows their brand — don't restate the brand's offering back to them
- Don't add disclaimers, headers, or preamble

Return ONLY the recommendation text — no JSON, no markdown headers, no "Here's a recommendation:" intro. Plain prose.`

let _client: Anthropic | null = null
function client(): Anthropic {
  if (!_client) {
    _client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })
  }
  return _client
}

export interface RecommendInput {
  brand: Brand
  prompt: string
  answer: string
  cited: boolean
  rank: number | null
  competitors: string[]
}

export async function recommendContent(input: RecommendInput): Promise<string> {
  const { brand, prompt, answer, cited, rank, competitors } = input

  const userMessage = `Brand:
- Name: ${brand.name}
- Category: ${brand.category}
- What they sell: ${brand.productType}
- Primary claim: ${brand.primaryClaim}
- Target buyer: ${brand.targetBuyer}
- Differentiator: ${brand.differentiator}

Shopper prompt: "${prompt}"

AI assistant's answer:
"""
${answer || '(empty)'}
"""

This brand's status in the answer: ${cited ? 'CITED' : 'NOT CITED'}${cited && rank != null ? ` (rank ${rank})` : ''}
Competitors mentioned in the answer: ${competitors.length > 0 ? competitors.join(', ') : 'none extracted'}

Write the content recommendation now.`

  const response = await client().messages.create({
    model: RECOMMENDER_MODEL,
    max_tokens: 400,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      } as unknown as Anthropic.Messages.TextBlockParam,
    ],
    messages: [{ role: 'user', content: userMessage }],
  })

  return response.content
    .filter(
      (block): block is Anthropic.Messages.TextBlock => block.type === 'text',
    )
    .map((block) => block.text)
    .join('\n\n')
    .trim()
}
