import { useEffect, useState } from 'react'
import {
  Check,
  Loader2,
  Mail,
  Pencil,
  Plus,
  RefreshCw,
  Slack,
  UserPlus,
  X,
} from 'lucide-react'
import type { Brand, BrandPatch } from '@cited/shared'
import { DashboardLayout } from '@/components/DashboardLayout'
import { Button } from '@/components/Button'
import { api, ApiCallError } from '@/lib/api'
import { useBrand } from '@/lib/useBrand'
import { cn } from '@/lib/utils'

const FIELD_MAX_CHARS = 120

type ProfileFieldKey = Exclude<keyof Brand, 'id' | 'category' | 'createdAt'>

const PROFILE_FIELDS: Array<{ key: ProfileFieldKey; label: string }> = [
  { key: 'name', label: 'Brand name' },
  { key: 'url', label: 'Website' },
  { key: 'productType', label: 'Product type' },
  { key: 'primaryClaim', label: 'Primary claim' },
  { key: 'targetBuyer', label: 'Target buyer' },
  { key: 'pricePosition', label: 'Price position' },
  { key: 'differentiator', label: 'Differentiator' },
]

const TEAM = [
  { name: 'Jake McKenzie', email: 'jake@bloomcollagen.com', role: 'Owner' },
  { name: 'Maya Rivera', email: 'maya@bloomcollagen.com', role: 'Editor' },
]

