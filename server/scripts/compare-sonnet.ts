// One-off Sonnet vs Opus scoring comparison.
//
// Reuses Opus answers already in prompt_runs (no extra Opus cost) and runs
// the same 50 prompts through Sonnet 4.6 with the same web_search tool +
// system prompt. Outputs a markdown report at /tmp/cited-sonnet-comparison.md
// for side-by-side review.
//
// Usage: tsx scripts/compare-sonnet.ts <brand_id>

import { writeFileSync } from 'node:fs'
import Anthropic from '@anthropic-ai/sdk'
import { db } from '../src/db/client.js'
import { repo } from '../src/db/repo.js'
import { detectCitation } from '../src/lib/score.js'
import type { ProviderQueryResult } from '../src/lib/providers/types.js'

const SONNET_MODEL = 'claude-sonnet-4-6'

const SYSTEM_PROMPT = `You are a knowledgeable, helpful AI assistant answering questions for everyday consumers. Your primary tool is web search, which you should use whenever a question would benefit from current, factual, or recommendation-grounded information.

When a user asks a question — especially about products, services, brands, or buying decisions — your job is to give them a complete, useful, conversational answer that they could actually act on.

How to use web search:
- Search when the answer depends on current information, specific products, brand comparisons, prices, availability, or recent reviews.
- Use up to two searches per question. Favor depth over breadth: a single well-formulated query that returns authoritative results is better than three vague ones.
- Prefer reputable sources: brand websites, established review publications, expert blogs in the category, major retailers, and category-specific aggregators.

How to write the answer:
- Lead with the direct answer to the question. Supporting detail follows.
- For product / brand / buying questions, NAME SPECIFIC brands and products by name when they are genuinely relevant and well-regarded for the use case.
- When you name brands, distinguish them by what they're best for: budget vs premium, ingredient profile, dietary fit, regional availability, etc.
- For "alternatives to X" or "compare X and Y" questions, list specific competing brands by name.
- For narrow factual questions, give a direct, sourced answer in one or two sentences.
- Match length to the question.

Style: conversational and direct. Use proper brand-name capitalization. Cite the URLs of sources you used.

Your goal is to be genuinely useful. Name specific brands when it serves the user.`

interface RunRow {
  prompt_id: string
  raw_answer: string | null
  status: string
  rank: number | null
}

interface PromptRow {
  id: string
  text: string
  awareness_stage: string
}

