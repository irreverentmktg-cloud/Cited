import { useState } from 'react'
import { AlertCircle, CheckCircle2, Clock, ExternalLink, MinusCircle } from 'lucide-react'
import type { Platform, PromptRun, PromptWithStatus } from '@cited/shared'
import { PLATFORMS } from '@cited/shared'
import { cn } from '@/lib/utils'

const PLATFORM_LABEL: Record<Platform, string> = {
  claude: 'Claude',
  chatgpt: 'ChatGPT',
  perplexity: 'Perplexity',
  gemini: 'Gemini',
}

const ANSWER_PREVIEW_CHARS = 600

// Renders the per-platform raw responses for a prompt. Used inside the
// SuggestionCard's expandable slot on the Prompts page.
export function PromptDetailsPanel({ prompt }: { prompt: PromptWithStatus }) {
  return (
    <div className="space-y-4">
      <div className="kicker">PER-PLATFORM RESPONSES</div>
      {PLATFORMS.map((platform) => (
        <PlatformBlock
          key={platform}
          platform={platform}
          run={prompt.runs[platform]}
        />
      ))}
    </div>
  )
}

function PlatformBlock({
  platform,
  run,
}: {
  platform: Platform
  run: PromptRun | null
}) {
  if (!run) {
    return (
      <div className="rounded-lg border border-dashed border-line bg-offwhite px-4 py-3 text-sm text-mid">
        <div className="flex items-center gap-2">
          <MinusCircle size={14} />
          <span className="font-semibold">{PLATFORM_LABEL[platform]}</span>
          <span className="text-xs">— provider not connected</span>
        </div>
      </div>
    )
  }

  const Icon =
    run.status === 'cited'
      ? CheckCircle2
      : run.status === 'pending'
        ? Clock
        : run.status === 'error'
          ? AlertCircle
          : MinusCircle

  const statusColor =
    run.status === 'cited'
      ? 'text-score-good'
      : run.status === 'error'
        ? 'text-score-critical'
        : 'text-mid'

  return (
    <div className="rounded-lg border border-line bg-white">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-4 py-3">
        <div className={cn('flex items-center gap-2 font-semibold', statusColor)}>
          <Icon size={14} />
          <span className="text-sm">{PLATFORM_LABEL[platform]}</span>
        </div>
        <span className="font-mono text-[11px] uppercase tracking-wider text-mid">
          {run.status}
          {run.rank != null && ` · rank ${run.rank}`}
        </span>
        {run.model && (
          <span className="font-mono text-[11px] text-silver" title="Model">
            {run.model}
          </span>
        )}
        {run.competitors.length > 0 && (
          <span className="font-mono text-[11px] tracking-wider text-mid">
            {run.competitors.length} COMPETITOR
            {run.competitors.length === 1 ? '' : 'S'}
          </span>
        )}
      </div>

      {run.competitors.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-b border-line px-4 py-3">
          {run.competitors.map((c) => (
            <span
              key={c}
              className="inline-flex items-center rounded-full border border-line bg-offwhite px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-rich"
            >
              {c}
            </span>
          ))}
        </div>
      )}

      <AnswerBody answer={run.rawAnswer} status={run.status} />
    </div>
  )
}

function AnswerBody({
  answer,
  status,
}: {
  answer: string | null
  status: PromptRun['status']
}) {
  const [showFull, setShowFull] = useState(false)

  if (!answer) {
    const placeholder =
      status === 'pending'
        ? "Waiting for this platform's response..."
        : status === 'error'
          ? 'No answer recorded — the call errored before returning text.'
          : 'No answer recorded.'
    return <div className="px-4 py-3 text-sm italic text-mid">{placeholder}</div>
  }

  if (status === 'error') {
    return (
      <div className="px-4 py-3">
        <div className="kicker mb-1.5">ERROR DETAILS</div>
        <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-xs text-score-critical">
          {answer}
        </pre>
      </div>
    )
  }

  const truncated = answer.length > ANSWER_PREVIEW_CHARS && !showFull
  const shown = truncated ? answer.slice(0, ANSWER_PREVIEW_CHARS) + '…' : answer
  const urls = extractUrls(answer)

  return (
    <div className="px-4 py-3">
      <div className="kicker mb-1.5">RAW ANSWER</div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-rich">
        {shown}
      </p>
      {answer.length > ANSWER_PREVIEW_CHARS && (
        <button
          type="button"
          onClick={() => setShowFull((v) => !v)}
          className="mt-2 text-xs font-medium text-mid hover:text-ink"
        >
          {showFull ? 'Show less' : `Show full answer (${answer.length} chars)`}
        </button>
      )}
      {urls.length > 0 && (
        <div className="mt-3 border-t border-line pt-3">
          <div className="kicker mb-1.5">CITED SOURCES</div>
          <ul className="flex flex-col gap-1.5">
            {urls.slice(0, 8).map((url) => (
              <li key={url}>
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-mid hover:text-ink"
                >
                  <ExternalLink size={11} />
                  <span className="truncate">{url}</span>
                </a>
              </li>
            ))}
            {urls.length > 8 && (
              <li className="text-xs text-silver">+{urls.length - 8} more</li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

function extractUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s)>\]]+/g) ?? []
  return Array.from(new Set(matches))
}