export function DashboardSettings() {
  const [notifications, setNotifications] = useState({
    daily: true,
    citation: true,
    competitor: true,
    weekly: false,
    slack: false,
  })

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-[1100px] px-8 py-10">
        <div>
          <span className="kicker">SETTINGS</span>
          <h1 className="mt-2 text-[34px] font-bold tracking-tightest text-ink">
            Brand & account
          </h1>
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_360px]">
          {/* LEFT */}
          <div className="flex flex-col gap-8">
            <BrandProfileSection />

            {/* Notifications */}
            <section className="card p-6">
              <span className="kicker">NOTIFICATIONS</span>
              <h2 className="mt-1 text-[18px] font-semibold text-ink">
                What we email you about
              </h2>
              <div className="mt-5 flex flex-col divide-y divide-line">
                <Toggle
                  label="Daily prompt digest"
                  description="One email each morning with today's high-opportunity prompt."
                  checked={notifications.daily}
                  onChange={(v) => setNotifications((n) => ({ ...n, daily: v }))}
                />
                <Toggle
                  label="Citation alerts"
                  description="The moment ChatGPT, Perplexity or Gemini cite you."
                  checked={notifications.citation}
                  onChange={(v) => setNotifications((n) => ({ ...n, citation: v }))}
                />
                <Toggle
                  label="Competitor moves"
                  description="When a tracked brand claims a new prompt."
                  checked={notifications.competitor}
                  onChange={(v) => setNotifications((n) => ({ ...n, competitor: v }))}
                />
                <Toggle
                  label="Weekly recap"
                  description="Friday afternoon — what changed in your category."
                  checked={notifications.weekly}
                  onChange={(v) => setNotifications((n) => ({ ...n, weekly: v }))}
                />
                <Toggle
                  label="Slack alerts"
                  description={
                    <span className="inline-flex items-center gap-1.5">
                      <Slack size={12} />
                      Pipe alerts into your team workspace.
                    </span>
                  }
                  checked={notifications.slack}
                  onChange={(v) => setNotifications((n) => ({ ...n, slack: v }))}
                />
              </div>
            </section>

            {/* Team */}
            <section className="card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <span className="kicker">TEAM</span>
                  <h2 className="mt-1 text-[18px] font-semibold text-ink">Members</h2>
                </div>
                <Button variant="chrome" size="sm">
                  <UserPlus size={14} /> Invite
                </Button>
              </div>
              <ul className="mt-5 divide-y divide-line">
                {TEAM.map((m) => (
                  <li
                    key={m.email}
                    className="flex items-center justify-between gap-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-offwhite text-sm font-semibold text-ink">
                        {m.name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-ink">{m.name}</div>
                        <div className="text-xs text-mid">{m.email}</div>
                      </div>
                    </div>
                    <span className="rounded-full border border-line bg-offwhite px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-mid">
                      {m.role}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          {/* RIGHT */}
          <aside className="flex flex-col gap-6">
            <div className="card p-6">
              <span className="kicker">PLAN</span>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-[28px] font-extrabold tracking-tightest text-ink">
                  Starter
                </span>
                <span className="text-mid">$99/mo</span>
              </div>
              <p className="mt-1 text-xs text-mid">Renews May 28, 2026.</p>

              <div className="mt-5">
                <div className="flex items-center justify-between">
                  <span className="kicker">PROMPT SLOTS</span>
                  <span className="font-mono text-[11px] text-mid">47 / 50</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
                  <div className="h-full rounded-full bg-ink" style={{ width: '94%' }} />
                </div>
              </div>

              <div className="mt-5">
                <div className="flex items-center justify-between">
                  <span className="kicker">CONTENT DRAFTS</span>
                  <span className="font-mono text-[11px] text-mid">3 / 5</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
                  <div className="h-full rounded-full bg-ink" style={{ width: '60%' }} />
                </div>
              </div>

              <Button variant="primary" size="md" className="mt-6 w-full">
                Upgrade to Growth
              </Button>
              <button className="mt-2 w-full text-xs text-mid hover:text-ink">
                Manage billing
              </button>
            </div>

            <div className="card p-6">
              <span className="kicker">QUICK ACTIONS</span>
              <div className="mt-3 flex flex-col gap-2">
                <button className="inline-flex items-center justify-between rounded-lg border border-line bg-white px-3 py-2 text-sm text-rich hover:border-ink hover:text-ink">
                  <span className="inline-flex items-center gap-2">
                    <Plus size={14} /> Add a prompt
                  </span>
                  <span className="font-mono text-[11px] text-mid">3 left</span>
                </button>
                <button className="inline-flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-sm text-rich hover:border-ink hover:text-ink">
                  <Mail size={14} /> Email this report
                </button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </DashboardLayout>
  )
}

type RescanState = 'idle' | 'confirming' | 'running'

function BrandProfileSection() {
  const state = useBrand()
  const [brand, setBrand] = useState<Brand | null>(null)
  const [editing, setEditing] = useState<ProfileFieldKey | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rescan, setRescan] = useState<RescanState>('idle')

  // Initialize and refresh local brand from the loaded state. We don't want
  // active-cycle polling to clobber an unsaved edit — keep our own copy and
  // only resync when not editing.
  useEffect(() => {
    if (state.kind !== 'ready') return
    if (editing) return
    setBrand(state.data.summary.brand)
  }, [state, editing])

  if (state.kind === 'idle') {
    return (
      <ProfileShell rescan={null}>
        <p className="text-sm text-mid">
          Onboard a brand from the home page to edit its profile.
        </p>
      </ProfileShell>
    )
  }
  if (state.kind === 'loading' || !brand) {
    return (
      <ProfileShell rescan={null}>
        <div className="flex items-center gap-2 text-sm text-mid">
          <Loader2 size={14} className="animate-spin" />
          Loading brand profile...
        </div>
      </ProfileShell>
    )
  }
  if (state.kind === 'error') {
    return (
      <ProfileShell rescan={null}>
        <p className="text-sm text-score-critical">{state.message}</p>
      </ProfileShell>
    )
  }

  function startEdit(key: ProfileFieldKey) {
    if (!brand) return
    setEditing(key)
    setEditValue(brand[key])
    setError(null)
  }

  async function runRescan() {
    if (!brand) return
    setRescan('running')
    setError(null)
    try {
      const { draft } = await api.analyze(brand.url)
      const { brand: updated } = await api.updateBrand(brand.id, draft)
      setBrand(updated)
      setRescan('idle')
    } catch (err) {
      setError(
        err instanceof ApiCallError
          ? err.message
          : "Couldn't re-scan that site. The URL may be unreachable.",
      )
      setRescan('idle')
    }
  }

  function cancelEdit() {
    setEditing(null)
    setEditValue('')
    setError(null)
  }

  async function commitEdit() {
    if (!brand || !editing) return
    const trimmed = editValue.trim().slice(0, FIELD_MAX_CHARS)
    if (!trimmed || trimmed === brand[editing]) {
      cancelEdit()
      return
    }
    const patch: BrandPatch = { [editing]: trimmed }
    setSaving(true)
    setError(null)
    try {
      const { brand: updated } = await api.updateBrand(brand.id, patch)
      setBrand(updated)
      setEditing(null)
      setEditValue('')
    } catch (err) {
      setError(
        err instanceof ApiCallError
          ? err.message
          : "Couldn't save that change. Try again?",
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <ProfileShell
      rescan={{
        state: rescan,
        onClick: () => {
          setError(null)
          if (rescan === 'idle') setRescan('confirming')
          else if (rescan === 'confirming') runRescan()
        },
        onCancel: () => setRescan('idle'),
      }}
    >
      {error && (
        <div className="mb-4 rounded-lg border border-score-critical/30 bg-score-critical/5 px-4 py-2 text-sm text-score-critical">
          {error}
        </div>
      )}
      {rescan === 'confirming' && (
        <div className="mb-4 rounded-lg border border-line bg-offwhite px-4 py-3 text-xs text-mid">
          Re-scan will fetch{' '}
          <span className="font-mono text-rich">{brand.url}</span> and overwrite
          every field below with what Claude extracts. Costs 1 Claude call
          (~5s). The 50-prompt list and citations stay as they are.
        </div>
      )}
      {rescan === 'running' && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-line bg-offwhite px-4 py-3 text-sm text-mid">
          <Loader2 size={14} className="animate-spin" />
          Re-scanning {brand.url}...
        </div>
      )}
      <ul className="divide-y divide-line">
        {PROFILE_FIELDS.map((f) => {
          const isEditing = editing === f.key
          const value = brand[f.key]
          return (
            <li key={f.key} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <div className="kicker !text-[10px]">{f.label.toUpperCase()}</div>
                {isEditing ? (
                  <input
                    autoFocus
                    type="text"
                    value={editValue}
                    maxLength={FIELD_MAX_CHARS}
                    disabled={saving}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        commitEdit()
                      } else if (e.key === 'Escape') {
                        e.preventDefault()
                        cancelEdit()
                      }
                    }}
                    className="mt-0.5 w-full min-w-0 rounded border border-line bg-white px-2 py-1 text-sm text-rich outline-none focus:border-ink disabled:opacity-60"
                  />
                ) : (
                  <div
                    className="mt-0.5 min-w-0 truncate text-sm text-rich"
                    title={value}
                  >
                    {value}
                  </div>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {isEditing ? (
                  <>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      disabled={saving}
                      aria-label="Cancel edit"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-line bg-white text-mid hover:border-score-critical hover:text-score-critical disabled:opacity-50"
                    >
                      <X size={14} strokeWidth={3} />
                    </button>
                    <button
                      type="button"
                      onClick={commitEdit}
                      disabled={saving || !editValue.trim()}
                      aria-label="Save"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-score-good bg-score-good/10 text-score-good hover:bg-score-good/20 disabled:opacity-50"
                    >
                      {saving ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Check size={14} strokeWidth={3} />
                      )}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => startEdit(f.key)}
                    aria-label={`Edit ${f.label.toLowerCase()}`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-line bg-white text-mid hover:border-ink hover:text-ink"
                  >
                    <Pencil size={13} strokeWidth={2.5} />
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </ProfileShell>
  )
}

interface RescanProps {
  state: RescanState
  onClick: () => void
  onCancel: () => void
}

function ProfileShell({
  rescan,
  children,
}: {
  rescan: RescanProps | null
  children: React.ReactNode
}) {
  return (
    <section className="card p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <span className="kicker">BRAND PROFILE</span>
          <h2 className="mt-1 text-[18px] font-semibold text-ink">
            Calibration data
          </h2>
        </div>
        {rescan && (
          <div className="flex shrink-0 items-center gap-2">
            {rescan.state === 'confirming' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={rescan.onCancel}
              >
                Cancel
              </Button>
            )}
            <Button
              variant={rescan.state === 'confirming' ? 'primary' : 'ghost'}
              size="sm"
              onClick={rescan.onClick}
              disabled={rescan.state === 'running'}
            >
              {rescan.state === 'running' ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Re-scanning...
                </>
              ) : rescan.state === 'confirming' ? (
                <>
                  <RefreshCw size={14} /> Confirm re-scan
                </>
              ) : (
                <>
                  <RefreshCw size={14} /> Re-scan site
                </>
              )}
            </Button>
          </div>
        )}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  )
}

interface ToggleProps {
  label: string
  description: React.ReactNode
  checked: boolean
  onChange: (value: boolean) => void
}

function Toggle({ label, description, checked, onChange }: ToggleProps) {
  return (
    <div className="flex items-start justify-between gap-6 py-4">
      <div>
        <div className="text-sm font-medium text-ink">{label}</div>
        <div className="mt-0.5 text-xs text-mid">{description}</div>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
          checked ? 'bg-ink' : 'bg-line',
        )}
      >
        <span
          className={cn(
            'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-5' : 'translate-x-0.5',
          )}
        />
      </button>
    </div>
  )
}
