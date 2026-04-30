// BYO API key resolver — scaffolding.
//
// NOT YET WIRED. Today every Claude call (calibrate, promptlist, web-search
// scoring, extract, recommend) reads the single ANTHROPIC_API_KEY from env.
// To flip to BYO, every Anthropic SDK construction needs to pull the right
// key per (brand, provider) instead.
//
// This module is the seam where that lookup will live. The implementation
// reads from `brand_api_keys` (see migrations/001_byo_api_keys.sql) and
// resolves the vault secret. Until the migration is applied, these calls
// fall back to env vars so the server still works in single-tenant mode.

import { db, dbAvailable } from '../db/client.js'
import { env } from '../env.js'

export type Provider = 'anthropic' | 'openai' | 'perplexity' | 'google'

const ENV_FALLBACK: Record<Provider, string | undefined> = {
  anthropic: env.ANTHROPIC_API_KEY,
  openai: env.OPENAI_API_KEY,
  perplexity: env.PERPLEXITY_API_KEY,
  google: env.GOOGLE_API_KEY,
}

interface KeyRow {
  vault_secret_id: string
}

interface VaultRow {
  decrypted_secret: string
}

// Resolve the API key to use for (brand, provider). Returns:
//   - The customer's stored key from Supabase Vault if present
//   - The server's env-var fallback otherwise
//   - null if neither exists (caller must handle the missing-key case)
//
// Cache eligible: same brand+provider returns the same key for the lifetime
// of the process. Invalidate when a customer rotates a key (the Settings
// UI's "Update key" handler should call invalidateKey()).
const cache = new Map<string, string | null>()

export async function resolveApiKey(
  brandId: string | null,
  provider: Provider,
): Promise<string | null> {
  // Single-tenant mode (no brand context): just use env.
  if (!brandId) return ENV_FALLBACK[provider] ?? null

  const cacheKey = `${brandId}:${provider}`
  if (cache.has(cacheKey)) return cache.get(cacheKey) ?? null

  let key: string | null = null

  if (dbAvailable()) {
    try {
      const { data: keyRow, error: keyErr } = await db()
        .from('brand_api_keys')
        .select('vault_secret_id')
        .eq('brand_id', brandId)
        .eq('provider', provider)
        .maybeSingle<KeyRow>()
      if (keyErr) throw keyErr
      if (keyRow) {
        // Vault is in the `vault` schema. supabase-js can't reach it via the
        // standard table API — use rpc or raw SQL via a small helper. Until
        // Vault is wired, this branch is unreachable.
        const { data: secretRow, error: secretErr } = await db()
          .schema('vault')
          .from('decrypted_secrets')
          .select('decrypted_secret')
          .eq('id', keyRow.vault_secret_id)
          .maybeSingle<VaultRow>()
        if (secretErr) throw secretErr
        key = secretRow?.decrypted_secret ?? null
      }
    } catch (err) {
      // Treat lookup failures as "no stored key, fall back to env" so the
      // single-tenant path keeps working until Vault and the table are set
      // up. Log loudly though.
      console.warn(
        `[resolveApiKey] lookup failed for ${cacheKey}: ${
          err instanceof Error ? err.message : String(err)
        }; falling back to env`,
      )
    }
  }

  if (!key) key = ENV_FALLBACK[provider] ?? null
  cache.set(cacheKey, key)
  return key
}

export function invalidateKey(brandId: string, provider: Provider): void {
  cache.delete(`${brandId}:${provider}`)
}

export function clearKeyCache(): void {
  cache.clear()
}
