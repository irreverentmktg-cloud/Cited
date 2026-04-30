import type {
  AnalyzeResponse,
  ApiError,
  Brand,
  BrandDetail,
  BrandPatch,
  CalibrationDraft,
  CreateBrandResponse,
  PromptWithStatus,
  RefreshResponse,
  UpdateBrandResponse,
} from '@cited/shared'

const BASE = '/api'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    let body: ApiError | null = null
    try {
      body = (await res.json()) as ApiError
    } catch {
      // fall through
    }
    throw new ApiCallError(
      body?.message ?? `Request failed: ${res.status}`,
      body?.error ?? 'unknown',
      res.status,
    )
  }
  return res.json() as Promise<T>
}

export class ApiCallError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
  ) {
    super(message)
  }
}

export const api = {
  health: () => request<{ ok: boolean; repo: string; providers: unknown }>('/health'),

  analyze: (url: string) =>
    request<AnalyzeResponse>('/analyze', {
      method: 'POST',
      body: JSON.stringify({ url }),
    }),

  createBrand: (
    draft: CalibrationDraft,
    confirmedFields: Array<keyof CalibrationDraft>,
  ) =>
    request<CreateBrandResponse>('/brands', {
      method: 'POST',
      body: JSON.stringify({ draft, confirmedFields }),
    }),

  getBrand: (id: string) => request<BrandDetail>(`/brands/${id}`),

  getLatestBrand: () => request<{ brand: Brand }>(`/brands/latest`),

  updateBrand: (id: string, patch: BrandPatch) =>
    request<UpdateBrandResponse>(`/brands/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ patch }),
    }),

  getPrompts: (brandId: string) =>
    request<{ prompts: PromptWithStatus[] }>(`/brands/${brandId}/prompts`),

  refresh: (brandId: string) =>
    request<RefreshResponse>(`/brands/${brandId}/refresh`, { method: 'POST' }),
}
