import { useNavigate } from 'react-router-dom'
import { ArrowRight, HelpCircle, Loader2 } from 'lucide-react'
import { bandFor } from '@cited/shared'
import { Logo } from '@/components/Logo'
import { ScoreRing } from '@/components/ScoreRing'
import { Button } from '@/components/Button'
import { useBrand } from '@/lib/useBrand'
import { scoreColor } from '@/lib/utils'

const BAND_LABEL: Record<ReturnType<typeof bandFor>, string> = {
  critical: 'CRITICAL',
  warning: 'IMPROVING',
  good: 'GOOD',
}

export function ScoreReveal() {
  const navigate = useNavigate()
  const state = useBrand()

  if (state.kind === 'idle') {
    navigate('/', { replace: true })
    return null
  }
  if (state.kind === 'error') {
    return <CenterMessage title="Couldn't load your score" detail={state.message} />
  }
  if (state.kind === 'loading') {
    return (
      <CenterMessage
        title="Building your score..."
        detail="Querying every available AI model with your prompts."
        loading
      />
    )
  }

  const { summary, prompts, cycleActive } = state.data
  const { brand, current } = summary
  const tagColor = scoreColor(current.score)
  const gaps = current.promptsChecked - current.promptsCited

  const totalPrompts = prompts.length
  const settledPrompts = prompts.filter((p) =>
    Object.values(p.runs).some((r) => r && r.status !== 'pending'),
  ).length
  const cycleInProgress = cycleActive || settledPrompts < totalPrompts

  return (
    <div className="flex min-h-screen flex-col bg-offwhite">
      <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between px-6 py-6">
        <Logo size="md" />
        <span className="kicker">STEP 2 OF 3 · YOUR FIRST SCORE</span>
      </div>

      <div className="flex flex-1 items-center justify-center px-6 pb-16">
        <div className="w-full max-w-[680px]">
          <div className="text-center">
            <span className="kicker">YOUR AI VISIBILITY SCORE</span>
            <h1 className="mt-3 text-[40px] font-extrabold leading-tight tracking-tightest text-ink md:text-[52px]">
              {cycleInProgress ? 'Building your score, live.' : "Here's where you stand."}
            </h1>
          </div>

          <div className="mt-10 flex justify-center">
            <ScoreRing score={current.score} size={220} stroke={16} animate />
          </div>

          <div className="mt-6 text-center">
            <div className="text-lg font-semibold text-ink">{brand.name}</div>
            <div className="text-sm text-mid">{brand.category}</div>
            <span
              className="mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1 font-mono text-[11px] tracking-wider"
              style={{
                backgroundColor: `${tagColor}1a`,
                color: tagColor,
                border: `1px solid ${tagColor}55`,
              }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: tagColor }}
              />
              {BAND_LABEL[current.band]} — {gaps} GAP{gaps === 1 ? '' : 'S'}
            </span>
          </div>

          {cycleInProgress && (
            <div className="mt-6 flex items-center justify-center gap-2 font-mono text-[11px] tracking-wider text-mid">
              <Loader2 size={12} className="animate-spin" />
              SCORING {settledPrompts} OF {totalPrompts} PROMPTS · UPDATES LIVE
            </div>
          )}

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            <Stat label="Prompts checked" value={String(settledPrompts)} sub={`of ${totalPrompts}`} />
            <Stat
              label="Cited in"
              value={String(current.promptsCited)}
              sub={`of ${totalPrompts} prompts`}
            />
            <Stat
              label="Competitor avg"
              value={String(current.competitorAvg)}
              sub="/ 100"
            />
          </div>

          <div className="mt-10 flex flex-col items-center gap-3">
            <Button
              variant="primary"
              size="lg"
              className="w-full max-w-[360px]"
              onClick={() => navigate('/dashboard')}
            >
              See your full prompt report
              <ArrowRight size={16} />
            </Button>
            <button className="inline-flex items-center gap-1.5 text-sm text-mid hover:text-ink">
              <HelpCircle size={14} />
              What does this score mean?
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="card flex flex-col items-center p-5">
      <span className="kicker">{label.toUpperCase()}</span>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-[32px] font-extrabold tracking-tightest text-ink">
          {value}
        </span>
        {sub && <span className="text-xs text-mid">{sub}</span>}
      </div>
    </div>
  )
}

function CenterMessage({
  title,
  detail,
  loading,
}: {
  title: string
  detail: string
  loading?: boolean
}) {
  return (
    <div className="flex min-h-screen flex-col bg-offwhite">
      <div className="mx-auto flex w-full max-w-[1200px] items-center px-6 py-6">
        <Logo size="md" />
      </div>
      <div className="flex flex-1 items-center justify-center px-6">
        <div className="card flex max-w-[420px] flex-col items-center p-10 text-center">
          {loading && (
            <Loader2 className="mb-4 animate-spin text-mid" size={28} />
          )}
          <div className="text-lg font-semibold text-ink">{title}</div>
          <p className="mt-2 text-sm text-mid">{detail}</p>
        </div>
      </div>
    </div>
  )
}
