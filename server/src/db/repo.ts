import { randomUUID } from 'node:crypto'
import type {
  Brand,
  BrandPatch,
  CalibrationDraft,
  Platform,
  Prompt,
  PromptRun,
  ScoreSnapshot,
} from '@cited/shared'
import { db, dbAvailable } from './client.js'

// Repository abstraction. The server starts in `memory` mode if Supabase isn't
// configured, so you can demo the full loop without a DB. Wire SUPABASE_URL +
// SUPABASE_SERVICE_ROLE_KEY and the same calls automatically use Postgres.

export interface Repo {
  createBrand(draft: CalibrationDraft): Promise<Brand>
  getBrand(id: string): Promise<Brand | null>
  listBrands(): Promise<Brand[]>
  updateBrand(id: string, patch: BrandPatch): Promise<Brand>

  insertPrompts(
    brandId: string,
    prompts: Array<Omit<Prompt, 'id' | 'brandId' | 'createdAt'>>,
  ): Promise<Prompt[]>
  listPrompts(brandId: string): Promise<Prompt[]>

  recordRun(run: Omit<PromptRun, 'id'>): Promise<PromptRun>
  latestRunsForBrand(brandId: string): Promise<PromptRun[]>

  recordScore(brandId: string, snap: ScoreSnapshot): Promise<void>
  scoreHistory(brandId: string, limit?: number): Promise<ScoreSnapshot[]>
}

// ---- In-memory ------------------------------------------------------------

class MemoryRepo implements Repo {
  private brands = new Map<string, Brand>()
  private prompts = new Map<string, Prompt>()
  private runs = new Map<string, PromptRun>()
  private scores = new Map<string, ScoreSnapshot[]>()

  async createBrand(draft: CalibrationDraft): Promise<Brand> {
    const brand: Brand = {
      id: randomUUID(),
      ...draft,
      createdAt: new Date().toISOString(),
    }
    this.brands.set(brand.id, brand)
    return brand
  }

  async getBrand(id: string) {
    return this.brands.get(id) ?? null
  }

  async listBrands() {
    return Array.from(this.brands.values())
  }

  async updateBrand(id: string, patch: BrandPatch): Promise<Brand> {
    const cur = this.brands.get(id)
    if (!cur) throw new Error('Brand not found')
    const next: Brand = { ...cur, ...patch }
    this.brands.set(id, next)
    return next
  }

  async insertPrompts(brandId: string, items: Array<Omit<Prompt, 'id' | 'brandId' | 'createdAt'>>) {
    const created: Prompt[] = items.map((p) => ({
      id: randomUUID(),
      brandId,
      text: p.text,
      awarenessStage: p.awarenessStage,
      createdAt: new Date().toISOString(),
    }))
    for (const p of created) this.prompts.set(p.id, p)
    return created
  }

  async listPrompts(brandId: string) {
    return Array.from(this.prompts.values()).filter((p) => p.brandId === brandId)
  }

  async recordRun(run: Omit<PromptRun, 'id'>): Promise<PromptRun> {
    const today = run.ranAt.slice(0, 10)
    const key = `${run.promptId}:${run.platform}:${today}`
    const existing = this.runs.get(key)
    const full: PromptRun = { id: existing?.id ?? randomUUID(), ...run }
    this.runs.set(key, full)
    return full
  }

  async latestRunsForBrand(brandId: string): Promise<PromptRun[]> {
    const promptIds = new Set(
      Array.from(this.prompts.values())
        .filter((p) => p.brandId === brandId)
        .map((p) => p.id),
    )
    const byKey = new Map<string, PromptRun>()
    for (const run of this.runs.values()) {
      if (!promptIds.has(run.promptId)) continue
      const key = `${run.promptId}:${run.platform}`
      const prev = byKey.get(key)
      if (!prev || run.ranAt > prev.ranAt) byKey.set(key, run)
    }
    return Array.from(byKey.values())
  }

  async recordScore(brandId: string, snap: ScoreSnapshot) {
    const list = this.scores.get(brandId) ?? []
    list.push(snap)
    this.scores.set(brandId, list)
  }

