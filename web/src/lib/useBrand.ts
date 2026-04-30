import { useEffect, useRef, useState } from 'react'
import type { BrandSummary, PromptWithStatus } from '@cited/shared'
import { api, ApiCallError } from './api'
import { loadBrandId, saveBrandId } from './onboarding'

export interface BrandData {
  summary: BrandSummary
  prompts: PromptWithStatus[]
  cycleActive: boolean
}

export type BrandState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; data: BrandData }
  | { kind: 'error'; message: string }

const POLL_INTERVAL_MS = 3000

// Loads the current onboarded brand and polls every 3s while a score cycle is
// active so citations stream into the UI as they land. Stops polling once the
// server reports the cycle finished.
//
// If sessionStorage has no brand id, falls back to the most recent brand on
// the server (one-brand-per-account). The id is persisted so subsequent loads
// skip the latest lookup.
export function useBrand(): BrandState {
  const [state, setState] = useState<BrandState>({ kind: 'loading' })
  const cancelledRef = useRef(false)

  useEffect(() => {
    cancelledRef.current = false
    let timer: number | undefined

    async function resolveBrandId(): Promise<string | null> {
      const stored = loadBrandId()
      if (stored) return stored
      try {
        const { brand } = await api.getLatestBrand()
        saveBrandId(brand.id)
        return brand.id
      } catch (err) {
        if (err instanceof ApiCallError && err.status === 404) return null
        throw err
      }
    }

    async function loadDetail(id: string) {
      const detail = await api.getBrand(id)
      if (cancelledRef.current) return
      setState({
        kind: 'ready',
        data: {
          summary: detail.summary,
          prompts: detail.prompts,
          cycleActive: detail.cycleActive,
        },
      })
      // Only poll while the server reports the cycle as actively running.
      // Pending runs left over from a killed cycle would otherwise loop forever.
      if (detail.cycleActive) {
        timer = window.setTimeout(() => loadDetail(id), POLL_INTERVAL_MS)
      }
    }

    ;(async () => {
      try {
        const id = await resolveBrandId()
        if (cancelledRef.current) return
        if (!id) {
          setState({ kind: 'idle' })
          return
        }
        await loadDetail(id)
      } catch (err) {
        if (cancelledRef.current) return
        setState({
          kind: 'error',
          message: err instanceof Error ? err.message : 'Failed to load brand',
        })
      }
    })()

    return () => {
      cancelledRef.current = true
      if (timer) window.clearTimeout(timer)
    }
  }, [])

  return state
}
