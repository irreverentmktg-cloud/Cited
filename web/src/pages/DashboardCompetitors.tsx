import { useMemo } from 'react'
import { ArrowRight, ExternalLink, Loader2 } from 'lucide-react'
import type { Brand, PromptWithStatus, ScoreSnapshot } from '@cited/shared'
import { PLATFORMS } from '@cited/shared'
import { DashboardLayout } from '@/components/DashboardLayout'
import { ScoreRing } from '@/components/ScoreRing'
import { useBrand } from '@/lib/useBrand'

interface CompetitorRollup {
  name: string
  promptCount: number
  topPrompt: { text: string; opportunity: number } | null
  platforms: Set<string>
}

interface PromptGap {
  prompt: string
  owner: string
  opportunity: number
}

const TOP_COMPETITORS_SHOWN = 11
const TOP_GAPS_SHOWN = 8

export function DashboardCompetitors() {
  const state = useBrand()

  if (state.kind === 'loading') {
    return (
      <DashboardLayout>
        <Centered>
          <Loader2 className="animate-spin text-mid" />
          <span className="text-sm text-mid">Loading competitor data...</span>
        </Centered>
      </DashboardLayout>
    )
  }
  if (state.kind === 'error') {
    return (
      <DashboardLayout>
        <Centered>
          <div className="text-base font-semibold text-ink">
            Couldn't load competitor data
          </div>
          <div className="text-sm text-mid">{state.message}</div>
        </Centered>
      </DashboardLayout>
    )
  }
  if (state.kind === 'idle') {
    return (
      <DashboardLayout>
        <EmptyState message="Onboard a brand to see who's competing for your prompts." />
      </DashboardLayout>
    )
  }

  return (
    <LiveCompetitors
      brand={state.data.summary.brand}
      current={state.data.summary.current}
      prompts={state.data.prompts}
    />
  )
}

