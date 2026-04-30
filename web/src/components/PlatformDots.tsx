import { Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export type Platform = 'ChatGPT' | 'Perplexity' | 'Claude' | 'Gemini'

export interface PlatformStatus {
  platform: Platform
  cited: boolean
}

interface Props {
  statuses: PlatformStatus[]
  size?: 'sm' | 'md'
}

export function PlatformDots({ statuses, size = 'md' }: Props) {
  const dot = size === 'sm' ? 'h-5 w-5' : 'h-6 w-6'
  const icon = size === 'sm' ? 10 : 12
  return (
    <div className="flex items-center gap-3">
      {statuses.map((s) => (
        <div key={s.platform} className="flex items-center gap-1.5">
          <span
            className={cn(
              'inline-flex items-center justify-center rounded-full border',
              dot,
              s.cited
                ? 'border-score-good/40 bg-score-good/10 text-score-good'
                : 'border-line bg-offwhite text-silver',
            )}
            aria-label={s.cited ? 'Cited' : 'Not cited'}
          >
            {s.cited ? <Check size={icon} strokeWidth={3} /> : <X size={icon} strokeWidth={3} />}
          </span>
          <span className="font-mono text-[11px] tracking-wider text-mid">
            {s.platform}
          </span>
        </div>
      ))}
    </div>
  )
}
