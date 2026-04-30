import { useMemo, useState } from 'react'
import { Filter, Loader2, Search } from 'lucide-react'
import type {
  Brand,
  Platform,
  PromptRun,
  PromptWithStatus,
  ScoreSnapshot,
} from '@cited/shared'
import { PLATFORMS } from '@cited/shared'
import { DashboardLayout } from '@/components/DashboardLayout'
import { PromptDetailsPanel } from '@/components/PromptDetailsPanel'
import { SuggestionCard } from '@/components/SuggestionCard'
import type { PlatformStatus } from '@/components/PlatformDots'
import { useBrand } from '@/lib/useBrand'
import { cn } from '@/lib/utils'

type FilterKey = 'all' | 'not-cited' | 'cited' | 'unavailable'

export function DashboardPrompts() {
  const state = useBrand()

  if (state.kind === 'loading') {
    return (
      <DashboardLayout>
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="animate-spin text-mid" />
        </div>
      </DashboardLayout>
    )
  }
  if (state.kind === 'error') {
    return (
      <DashboardLayout>
        <div className="flex min-h-screen items-center justify-center text-sm text-mid">
          {state.message}
        </div>
      </DashboardLayout>
    )
  }
  if (state.kind === 'ready') {
    return (
      <LivePrompts
        brand={state.data.summary.brand}
        current={state.data.summary.current}
        prompts={state.data.prompts}
      />
    )
  }
  return <DemoPrompts />
}

