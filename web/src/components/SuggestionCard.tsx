import { useState, type ReactNode } from 'react'
import {
  ArrowRight,
  Bookmark,
  ChevronDown,
  ChevronUp,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import { PlatformDots, type PlatformStatus } from './PlatformDots'
import { cn } from '@/lib/utils'

interface SuggestionCardProps {
  badge?: string
  prompt: string
  highlight?: string
  platforms: PlatformStatus[]
  opportunity: number
  recommended: string
  chips: string[]
  locked?: boolean
  className?: string
  // Optional expanded section. When provided, renders a "Show full responses"
  // toggle that reveals the children below the recommendation block. Used on
  // the Prompts page to surface per-platform raw answers; left undefined on
  // the Overview's "today's prompt" so the card stays compact.
  expandable?: ReactNode
}

export function SuggestionCard({
  badge = "TODAY'S PROMPT · CLAIM FIRST",
  prompt,
  highlight,
  platforms,
  opportunity,
  recommended,
  chips,
  locked = false,
  className,
  expandable,
}: SuggestionCardProps) {
  const [open, setOpen] = useState(false)
  const renderPrompt = () => {
    if (!highlight) return prompt
    const idx = prompt.toLowerCase().indexOf(highlight.toLowerCase())
    if (idx === -1) return prompt
    return (
      <>
        {prompt.slice(0, idx)}
        <span className="chrome-text font-extrabold">
          {prompt.slice(idx, idx + highlight.length)}
        </span>
        {prompt.slice(idx + highlight.length)}
      </>
    )
  }

  return (
    <div className={cn('card relative overflow-hidden p-6', locked && 'select-none', className)}>
      {locked && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 backdrop-blur-[3px]">
          <div className="card flex items-center gap-3 px-4 py-3">
            <Sparkles size={16} className="text-ink" />
            <div className="text-sm">
              <div className="font-semibold">Unlock more prompts</div>
              <div className="text-xs text-mid">Upgrade to Growth — 200 prompts/mo</div>
            </div>
            <button className="ml-2 rounded-md bg-ink px-3 py-1.5 text-xs font-medium text-white">
              Upgrade
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="kicker">{badge}</span>
        <div className="flex items-center gap-2 text-mid">
          <TrendingUp size={14} />
          <span className="font-mono text-[11px] tracking-wider">
            OPPORTUNITY · {opportunity}
          </span>
        </div>
      </div>

      <h3 className="mt-3 text-[22px] font-bold leading-tight tracking-tight text-ink">
        “{renderPrompt()}”
      </h3>

      <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
        <PlatformDots statuses={platforms} />
      </div>

      <div className="mt-5 rounded-lg border border-line bg-[#f8f8f8] p-4">
        <div className="kicker mb-1.5">RECOMMENDED CONTENT</div>
        <p className="text-sm leading-relaxed text-rich">{recommended}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {chips.map((chip) => (
            <span
              key={chip}
              className="inline-flex items-center rounded-full border border-line bg-white px-3 py-1 font-mono text-[11px] tracking-wide text-mid"
            >
              {chip}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between">
        <button className="inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-white hover:bg-rich">
          Generate content draft
          <ArrowRight size={14} />
        </button>
        <div className="flex items-center gap-4">
          {expandable && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 text-sm text-mid hover:text-ink"
            >
              {open ? (
                <>
                  <ChevronUp size={14} />
                  Hide full responses
                </>
              ) : (
                <>
                  <ChevronDown size={14} />
                  Show full responses
                </>
              )}
            </button>
          )}
          <button className="inline-flex items-center gap-1.5 text-sm text-mid hover:text-ink">
            <Bookmark size={14} />
            Save for later
          </button>
        </div>
      </div>

      {expandable && open && (
        <div className="mt-5 border-t border-line pt-5">{expandable}</div>
      )}
    </div>
  )
}
