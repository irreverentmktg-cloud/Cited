import { useEffect, useState } from 'react'
import { scoreColor, scoreLabel } from '@/lib/utils'

interface ScoreRingProps {
  score: number
  size?: number
  stroke?: number
  animate?: boolean
  showLabel?: boolean
  caption?: string
}

export function ScoreRing({
  score,
  size = 120,
  stroke = 10,
  animate = true,
  showLabel = true,
  caption,
}: ScoreRingProps) {
  const [displayScore, setDisplayScore] = useState(animate ? 0 : score)

  useEffect(() => {
    if (!animate) {
      setDisplayScore(score)
      return
    }
    const start = performance.now()
    const duration = 900
    let raf: number
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplayScore(Math.round(score * eased))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [score, animate])

  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (displayScore / 100) * circumference
  const color = scoreColor(score)

  const numberSize = size <= 60 ? 18 : size <= 90 ? 28 : 40

  return (
    <div className="relative inline-flex flex-col items-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e5e5e5"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: animate ? 'stroke-dashoffset 60ms linear' : undefined }}
        />
      </svg>
      <div
        className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
        aria-hidden
      >
        <span
          className="font-extrabold tracking-tightest"
          style={{ color, fontSize: numberSize, lineHeight: 1 }}
        >
          {displayScore}
        </span>
        {size >= 90 && (
          <span className="kicker mt-1" style={{ color: '#9b9b9b' }}>
            / 100
          </span>
        )}
      </div>
      {showLabel && (
        <div className="mt-3 text-center">
          <div
            className="kicker"
            style={{ color }}
          >
            {scoreLabel(score)}
          </div>
          {caption && <div className="mt-1 text-xs text-mid">{caption}</div>}
        </div>
      )}
    </div>
  )
}