function LivePrompts({
  brand,
  current,
  prompts,
}: {
  brand: Brand
  current: ScoreSnapshot
  prompts: PromptWithStatus[]
}) {
  const [filter, setFilter] = useState<FilterKey>('all')
  const [search, setSearch] = useState('')

  const counts = useMemo(() => countByFilter(prompts), [prompts])

  const FILTERS: { key: FilterKey; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'not-cited', label: 'Not cited' },
    { key: 'cited', label: 'Cited' },
    { key: 'unavailable', label: 'Pending platforms' },
  ]

  const filtered = prompts
    .filter((p) => matchesFilter(p, filter))
    .filter(
      (p) =>
        search === '' ||
        p.prompt.text.toLowerCase().includes(search.toLowerCase()),
    )
    .sort((a, b) => b.opportunityScore - a.opportunityScore)

  return (
    <DashboardLayout brand={brand} current={current}>
      <div className="mx-auto max-w-[1100px] px-8 py-10">
        <div className="flex items-end justify-between">
          <div>
            <span className="kicker">YOUR PROMPT LIST</span>
            <h1 className="mt-2 text-[34px] font-bold tracking-tightest text-ink">
              {prompts.length} prompts monitored
            </h1>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors',
                  filter === f.key
                    ? 'border-ink bg-ink text-white'
                    : 'border-line bg-white text-mid hover:border-ink hover:text-ink',
                )}
              >
                {f.label}
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.5 font-mono text-[10px]',
                    filter === f.key
                      ? 'bg-white/15 text-white'
                      : 'bg-offwhite text-mid',
                  )}
                >
                  {counts[f.key]}
                </span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-silver"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search prompts"
                className="h-9 w-[260px] rounded-lg border border-line bg-white pl-8 pr-3 text-sm text-ink placeholder:text-silver focus:border-ink focus:outline-none"
              />
            </div>
            <button className="inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-white px-3 text-sm text-mid hover:border-ink hover:text-ink">
              <Filter size={14} /> Filters
            </button>
          </div>
        </div>

        <div className="mt-8">
          <div className="kicker">
            TODAY ·{' '}
            {new Date()
              .toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })
              .toUpperCase()}
          </div>
          <div className="mt-4 flex flex-col gap-5">
            {filtered.map((p) => (
              <SuggestionCard
                key={p.prompt.id}
                prompt={p.prompt.text}
                platforms={platformStatusList(p.runs)}
                opportunity={p.opportunityScore}
                recommended={recommendation(p)}
                chips={[
                  p.prompt.awarenessStage.toUpperCase(),
                  `OPPORTUNITY ${p.opportunityScore}`,
                ]}
                badge={
                  p.opportunityScore >= 80
                    ? "TODAY'S PROMPT · CLAIM FIRST"
                    : 'PROMPT'
                }
                expandable={<PromptDetailsPanel prompt={p} />}
              />
            ))}
            {filtered.length === 0 && (
              <div className="card p-10 text-center text-mid">
                No prompts match this filter.
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

function platformStatusList(
  runs: Record<Platform, PromptRun | null>,
): PlatformStatus[] {
  return [
    { platform: 'ChatGPT', cited: runs.chatgpt?.status === 'cited' },
    { platform: 'Perplexity', cited: runs.perplexity?.status === 'cited' },
    { platform: 'Gemini', cited: runs.gemini?.status === 'cited' },
    { platform: 'Claude', cited: runs.claude?.status === 'cited' },
  ]
}

function matchesFilter(p: PromptWithStatus, filter: FilterKey): boolean {
  const anyCited = PLATFORMS.some((pl) => p.runs[pl]?.status === 'cited')
  const anyAvailable = PLATFORMS.some((pl) => p.runs[pl] !== null)
  switch (filter) {
    case 'all':
      return true
    case 'cited':
      return anyCited
    case 'not-cited':
      return !anyCited && anyAvailable
    case 'unavailable':
      return !anyAvailable
  }
}

function countByFilter(prompts: PromptWithStatus[]): Record<FilterKey, number> {
  return {
    all: prompts.length,
    cited: prompts.filter((p) => matchesFilter(p, 'cited')).length,
    'not-cited': prompts.filter((p) => matchesFilter(p, 'not-cited')).length,
    unavailable: prompts.filter((p) => matchesFilter(p, 'unavailable')).length,
  }
}

function recommendation(p: PromptWithStatus): string {
  // Prefer a real LLM-generated recommendation if any platform has one stored.
  // First non-empty wins; we don't merge across platforms because each was
  // generated against a different AI's answer and combining would muddle the
  // tactical advice.
  for (const platform of PLATFORMS) {
    const run = p.runs[platform]
    if (run?.recommendedContent && run.recommendedContent.trim()) {
      return run.recommendedContent
    }
  }
  // Fallback templates for prompts that haven't been re-run with the new
  // recommendation step yet (or where recommendation generation failed).
  const claudeRun = p.runs.claude
  if (claudeRun?.status === 'cited') {
    return `Claude already cites you here (rank ${claudeRun.rank ?? '—'}). Re-run scoring to generate a tailored reinforcement plan based on the actual answer.`
  }
  if (claudeRun?.status === 'not-cited') {
    return `Claude's web search returned an answer that didn't include your brand. Re-run scoring to generate a tailored "what to publish" recommendation from the answer.`
  }
  return 'Connect more provider keys (OpenAI, Perplexity, Google) to see how this prompt performs across all four AI search platforms.'
}

// ---- Demo: shown when no brand has been onboarded ------------------------

function DemoPrompts() {
  const FILTERS: { key: 'all'; label: string; count: number }[] = [
    { key: 'all', label: 'Demo prompts', count: 5 },
  ]

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-[1100px] px-8 py-10">
        <div className="flex items-end justify-between">
          <div>
            <span className="kicker">DEMO · YOUR PROMPT LIST</span>
            <h1 className="mt-2 text-[34px] font-bold tracking-tightest text-ink">
              5 demo prompts
            </h1>
            <p className="mt-1 text-sm text-mid">
              Analyze a real URL on the home page to populate this with your
              actual prompts.
            </p>
          </div>
        </div>
        <div className="mt-8 flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              className="inline-flex items-center gap-2 rounded-full border border-ink bg-ink px-3 py-1.5 text-sm text-white"
            >
              {f.label}
              <span className="rounded-full bg-white/15 px-1.5 py-0.5 font-mono text-[10px] text-white">
                {f.count}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-8 flex flex-col gap-5">
          {DEMO_PROMPTS.map((p) => (
            <SuggestionCard
              key={p.id}
              prompt={p.prompt}
              highlight={p.highlight}
              platforms={p.platforms}
              opportunity={p.opportunity}
              recommended={p.recommended}
              chips={p.chips}
            />
          ))}
        </div>
      </div>
    </DashboardLayout>
  )
}

const DEMO_PROMPTS = [
  {
    id: 'p1',
    prompt: 'best collagen powder for women over 40',
    highlight: 'best collagen powder',
    platforms: [
      { platform: 'ChatGPT', cited: false },
      { platform: 'Perplexity', cited: true },
      { platform: 'Gemini', cited: false },
      { platform: 'Claude', cited: false },
    ] as PlatformStatus[],
    opportunity: 92,
    recommended:
      'Publish a side-by-side comparison: marine vs bovine collagen for women over 40. Cite 2 peer-reviewed studies on hydrolyzed collagen + skin elasticity.',
    chips: ['Listicle', 'Comparison', '900–1200 words', 'Schema: HowTo'],
  },
  {
    id: 'p2',
    prompt: 'collagen for joint pain that actually works',
    highlight: 'joint pain',
    platforms: [
      { platform: 'ChatGPT', cited: false },
      { platform: 'Perplexity', cited: false },
      { platform: 'Gemini', cited: false },
      { platform: 'Claude', cited: false },
    ] as PlatformStatus[],
    opportunity: 88,
    recommended:
      'Vital Proteins owns this. Counter with a 12-week customer outcome study + before/after testimonials.',
    chips: ['Outcome study', 'Long-form', 'Testimonials', 'Schema: Article'],
  },
  {
    id: 'p3',
    prompt: 'unflavored grass-fed collagen with no fillers',
    highlight: 'unflavored grass-fed collagen',
    platforms: [
      { platform: 'ChatGPT', cited: true },
      { platform: 'Perplexity', cited: true },
      { platform: 'Gemini', cited: false },
      { platform: 'Claude', cited: false },
    ] as PlatformStatus[],
    opportunity: 74,
    recommended:
      'You own ChatGPT and Perplexity here. Publish a sourcing transparency page to claim Gemini and Claude.',
    chips: ['Sourcing page', 'Transparency', 'Trust signals'],
  },
]
