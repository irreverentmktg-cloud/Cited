import { NavLink } from 'react-router-dom'
import { LayoutGrid, ListChecks, Settings, Users2 } from 'lucide-react'
import { Logo } from './Logo'
import { ScoreRing } from './ScoreRing'
import { cn } from '@/lib/utils'

interface SidebarProps {
  brandName?: string | null
  category?: string | null
  score?: number | null
  promptsCount?: number | null
  plan?: { name: string; used: number; total: number }
}

export function Sidebar({
  brandName,
  category,
  score,
  promptsCount,
  plan = { name: 'Starter', used: 0, total: 50 },
}: SidebarProps) {
  const items = [
    { to: '/dashboard', label: 'Overview', icon: LayoutGrid, end: true },
    {
      to: '/dashboard/prompts',
      label: 'Prompts',
      icon: ListChecks,
      badge: promptsCount != null ? String(promptsCount) : undefined,
    },
    { to: '/dashboard/competitors', label: 'Competitors', icon: Users2 },
    { to: '/dashboard/settings', label: 'Settings', icon: Settings },
  ]
  const planPct = Math.min(100, Math.round((plan.used / plan.total) * 100))

  return (
    <aside className="sticky top-0 flex h-screen w-[260px] shrink-0 flex-col border-r border-line bg-white">
      <div className="px-6 pt-6">
        <Logo size="md" />
      </div>

      <div className="mt-6 px-6">
        <div className="kicker">CURRENT BRAND</div>
        <div className="mt-1 text-sm font-semibold text-ink">
          {brandName ?? <span className="text-mid">No brand loaded</span>}
        </div>
        <div className="text-xs text-mid">{category ?? '—'}</div>
      </div>

      <div className="mt-5 flex justify-center px-6">
        <ScoreRing score={score ?? 0} size={96} stroke={8} animate={false} showLabel={false} />
      </div>

      <nav className="mt-6 flex flex-col gap-1 px-3">
        {items.map(({ to, label, icon: Icon, badge, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-ink text-white'
                  : 'text-mid hover:bg-offwhite hover:text-ink',
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={16} className={cn(isActive ? 'text-white' : 'text-mid group-hover:text-ink')} />
                <span className="flex-1">{label}</span>
                {badge && (
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-0.5 font-mono text-[10px] tracking-wider',
                      isActive
                        ? 'bg-white/15 text-white'
                        : 'bg-offwhite text-mid group-hover:bg-white',
                    )}
                  >
                    {badge}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto border-t border-line p-5">
        <div className="flex items-center justify-between">
          <span className="kicker">PLAN · {plan.name.toUpperCase()}</span>
          <span className="font-mono text-[11px] text-mid">
            {plan.used}/{plan.total}
          </span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-line">
          <div
            className="chrome-fill h-full rounded-full transition-all"
            style={{ width: `${planPct}%` }}
          />
        </div>
        <button className="mt-3 w-full rounded-lg bg-chrome px-3 py-2 text-xs font-medium text-ink shadow-chrome hover:brightness-105">
          Upgrade plan
        </button>
      </div>
    </aside>
  )
}
