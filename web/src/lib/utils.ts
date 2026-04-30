export type ScoreTier = 'critical' | 'warning' | 'good'

export function tierForScore(score: number): ScoreTier {
  if (score < 40) return 'critical'
  if (score < 70) return 'warning'
  return 'good'
}

export function scoreColor(score: number): string {
  const t = tierForScore(score)
  if (t === 'critical') return '#ef4444'
  if (t === 'warning') return '#f59e0b'
  return '#22c55e'
}

export function scoreLabel(score: number): string {
  const t = tierForScore(score)
  if (t === 'critical') return 'Critical'
  if (t === 'warning') return 'Improving'
  return 'Good'
}

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}
