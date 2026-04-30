import type {
  BrandSummary,
  Platform,
  PromptRun,
  PromptWithStatus,
  UpdateBrandRequest,
  UpdateBrandResponse,
} from '@cited/shared'
import { PLATFORMS } from '@cited/shared'
import { Hono } from 'hono'
import { z } from 'zod'
import { repo } from '../db/repo.js'
import { isCycleActive, startScoreCycle } from '../lib/runner.js'
import { buildSnapshot, opportunityScore } from '../lib/score.js'

export const brandRoutes = new Hono()

brandRoutes.get('/brands', async (c) => {
  const list = await repo().listBrands()
  return c.json({ brands: list })
})

brandRoutes.get('/brands/latest', async (c) => {
  const list = await repo().listBrands()
  if (list.length === 0) {
    return c.json({ error: 'no_brand', message: 'No brand has been onboarded yet' }, 404)
  }
  return c.json({ brand: list[0] })
})

brandRoutes.get('/brands/:id', async (c) => {
  const id = c.req.param('id')
  const r = repo()
  const brand = await r.getBrand(id)
  if (!brand) return c.json({ error: 'not_found', message: 'Brand not found' }, 404)

  const prompts = await r.listPrompts(brand.id)
  const runs = await r.latestRunsForBrand(brand.id)

  const promptStatuses: PromptWithStatus[] = prompts.map((prompt) => {
    const runMap = emptyRunMap()
    for (const run of runs) {
      if (run.promptId === prompt.id) runMap[run.platform] = run
    }
    return {
      prompt,
      runs: runMap,
      opportunityScore: opportunityScore(runMap),
    }
  })

  const current = buildSnapshot(promptStatuses, 0)
  const history = await r.scoreHistory(brand.id)

  const summary: BrandSummary = {
    brand,
    current,
    history,
  }
  return c.json({
    summary,
    prompts: promptStatuses,
    cycleActive: isCycleActive(brand.id),
  })
})

brandRoutes.get('/brands/:id/prompts', async (c) => {
  const id = c.req.param('id')
  const r = repo()
  const brand = await r.getBrand(id)
  if (!brand) return c.json({ error: 'not_found', message: 'Brand not found' }, 404)

  const prompts = await r.listPrompts(brand.id)
  const runs = await r.latestRunsForBrand(brand.id)

  const list: PromptWithStatus[] = prompts.map((prompt) => {
    const runMap = emptyRunMap()
    for (const run of runs) {
      if (run.promptId === prompt.id) runMap[run.platform] = run
    }
    return {
      prompt,
      runs: runMap,
      opportunityScore: opportunityScore(runMap),
    }
  })
  return c.json({ prompts: list })
})

const updateBrandBody = z.object({
  patch: z
    .object({
      url: z.string().min(3).optional(),
      name: z.string().min(1).optional(),
      category: z.string().min(1).optional(),
      productType: z.string().min(1).optional(),
      primaryClaim: z.string().min(1).optional(),
      targetBuyer: z.string().min(1).optional(),
      pricePosition: z.string().min(1).optional(),
      differentiator: z.string().min(1).optional(),
    })
    .refine((p) => Object.keys(p).length > 0, { message: 'patch must not be empty' }),
})

brandRoutes.patch('/brands/:id', async (c) => {
  const id = c.req.param('id')
  const existing = await repo().getBrand(id)
  if (!existing) return c.json({ error: 'not_found', message: 'Brand not found' }, 404)
  const body = updateBrandBody.parse(await c.req.json<UpdateBrandRequest>())
  const brand = await repo().updateBrand(id, body.patch)
  const response: UpdateBrandResponse = { brand }
  return c.json(response)
})

brandRoutes.post('/brands/:id/refresh', async (c) => {
  const id = c.req.param('id')
  const brand = await repo().getBrand(id)
  if (!brand) return c.json({ error: 'not_found', message: 'Brand not found' }, 404)
  const started = startScoreCycle(brand)
  return c.json({ started, cycleActive: true })
})

function emptyRunMap(): Record<Platform, PromptRun | null> {
  return Object.fromEntries(PLATFORMS.map((p) => [p, null])) as Record<
    Platform,
    PromptRun | null
  >
}