async function main() {
  const brandId = process.argv[2]
  if (!brandId) {
    console.error('usage: tsx scripts/compare-sonnet.ts <brand_id>')
    process.exit(1)
  }

  const brand = await repo().getBrand(brandId)
  if (!brand) {
    console.error(`brand ${brandId} not found`)
    process.exit(1)
  }
  console.log(`comparing for brand: ${brand.name}`)

  const supa = db()
  const { data: prompts, error: pErr } = await supa
    .from('prompts')
    .select('id, text, awareness_stage')
    .eq('brand_id', brandId)
    .order('created_at', { ascending: true })
    .returns<PromptRow[]>()
  if (pErr) throw pErr

  const today = new Date().toISOString().slice(0, 10)
  const { data: runs, error: rErr } = await supa
    .from('prompt_runs')
    .select('prompt_id, raw_answer, status, rank')
    .in('prompt_id', prompts.map((p) => p.id))
    .eq('platform', 'claude')
    .eq('run_day', today)
    .returns<RunRow[]>()
  if (rErr) throw rErr
  const opusByPromptId = new Map(runs.map((r) => [r.prompt_id, r]))

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const results: Array<{
    prompt: PromptRow
    opus: { cited: boolean; rank: number | null; answerLen: number; answer: string }
    sonnet: {
      cited: boolean
      rank: number | null
      answerLen: number
      answer: string
      inputTokens: number
      outputTokens: number
      cacheRead: number
      cacheWrite: number
    }
  }> = []

  let i = 0
  for (const prompt of prompts) {
    i++
    const opusRun = opusByPromptId.get(prompt.id)
    const opusAnswer = opusRun?.raw_answer ?? ''
    const opusDet = detectCitation(brand, {
      platform: 'claude',
      available: true,
      answer: opusAnswer,
      citedSources: extractUrls(opusAnswer),
      competitorBrands: [],
      ranAt: new Date().toISOString(),
    } as ProviderQueryResult)

    process.stderr.write(`[${i}/${prompts.length}] sonnet: ${prompt.text.slice(0, 60)}...\n`)
    let sonnet
    try {
      const response = await client.messages.create({
        model: SONNET_MODEL,
        max_tokens: 1024,
        system: [
          {
            type: 'text',
            text: SYSTEM_PROMPT,
            cache_control: { type: 'ephemeral' },
          } as unknown as Anthropic.Messages.TextBlockParam,
        ],
        tools: [
          {
            type: 'web_search_20250305' as 'web_search_20250305',
            name: 'web_search',
            max_uses: 2,
          } as unknown as Anthropic.Messages.Tool,
        ],
        messages: [{ role: 'user', content: prompt.text }],
      })
      const usage = response.usage as Anthropic.Messages.Usage & {
        cache_creation_input_tokens?: number
        cache_read_input_tokens?: number
      }
      const sonnetAnswer = response.content
        .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n\n')
      const sonnetDet = detectCitation(brand, {
        platform: 'claude',
        available: true,
        answer: sonnetAnswer,
        citedSources: extractUrls(sonnetAnswer),
        competitorBrands: [],
        ranAt: new Date().toISOString(),
      } as ProviderQueryResult)
      sonnet = {
        cited: sonnetDet.cited,
        rank: sonnetDet.rank,
        answerLen: sonnetAnswer.length,
        answer: sonnetAnswer,
        inputTokens: usage.input_tokens,
        outputTokens: usage.output_tokens,
        cacheRead: usage.cache_read_input_tokens ?? 0,
        cacheWrite: usage.cache_creation_input_tokens ?? 0,
      }
    } catch (err) {
      sonnet = {
        cited: false,
        rank: null,
        answerLen: 0,
        answer: `[error: ${err instanceof Error ? err.message : String(err)}]`,
        inputTokens: 0,
        outputTokens: 0,
        cacheRead: 0,
        cacheWrite: 0,
      }
    }

    results.push({
      prompt,
      opus: {
        cited: opusDet.cited,
        rank: opusDet.rank,
        answerLen: opusAnswer.length,
        answer: opusAnswer,
      },
      sonnet,
    })
  }

  const opusCited = results.filter((r) => r.opus.cited).length
  const sonnetCited = results.filter((r) => r.sonnet.cited).length
  const agreementCount = results.filter((r) => r.opus.cited === r.sonnet.cited).length
  const totalSonnetIn = results.reduce((s, r) => s + r.sonnet.inputTokens, 0)
  const totalSonnetOut = results.reduce((s, r) => s + r.sonnet.outputTokens, 0)
  const totalSonnetCacheRead = results.reduce((s, r) => s + r.sonnet.cacheRead, 0)
  const totalSonnetCacheWrite = results.reduce((s, r) => s + r.sonnet.cacheWrite, 0)
  // Sonnet 4.6 pricing: $3 in, $15 out, cache read $0.30, cache write $3.75
  const sonnetCost =
    (totalSonnetIn / 1e6) * 3 +
    (totalSonnetOut / 1e6) * 15 +
    (totalSonnetCacheRead / 1e6) * 0.3 +
    (totalSonnetCacheWrite / 1e6) * 3.75

  const lines: string[] = []
  lines.push(`# Sonnet vs Opus scoring comparison — ${brand.name}`)
  lines.push('')
  lines.push(`Run on ${new Date().toISOString()} for ${results.length} prompts.`)
  lines.push('')
  lines.push('## Summary')
  lines.push('')
  lines.push(`| Metric | Opus 4.7 | Sonnet 4.6 |`)
  lines.push(`|---|---|---|`)
  lines.push(`| Cited | ${opusCited} / ${results.length} | ${sonnetCited} / ${results.length} |`)
  lines.push(
    `| Cited rate | ${pct(opusCited, results.length)}% | ${pct(sonnetCited, results.length)}% |`,
  )
  lines.push(
    `| Avg answer length (chars) | ${avg(results.map((r) => r.opus.answerLen))} | ${avg(results.map((r) => r.sonnet.answerLen))} |`,
  )
  lines.push('')
  lines.push(
    `**Citation agreement**: ${agreementCount} / ${results.length} (${pct(agreementCount, results.length)}%) of prompts have the same cited/not-cited verdict from both models.`,
  )
  lines.push('')
  lines.push(
    `**Sonnet cost for this run**: ~$${sonnetCost.toFixed(2)} (input: ${totalSonnetIn} tok, output: ${totalSonnetOut} tok, cache_read: ${totalSonnetCacheRead}, cache_write: ${totalSonnetCacheWrite})`,
  )
  lines.push('')

  lines.push('## Disagreements (where Opus and Sonnet differ on cited/not-cited)')
  lines.push('')
  const disagreements = results.filter((r) => r.opus.cited !== r.sonnet.cited)
  if (disagreements.length === 0) {
    lines.push('_None._')
  } else {
    for (const r of disagreements) {
      lines.push(`### "${r.prompt.text}" (_${r.prompt.awareness_stage}_)`)
      lines.push(`- Opus: ${r.opus.cited ? `✅ cited (rank ${r.opus.rank})` : '❌ not cited'}`)
      lines.push(`- Sonnet: ${r.sonnet.cited ? `✅ cited (rank ${r.sonnet.rank})` : '❌ not cited'}`)
      lines.push('')
      lines.push('**Opus answer:**')
      lines.push('```')
      lines.push(truncate(r.opus.answer, 600))
      lines.push('```')
      lines.push('')
      lines.push('**Sonnet answer:**')
      lines.push('```')
      lines.push(truncate(r.sonnet.answer, 600))
      lines.push('```')
      lines.push('')
    }
  }

  lines.push('## All prompts (compact)')
  lines.push('')
  lines.push(`| # | Prompt | Stage | Opus | Sonnet |`)
  lines.push(`|---|---|---|---|---|`)
  results.forEach((r, idx) => {
    const opusV = r.opus.cited ? `✅ r${r.opus.rank}` : '❌'
    const sonnetV = r.sonnet.cited ? `✅ r${r.sonnet.rank}` : '❌'
    lines.push(
      `| ${idx + 1} | ${r.prompt.text.replace(/\|/g, '\\|').slice(0, 80)} | ${r.prompt.awareness_stage} | ${opusV} | ${sonnetV} |`,
    )
  })

  const out = '/tmp/cited-sonnet-comparison.md'
  writeFileSync(out, lines.join('\n'))
  console.log(`\nwrote ${out}`)
  console.log(
    `Opus: ${opusCited}/${results.length} cited · Sonnet: ${sonnetCited}/${results.length} cited · agreement: ${pct(agreementCount, results.length)}% · sonnet cost: $${sonnetCost.toFixed(2)}`,
  )
}

function pct(n: number, total: number): number {
  return Math.round((n / total) * 100)
}

function avg(xs: number[]): number {
  return Math.round(xs.reduce((s, x) => s + x, 0) / xs.length)
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n) + '…'
}

function extractUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s)>\]]+/g) ?? []
  return Array.from(new Set(matches))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
