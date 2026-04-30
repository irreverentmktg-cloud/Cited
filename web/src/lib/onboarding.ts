import type { CalibrationDraft } from '@cited/shared'

// Onboarding state lives in sessionStorage so a refresh on the calibration or
// score-reveal screen doesn't kick the user back to the URL input. Cleared
// once they land on the dashboard.

const DRAFT_KEY = 'cited:onboarding:draft'
const BRAND_KEY = 'cited:onboarding:brandId'

export function saveDraft(draft: CalibrationDraft) {
  sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
}

export function loadDraft(): CalibrationDraft | null {
  const raw = sessionStorage.getItem(DRAFT_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as CalibrationDraft
  } catch {
    return null
  }
}

export function saveBrandId(id: string) {
  sessionStorage.setItem(BRAND_KEY, id)
}

export function loadBrandId(): string | null {
  return sessionStorage.getItem(BRAND_KEY)
}

export function clearOnboarding() {
  sessionStorage.removeItem(DRAFT_KEY)
  sessionStorage.removeItem(BRAND_KEY)
}