  async scoreHistory(brandId: string, limit = 30) {
    const list = this.scores.get(brandId) ?? []
    return list.slice(-limit)
  }
}

// ---- Supabase -------------------------------------------------------------
// Maps snake_case Postgres rows to the camelCase shared types. The schema in
// schema.sql matches these tables 1:1. recordRun and recordScore use upserts
// against the unique (..., run_day) / (..., capture_day) indexes so the
// nightly cron is idempotent within a single day.

type BrandRow = {
  id: string
  url: string
  name: string
  category: string
  product_type: string
  primary_claim: string
  target_buyer: string
  price_position: string
  differentiator: string
  created_at: string
}

type PromptRow = {
  id: string
  brand_id: string
  text: string
  awareness_stage: Prompt['awarenessStage']
  created_at: string
}

type PromptRunRow = {
  id: string
  prompt_id: string
  platform: Platform
  model: string
  status: PromptRun['status']
  rank: number | null
  competitors: string[]
  recommended_content: string | null
  raw_answer: string | null
  ran_at: string
  run_day: string
}

type ScoreRow = {
  brand_id: string
  score: number
  band: ScoreSnapshot['band']
  prompts_checked: number
  prompts_cited: number
  competitor_avg: number
  captured_at: string
  capture_day: string
}

function brandFromRow(row: BrandRow): Brand {
  return {
    id: row.id,
    url: row.url,
    name: row.name,
    category: row.category,
    productType: row.product_type,
    primaryClaim: row.primary_claim,
    targetBuyer: row.target_buyer,
    pricePosition: row.price_position,
    differentiator: row.differentiator,
    createdAt: row.created_at,
  }
}

function promptFromRow(row: PromptRow): Prompt {
  return {
    id: row.id,
    brandId: row.brand_id,
    text: row.text,
    awarenessStage: row.awareness_stage,
    createdAt: row.created_at,
  }
}

function runFromRow(row: PromptRunRow): PromptRun {
  return {
    id: row.id,
    promptId: row.prompt_id,
    platform: row.platform,
    model: row.model,
    status: row.status,
    rank: row.rank,
    competitors: row.competitors,
    recommendedContent: row.recommended_content,
    rawAnswer: row.raw_answer,
    ranAt: row.ran_at,
  }
}

function scoreFromRow(row: ScoreRow): ScoreSnapshot {
  return {
    score: row.score,
    band: row.band,
    promptsChecked: row.prompts_checked,
    promptsCited: row.prompts_cited,
    competitorAvg: row.competitor_avg,
    capturedAt: row.captured_at,
  }
}

class SupabaseRepo implements Repo {
  async createBrand(draft: CalibrationDraft): Promise<Brand> {
    const { data, error } = await db()
      .from('brands')
      .insert({
        url: draft.url,
        name: draft.name,
        category: draft.category,
        product_type: draft.productType,
        primary_claim: draft.primaryClaim,
        target_buyer: draft.targetBuyer,
        price_position: draft.pricePosition,
        differentiator: draft.differentiator,
      })
      .select()
      .single<BrandRow>()
    if (error) throw error
    return brandFromRow(data)
  }

  async getBrand(id: string): Promise<Brand | null> {
    const { data, error } = await db()
      .from('brands')
      .select()
      .eq('id', id)
      .maybeSingle<BrandRow>()
    if (error) throw error
    return data ? brandFromRow(data) : null
  }

  async listBrands(): Promise<Brand[]> {
    const { data, error } = await db()
      .from('brands')
      .select()
      .order('created_at', { ascending: false })
      .returns<BrandRow[]>()
    if (error) throw error
    return data.map(brandFromRow)
  }

  async updateBrand(id: string, patch: BrandPatch): Promise<Brand> {
    const row: Partial<BrandRow> = {}
    if (patch.url !== undefined) row.url = patch.url
    if (patch.name !== undefined) row.name = patch.name
    if (patch.category !== undefined) row.category = patch.category
    if (patch.productType !== undefined) row.product_type = patch.productType
    if (patch.primaryClaim !== undefined) row.primary_claim = patch.primaryClaim
    if (patch.targetBuyer !== undefined) row.target_buyer = patch.targetBuyer
    if (patch.pricePosition !== undefined) row.price_position = patch.pricePosition
    if (patch.differentiator !== undefined) row.differentiator = patch.differentiator

    const { data, error } = await db()
      .from('brands')
      .update(row)
      .eq('id', id)
      .select()
      .single<BrandRow>()
    if (error) throw error
    return brandFromRow(data)
  }

