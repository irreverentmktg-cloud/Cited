import type { ReactNode } from 'react'
import type { Brand, ScoreSnapshot } from '@cited/shared'
import { useBrand } from '@/lib/useBrand'
import { Sidebar } from './Sidebar'

interface DashboardLayoutProps {
  children: ReactNode
  // Optional overrides — pages that already have brand data in scope can pass
  // it through to avoid an extra fetch, but the layout will fall back to the
  // shared useBrand loader if not provided.
  brand?: Brand | null
  current?: ScoreSnapshot | null
  promptsCount?: number | null
}

export function DashboardLayout({
  children,
  brand,
  current,
  promptsCount,
}: DashboardLayoutProps) {
  const state = useBrand()

  const liveBrand =
    brand ?? (state.kind === 'ready' ? state.data.summary.brand : null)
  const liveCurrent =
    current ?? (state.kind === 'ready' ? state.data.summary.current : null)
  const livePromptsCount =
    promptsCount ??
    (state.kind === 'ready' ? state.data.prompts.length : null)

  return (
    <div className="flex min-h-screen bg-offwhite">
      <Sidebar
        brandName={liveBrand?.name}
        category={liveBrand?.category}
        score={liveCurrent?.score}
        promptsCount={livePromptsCount}
      />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  )
}
