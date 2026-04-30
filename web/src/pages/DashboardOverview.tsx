import { ArrowRight, Bell, Flame, Loader2, TrendingDown, TrendingUp } from 'lucide-react'
import type {
  Brand,
  Platform,
  PromptRun,
  PromptWithStatus,
  ScoreSnapshot,
} from '@cited/shared'
import { PLATFORMS } from '@cited/shared'
import { DashboardLayout } from '@/components/DashboardLayout'
import { SuggestionCard } from '@/components/SuggestionCard'
import type { PlatformStatus } from '@/components/PlatformDots'
import { useBrand } from '@/lib/useBrand'
import { cn } from '@/lib/utils'

export function DashboardOverview() {
  const state = useBrand()

  if (state.kind === 'loading') {
    return (
      <DashboardLayout>
        <Centered>
          <Loader2 className="animate-spin text-mid" />
          <span className="text-sm text-mid">Loading your dashboard...</span>
        </Centered>
      </DashboardLayout>
    )
  }

  if (state.kind === 'error') {
    return (
      <DashboardLayout>
        <Centered>
          <div className="text-base font-semibold text-ink">
            Couldn't load your data
          </div>
          <div className="text-sm text-mid">{state.message}</div>
        </Centered>
      </DashboardLayout>
    )
  }

  if (state.kind === 'ready') {
    return (
      <LiveOverview
        brand={state.data.summary.brand}
        current={state.data.summary.current}
        prompts={state.data.prompts}
      />
    )
  }

  return <DemoOverview />
}

// ---- Live: backed by the real /api/brands/:id response ---------------------

function LiveOverview({
  brand,
  current,
  prompts,
}: {
  brand: Brand
  current: ScoreSnapshot
  prompts: PromptWithStatus[]
}) {
  const date = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  // The "today's prompt" is the highest-opportunity prompt that's not yet
  // cited on every available platform. Falls back to first prompt if list is
  // entirely covered.
  const sorted = [...prompts].sort((a, b) => b.opportunityScore - a.opportunityScore)
  const today = sorted[0]

  return (
    <DashboardLayout brand={brand} current={current}>
      <div className="mx-auto max-w-[1100px] px-8 py-10">
        <div className="flex items-end justify-between">
          <div>
            <span className="kicker">{date.toUpperCase()}</span>
            <h1 className="mt-2 text-[34px] font-bold tracking-tightest text-ink">
              Good morning.
            </h1>
            <p className="mt-1 text-sm text-mid">
              Score{' '}
              <span className="font-semibold text-ink">{current.score}/100</span>
              {' · '}
              cited in {current.promptsCited} of {current.promptsChecked} prompts.
            </p>
          </div>
          <button className="inline-flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-sm text-mid hover:border-ink hover:text-ink">
            <Bell size={14} />
            Alerts
          </button>
        </div>

        {today ? (
          <div className="mt-8">
            <SuggestionCard
              badge="TODAY'S PROMPT · CLAIM FIRST"
              prompt={today.prompt.text}
              platforms={platformStatusList(today.runs)}
              opportunity={today.opportunityScore}
              recommended={overviewRecommendation(today)}
              chips={[today.prompt.awarenessStage.toUpperCase(), 'OPPORTUNITY ' + today.opportunityScore]}
            />
          </div>
        ) : (
          <div className="card mt-8 p-6 text-sm text-mid">
            No prompts yet. The score cycle hasn't run.
          </div>
        )}

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          <SummaryCard
            label="Score"
            value={`${current.score}`}
            sub={`band: ${current.band}`}
          />
          <SummaryCard
            label="Cited prompts"
            value={`${current.promptsCited}`}
            sub={`of ${current.promptsChecked}`}
          />
          <StreakCard days={1} />
        </div>
      </div>
    </DashboardLayout>
  )
}