function LiveCompetitors({
  brand,
  current,
  prompts,
}: {
  brand: Brand
  current: ScoreSnapshot
  prompts: PromptWithStatus[]
}) {
  const competitors = useMemo(() => aggregateCompetitors(prompts), [prompts])
  const gaps = useMemo(() => computeGaps(prompts, competitors), [prompts, competitors])

  const noCompetitorData = competitors.length === 0

  return (
    <DashboardLayout brand={brand} current={current}>
      <div className="mx-auto max-w-[1100px] px-8 py-10">
        <div>
          <span className="kicker">COMPETITOR LANDSCAPE</span>
          <h1 className="mt-2 text-[34px] font-bold tracking-tightest text-ink">
            {brand.category}
          </h1>
          <p className="mt-1 text-sm text-mid">
            {noCompetitorData
              ? 'Competitors will appear here once a score cycle has run with the new extraction step.'
              : `${competitors.length} competing brand${competitors.length === 1 ? '' : 's'} extracted from AI answers across your ${prompts.length} prompts. Updated when you refresh.`}
          </p>
        </div>

        {noCompetitorData ? (
          <div className="card mt-8 p-10 text-center">
            <div className="text-base font-semibold text-ink">
              No competitor data yet
            </div>
            <p className="mt-2 text-sm text-mid">
              Run a score cycle (refresh on the dashboard) to populate competitor
              brands. Each prompt's answer is analyzed for who else got
              recommended.
            </p>
          </div>
        ) : (
          <>
            <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              <YouCard brand={brand} current={current} prompts={prompts} />
              {competitors.slice(0, TOP_COMPETITORS_SHOWN).map((c) => (
                <CompetitorCard key={c.name} competitor={c} />
              ))}
            </div>

            <div className="mt-12">
              <span className="kicker">PROMPT GAPS</span>
              <h2 className="mt-2 text-[24px] font-semibold text-ink">
                Prompts your competitors own that you don't.
              </h2>
              <p className="mt-1 text-sm text-mid">
                You're not cited on these. The competitor listed is the first
                brand we found in the AI's answer.
              </p>

              {gaps.length === 0 ? (
                <div className="card mt-5 p-8 text-center text-sm text-mid">
                  No gaps right now — every uncited prompt also has no extracted
                  competitor.
                </div>
              ) : (
                <div className="card mt-5 divide-y divide-line">
                  {gaps.slice(0, TOP_GAPS_SHOWN).map((g) => (
                    <div
                      key={g.prompt}
                      className="flex items-center justify-between gap-6 px-6 py-4"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[15px] font-medium text-ink">
                          "{g.prompt}"
                        </div>
                        <div className="mt-1 font-mono text-[11px] tracking-wider text-mid">
                          OWNED BY · {g.owner.toUpperCase()} · OPPORTUNITY{' '}
                          {g.opportunity}
                        </div>
                      </div>
                      <button className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-ink px-3 py-2 text-xs font-medium text-white hover:bg-rich">
                        Claim it
                        <ArrowRight size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}

function YouCard({
  brand,
  current,
  prompts,
}: {
  brand: Brand
  current: ScoreSnapshot
  prompts: PromptWithStatus[]
}) {
  const citedCount = prompts.filter((p) =>
    PLATFORMS.some((pl) => p.runs[pl]?.status === 'cited'),
  ).length
  return (
    <div className="card relative flex flex-col p-6 ring-2 ring-ink">
      <span className="absolute -top-3 left-5 inline-flex items-center rounded-full bg-ink px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-white">
        You
      </span>
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1 pr-3">
          <div className="kicker">BRAND</div>
          <h3 className="mt-1 truncate text-[18px] font-semibold text-ink" title={brand.name}>
            {brand.name}
          </h3>
        </div>
        <ScoreRing
          score={current.score}
          size={64}
          stroke={6}
          animate={false}
          showLabel={false}
        />
      </div>
      <div className="mt-6 grid grid-cols-2 gap-4 border-t border-line pt-4">
        <div>
          <div className="kicker">PROMPTS CITED</div>
          <div className="mt-1 text-xl font-bold text-ink">{citedCount}</div>
        </div>
        <div>
          <div className="kicker">SCORE</div>
          <div className="mt-1 text-xl font-bold text-ink">{current.score}</div>
        </div>
      </div>
      <div className="mt-4">
        <div className="kicker">CATEGORY</div>
        <p className="mt-1 truncate text-sm text-rich">{brand.category}</p>
      </div>
    </div>
  )
}

function CompetitorCard({ competitor }: { competitor: CompetitorRollup }) {
  return (
    <div className="card flex flex-col p-6">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1 pr-3">
          <div className="kicker">BRAND</div>
          <h3
            className="mt-1 truncate text-[18px] font-semibold text-ink"
            title={competitor.name}
          >
            {competitor.name}
          </h3>
        </div>
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-line bg-offwhite font-mono text-[13px] font-semibold text-ink">
          {competitor.promptCount}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 border-t border-line pt-4">
        <div>
          <div className="kicker">MENTIONS</div>
          <div className="mt-1 text-xl font-bold text-ink">
            {competitor.promptCount}
          </div>
        </div>
        <div>
          <div className="kicker">PLATFORMS</div>
          <div className="mt-1 text-xl font-bold text-ink">
            {competitor.platforms.size}
          </div>
        </div>
      </div>

      {competitor.topPrompt && (
        <div className="mt-4">
          <div className="kicker">TOP PROMPT</div>
          <p
            className="mt-1 line-clamp-2 text-sm text-rich"
            title={competitor.topPrompt.text}
          >
            "{competitor.topPrompt.text}"
          </p>
        </div>
      )}

      <button className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-sm text-mid hover:border-ink hover:text-ink">
        <ExternalLink size={13} />
        View their playbook
      </button>
    </div>
  )
}

function aggregateCompetitors(prompts: PromptWithStatus[]): CompetitorRollup[] {
  // Key by lowercased brand name to dedupe casing variants from different
  // platforms ("Vital Proteins" vs "vital proteins"). Display the first
  // canonical-cased version we saw.
  const byKey = new Map<
    string,
    {
      name: string
      promptIds: Set<string>
      platforms: Set<string>
      topPrompt: { text: string; opportunity: number } | null
    }
  >()

  for (const p of prompts) {
    for (const platform of PLATFORMS) {
      const run = p.runs[platform]
      if (!run) continue
      // Only consider runs that actually completed; pending / errored runs
      // never had a real answer to extract competitors from.
      if (run.status !== 'cited' && run.status !== 'not-cited') continue

      for (const raw of run.competitors) {
        const name = raw.trim()
        if (!name) continue
        const key = name.toLowerCase()
        let entry = byKey.get(key)
        if (!entry) {
          entry = {
            name,
            promptIds: new Set(),
            platforms: new Set(),
            topPrompt: null,
          }
          byKey.set(key, entry)
        }
        entry.promptIds.add(p.prompt.id)
        entry.platforms.add(platform)
        if (
          !entry.topPrompt ||
          p.opportunityScore > entry.topPrompt.opportunity
        ) {
          entry.topPrompt = {
            text: p.prompt.text,
            opportunity: p.opportunityScore,
          }
        }
      }
    }
  }

  return Array.from(byKey.values())
    .map((e) => ({
      name: e.name,
      promptCount: e.promptIds.size,
      platforms: e.platforms,
      topPrompt: e.topPrompt,
    }))
    .sort((a, b) => b.promptCount - a.promptCount)
}

function computeGaps(
  prompts: PromptWithStatus[],
  competitors: CompetitorRollup[],
): PromptGap[] {
  // A gap = a prompt where the brand isn't cited on any platform AND at
  // least one competitor was extracted. Sorted by opportunity (highest =
  // most strategic to claim first).
  const knownCompetitors = new Set(
    competitors.map((c) => c.name.toLowerCase()),
  )
  const gaps: PromptGap[] = []

  for (const p of prompts) {
    const cited = PLATFORMS.some((pl) => p.runs[pl]?.status === 'cited')
    if (cited) continue

    // Pick the most-mentioned-overall competitor that appears in any run
    // for this prompt — that's the "owner" of the gap.
    let bestOwner: { name: string; rank: number } | null = null
    for (const platform of PLATFORMS) {
      const run = p.runs[platform]
      if (!run) continue
      for (const raw of run.competitors) {
        const name = raw.trim()
        if (!name) continue
        const key = name.toLowerCase()
        if (!knownCompetitors.has(key)) continue
        const rank =
          competitors.findIndex((c) => c.name.toLowerCase() === key) + 1
        if (!bestOwner || rank < bestOwner.rank) {
          bestOwner = { name, rank }
        }
      }
    }
    if (!bestOwner) continue
    gaps.push({
      prompt: p.prompt.text,
      owner: bestOwner.name,
      opportunity: p.opportunityScore,
    })
  }

  return gaps.sort((a, b) => b.opportunity - a.opportunity)
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-10 text-center">
      {children}
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="mx-auto max-w-[600px] px-8 py-20 text-center">
      <span className="kicker">COMPETITOR LANDSCAPE</span>
      <h1 className="mt-2 text-[28px] font-bold text-ink">No brand loaded</h1>
      <p className="mt-2 text-sm text-mid">{message}</p>
    </div>
  )
}