  async insertPrompts(
    brandId: string,
    items: Array<Omit<Prompt, 'id' | 'brandId' | 'createdAt'>>,
  ): Promise<Prompt[]> {
    if (items.length === 0) return []
    const { data, error } = await db()
      .from('prompts')
      .insert(
        items.map((p) => ({
          brand_id: brandId,
          text: p.text,
          awareness_stage: p.awarenessStage,
        })),
      )
      .select()
      .returns<PromptRow[]>()
    if (error) throw error
    return data.map(promptFromRow)
  }

  async listPrompts(brandId: string): Promise<Prompt[]> {
    const { data, error } = await db()
      .from('prompts')
      .select()
      .eq('brand_id', brandId)
      .order('created_at', { ascending: true })
      .returns<PromptRow[]>()
    if (error) throw error
    return data.map(promptFromRow)
  }

  async recordRun(run: Omit<PromptRun, 'id'>): Promise<PromptRun> {
    const runDay = run.ranAt.slice(0, 10)
    const { data, error } = await db()
      .from('prompt_runs')
      .upsert(
        {
          prompt_id: run.promptId,
          platform: run.platform,
          model: run.model,
          status: run.status,
          rank: run.rank,
          competitors: run.competitors,
          recommended_content: run.recommendedContent,
          raw_answer: run.rawAnswer,
          ran_at: run.ranAt,
          run_day: runDay,
        },
        { onConflict: 'prompt_id,platform,run_day' },
      )
      .select()
      .single<PromptRunRow>()
    if (error) throw error
    return runFromRow(data)
  }

  async latestRunsForBrand(brandId: string): Promise<PromptRun[]> {
    const { data: promptRows, error: promptErr } = await db()
      .from('prompts')
      .select('id')
      .eq('brand_id', brandId)
      .returns<{ id: string }[]>()
    if (promptErr) throw promptErr
    const promptIds = promptRows.map((p) => p.id)
    if (promptIds.length === 0) return []

    const { data, error } = await db()
      .from('prompt_runs')
      .select()
      .in('prompt_id', promptIds)
      .order('ran_at', { ascending: false })
      .returns<PromptRunRow[]>()
    if (error) throw error

    const latest = new Map<string, PromptRunRow>()
    for (const row of data) {
      const key = `${row.prompt_id}:${row.platform}`
      if (!latest.has(key)) latest.set(key, row)
    }
    return Array.from(latest.values()).map(runFromRow)
  }

  async recordScore(brandId: string, snap: ScoreSnapshot): Promise<void> {
    const captureDay = snap.capturedAt.slice(0, 10)
    const { error } = await db()
      .from('scores_daily')
      .upsert(
        {
          brand_id: brandId,
          score: snap.score,
          band: snap.band,
          prompts_checked: snap.promptsChecked,
          prompts_cited: snap.promptsCited,
          competitor_avg: snap.competitorAvg,
          captured_at: snap.capturedAt,
          capture_day: captureDay,
        },
        { onConflict: 'brand_id,capture_day' },
      )
    if (error) throw error
  }

  async scoreHistory(brandId: string, limit = 30): Promise<ScoreSnapshot[]> {
    const { data, error } = await db()
      .from('scores_daily')
      .select()
      .eq('brand_id', brandId)
      .order('capture_day', { ascending: true })
      .limit(limit)
      .returns<ScoreRow[]>()
    if (error) throw error
    return data.map(scoreFromRow)
  }
}

let _repo: Repo | null = null

export function repo(): Repo {
  if (_repo) return _repo
  _repo = dbAvailable() ? new SupabaseRepo() : new MemoryRepo()
  return _repo
}

export function repoMode(): 'memory' | 'supabase' {
  return dbAvailable() ? 'supabase' : 'memory'
}

// Type-only export so we can reference Platform from an import * if needed
export type { Platform }