function overviewRecommendation(p: PromptWithStatus): string {
  // Use the first non-empty LLM-generated recommendation across platforms.
  // Falls back to a brief "re-run scoring" hint until the new pipeline runs.
  for (const platform of PLATFORMS) {
    const run = p.runs[platform]
    if (run?.recommendedContent && run.recommendedContent.trim()) {
      return run.recommendedContent
    }
  }
  return "Re-run scoring to generate a tailored recommendation for this prompt — the new pipeline analyzes the AI's actual answer against your brand profile."
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

function SummaryCard({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub: string
}) {
  return (
    <div className="card p-5">
      <span className="kicker">{label.toUpperCase()}</span>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-[36px] font-extrabold tracking-tightest text-ink">
          {value}
        </span>
        <span className="text-xs text-mid">{sub}</span>
      </div>
    </div>
  )
}

// ---- Demo: shown when no brand has been onboarded yet ---------------------

function DemoOverview() {
  const date = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-[1100px] px-8 py-10">
        <div className="flex items-end justify-between">
          <div>
            <span className="kicker">{date.toUpperCase()} · DEMO</span>
            <h1 className="mt-2 text-[34px] font-bold tracking-tightest text-ink">
              Good morning, Jake.
            </h1>
            <p className="mt-1 text-sm text-mid">
              Demo data shown — analyze a real URL to populate your dashboard.
            </p>
          </div>
          <button className="inline-flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-sm text-mid hover:border-ink hover:text-ink">
            <Bell size={14} />
            3 alerts
          </button>
        </div>

        <div className="mt-8">
          <SuggestionCard
            badge="TODAY'S PROMPT · CLAIM FIRST"
            prompt="best collagen powder for women over 40"
            highlight="best collagen powder"
            platforms={[
              { platform: 'ChatGPT', cited: false },
              { platform: 'Perplexity', cited: true },
              { platform: 'Gemini', cited: false },
              { platform: 'Claude', cited: false },
            ]}
            opportunity={92}
            recommended="Publish a comparison post: 'Marine vs bovine collagen for women over 40.' Cite 2 peer-reviewed studies on hydrolyzed collagen + skin elasticity."
            chips={[
              'Listicle',
              'Comparison',
              '900–1200 words',
              'Schema: HowTo',
              'Cite 2 studies',
            ]}
          />
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          <AlertCard
            kind="good"
            title="You were cited in ChatGPT"
            body="Your blog 'How marine collagen supports joint health' was cited in 3 new prompts overnight."
            time="2h ago"
          />
          <AlertCard
            kind="warning"
            title="Vital Proteins claimed 2 prompts"
            body="They published a clinical study summary. They now own 'collagen for joint pain'."
            time="6h ago"
          />
          <StreakCard days={7} />
        </div>

        <div className="mt-10">
          <div className="flex items-end justify-between">
            <div>
              <span className="kicker">RECENT MOVEMENT</span>
              <h2 className="mt-1 text-[20px] font-semibold text-ink">
                Prompts that moved this week
              </h2>
            </div>
            <a
              className="inline-flex items-center gap-1 text-sm text-mid hover:text-ink"
              href="/dashboard/prompts"
            >
              View all <ArrowRight size={14} />
            </a>
          </div>

          <div className="card mt-4 divide-y divide-line">
            {MOVEMENTS.map((m) => (
              <MovementRow key={m.prompt} {...m} />
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="card flex flex-col items-center gap-3 px-8 py-10 text-center">
        {children}
      </div>
    </div>
  )
}

interface AlertProps {
  kind: 'good' | 'warning'
  title: string
  body: string
  time: string
}

function AlertCard({ kind, title, body, time }: AlertProps) {
  const color = kind === 'good' ? '#22c55e' : '#f59e0b'
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[10px] tracking-wider"
          style={{ backgroundColor: `${color}1a`, color }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: color }}
          />
          {kind === 'good' ? 'CITATION' : 'COMPETITOR'}
        </span>
        <span className="font-mono text-[10px] text-silver">{time.toUpperCase()}</span>
      </div>
      <h3 className="mt-3 text-[15px] font-semibold text-ink">{title}</h3>
      <p className="mt-1 text-sm text-mid">{body}</p>
    </div>
  )
}

function StreakCard({ days }: { days: number }) {
  const bars = Array.from({ length: 7 }, (_, i) => i < days)
  return (
    <div className="card flex flex-col p-5">
      <div className="flex items-center justify-between">
        <span className="kicker">DAY STREAK</span>
        <Flame size={16} className="text-mid" />
      </div>
      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-[36px] font-extrabold tracking-tightest text-ink">
          {days}
        </span>
        <span className="text-mid">days</span>
      </div>
      <div className="mt-4 grid grid-cols-7 gap-1.5">
        {bars.map((on, i) => (
          <div
            key={i}
            className={cn(
              'h-8 rounded-sm transition-colors',
              on ? 'bg-ink' : 'bg-line',
            )}
          />
        ))}
      </div>
      <p className="mt-3 text-xs text-mid">
        Show up daily. Compound your AI authority.
      </p>
    </div>
  )
}

interface Movement {
  prompt: string
  delta: number
  before: string
  after: string
}

const MOVEMENTS: Movement[] = [
  {
    prompt: 'best collagen for joint pain',
    delta: +12,
    before: 'Not cited',
    after: 'Cited · Perplexity',
  },
  {
    prompt: 'unflavored marine collagen',
    delta: +6,
    before: 'Cited · Perplexity',
    after: 'Cited · Perplexity, Gemini',
  },
  {
    prompt: 'is hydrolyzed collagen worth it',
    delta: -3,
    before: 'Cited · ChatGPT',
    after: 'Lost · Vital claimed it',
  },
  {
    prompt: 'cheapest grass-fed collagen',
    delta: +9,
    before: 'Not cited',
    after: 'Cited · ChatGPT',
  },
]

function MovementRow({ prompt, delta, before, after }: Movement) {
  const positive = delta >= 0
  const Icon = positive ? TrendingUp : TrendingDown
  const color = positive ? '#22c55e' : '#ef4444'
  return (
    <div className="flex items-center justify-between gap-6 px-5 py-4">
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-medium text-ink">{prompt}</div>
        <div className="mt-1 truncate font-mono text-[11px] tracking-wider text-mid">
          {before.toUpperCase()} → {after.toUpperCase()}
        </div>
      </div>
      <div
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[11px] tracking-wider"
        style={{ backgroundColor: `${color}1a`, color }}
      >
        <Icon size={12} />
        {positive ? '+' : ''}
        {delta}
      </div>
    </div>
  )
}
