import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { env } from '../env.js'

let _client: SupabaseClient | null = null

export function db(): SupabaseClient {
  if (_client) return _client
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      'Supabase not configured — set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in server/.env',
    )
  }
  _client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })
  return _client
}

export function dbAvailable(): boolean {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY)
}
