import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AlertCircle, Check, Loader2 } from 'lucide-react'
import type { AnalyzeResponse } from '@cited/shared'
import { Logo } from '@/components/Logo'
import { Button } from '@/components/Button'
import { api, ApiCallError } from '@/lib/api'
import { saveDraft } from '@/lib/onboarding'
import { cn } from '@/lib/utils'

const STEPS = [
  'Scanning site content',
  'Identifying product category',
  'Building your prompt list',
]

const MIN_ANIMATION_MS = 4200

type State =
  | { kind: 'running'; stepIdx: number }
  | { kind: 'error'; message: string }

// Module-level cache so React strict-mode's mount/unmount/mount cycle doesn't
// fire two analyze calls. The cache entry is cleared once the request settles
// so retries (after error) start fresh.
const inflight = new Map<string, Promise<AnalyzeResponse>>()

function analyzeOnce(url: string): Promise<AnalyzeResponse> {
  let p = inflight.get(url)
  if (!p) {
    p = api.analyze(url)
    inflight.set(url, p)
    p.finally(() => inflight.delete(url))
  }
  return p
}

export function Analyzing() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const url = params.get('url') ?? ''
  const [state, setState] = useState<State>({ kind: 'running', stepIdx: 0 })

  useEffect(() => {
    if (!url) {
      navigate('/', { replace: true })
      return
    }

    const startedAt = Date.now()
    const timers: number[] = []
    timers.push(window.setTimeout(() => stepTo(1), 1100))
    timers.push(window.setTimeout(() => stepTo(2), 2300))

    let cancelled = false

    analyzeOnce(url)
      .then(async ({ draft }) => {
        if (cancelled) return
        saveDraft(draft)
        const elapsed = Date.now() - startedAt
        const remaining = Math.max(0, MIN_ANIMATION_MS - elapsed)
        await new Promise((r) => setTimeout(r, remaining))
        if (cancelled) return
        navigate(`/calibration?url=${encodeURIComponent(url)}`)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const message =
          err instanceof ApiCallError
            ? err.message
            : "We couldn't analyze that URL. Try a different one."
        setState({ kind: 'error', message })
      })

    function stepTo(idx: number) {
      setState((prev) =>
        prev.kind === 'running' && idx > prev.stepIdx
          ? { kind: 'running', stepIdx: idx }
          : prev,
      )
    }

    return () => {
      cancelled = true
      timers.forEach((t) => clearTimeout(t))
    }
  }, [navigate, url])

  return (
    <div className="flex min-h-screen flex-col bg-offwhite">
      <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between px-6 py-6">
        <Logo size="md" />
        <span className="kicker">ANALYZING</span>
      </div>

      <div className="flex flex-1 items-center justify-center px-6">
        <div className="w-full max-w-[560px]">
          <div className="text-center">
            <span className="kicker">ANALYZING</span>
            <h1 className="mt-3 text-[28px] font-bold tracking-tight text-ink">
              Analyzing <span className="chrome-text font-extrabold">{url}</span>
            </h1>
            <p className="mt-2 text-sm text-mid">
              We're checking 50+ prompts across ChatGPT, Perplexity, and Gemini
              for your category.
            </p>
          </div>

          {state.kind === 'error' ? (
            <div className="card mt-10 p-8">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-score-critical/10 text-score-critical">
                  <AlertCircle size={16} />
                </span>
                <div className="flex-1">
                  <div className="text-base font-semibold text-ink">
                    Couldn't analyze that URL
                  </div>
                  <p className="mt-1 text-sm text-mid">{state.message}</p>
                </div>
              </div>
              <div className="mt-5 flex gap-3">
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => navigate('/')}
                  className="flex-1"
                >
                  Try another URL
                </Button>
              </div>
            </div>
          ) : (
            <div className="card mt-10 p-8">
              <div className="relative h-2 w-full overflow-hidden rounded-full bg-line">
                <div className="chrome-shimmer-bar absolute inset-0" />
              </div>

              <ul className="mt-8 flex flex-col gap-3">
                {STEPS.map((s, i) => {
                  const done = i < state.stepIdx
                  const active = i === state.stepIdx
                  return (
                    <li
                      key={s}
                      className={cn(
                        'flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors',
                        done
                          ? 'border-line bg-white'
                          : active
                            ? 'border-line bg-offwhite'
                            : 'border-line bg-white opacity-60',
                      )}
                    >
                      <span
                        className={cn(
                          'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
                          done
                            ? 'bg-score-good/15 text-score-good'
                            : active
                              ? 'bg-ink text-white'
                              : 'bg-line text-mid',
                        )}
                      >
                        {done ? (
                          <Check size={13} strokeWidth={3} />
                        ) : active ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <span className="font-mono text-[11px]">{i + 1}</span>
                        )}
                      </span>
                      <span
                        className={cn(
                          'text-sm',
                          done
                            ? 'text-mid line-through decoration-line'
                            : active
                              ? 'font-semibold text-ink'
                              : 'text-mid',
                        )}
                      >
                        {s}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          <div className="mt-6 text-center font-mono text-[11px] tracking-wider text-silver">
            DO NOT CLOSE THIS WINDOW
          </div>
        </div>
      </div>
    </div>
  )
}
