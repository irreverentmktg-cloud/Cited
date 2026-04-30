import type {
  AnalyzeRequest,
  AnalyzeResponse,
  CreateBrandRequest,
  CreateBrandResponse,
} from '@cited/shared'
import { Hono } from 'hono'
import { z } from 'zod'
import { repo } from '../db/repo.js'
import { calibrateFromScrape } from '../lib/calibrate.js'
import { generatePromptList } from '../lib/promptlist.js'
import { seedPendingRuns, startScoreCycle } from '../lib/runner.js'
import { buildSnapshot } from '../lib/score.js'
import { ScrapeError, scrapeSite } from '../lib/scraper.js'

export const analyzeRoutes = new Hono()

const analyzeBody = z.object({ url: z.string().min(3) })

analyzeRoutes.post('/analyze', async (c) => {
  const body = analyzeBody.parse(await c.req.json<AnalyzeRequest>())
  try {
    const scrape = await scrapeSite(body.url)
    const draft = await calibrateFromScrape(scrape)
    const response: AnalyzeResponse = { draft }
    return c.json(response)
  } catch (err) {
    if (err instanceof ScrapeError) {
      return c.json(
        { error: 'scrape_failed', message: err.message },
        { status: 422 },
      )
    }
    throw err
  }
})

const createBrandBody = z.object({
  draft: z.object({
    url: z.string(),
    name: z.string(),
    category: z.string(),
    productType: z.string(),
    primaryClaim: z.string(),
    targetBuyer: z.string(),
    pricePosition: z.string(),
    differentiator: z.string(),
  }),
  confirmedFields: z.array(z.string()),
})

analyzeRoutes.post('/brands', async (c) => {
  const body = createBrandBody.parse(await c.req.json<CreateBrandRequest>())
  const r = repo()

  const existing = await r.listBrands()
  if (existing.length > 0) {
    return c.json(
      {
        error: 'brand_limit',
        message:
          'The free plan tracks one brand. Upgrade to add more, or open the existing brand to continue.',
      },
      409,
    )
  }

  const brand = await r.createBrand(body.draft)
  const promptItems = await generatePromptList(brand)
  const insertedPrompts = await r.insertPrompts(brand.id, promptItems)

  // Seed pending runs synchronously so the dashboard renders the full grid
  // immediately, then return. The score cycle runs in the background and the
  // client polls GET /brands/:id to watch citations land.
  await seedPendingRuns(insertedPrompts)
  const initialScore = buildSnapshot([], 0)
  startScoreCycle(brand)

  const response: CreateBrandResponse = {
    brand,
    initialScore,
  }
  return c.json(response)
})
