-- BYO API keys — schema scaffold.
--
-- NOT YET APPLIED to live Supabase. Apply manually via SQL editor or
-- `supabase db push` when you're ready to flip the server from one shared
-- ANTHROPIC_API_KEY to per-brand customer keys.
--
-- Encryption strategy: Supabase Vault. Stored keys live in `vault.secrets`;
-- this table holds only the vault secret_id pointer. Reads happen via
-- `vault.decrypted_secrets` from the server-side service role.
--
-- Alternative if Vault isn't enabled: store encrypted bytes in `encrypted_key`
-- via pgcrypto + an app-held master key from env. Easier to set up, harder
-- to rotate. Pick one before applying.

create extension if not exists "vault" with schema vault;

create table if not exists brand_api_keys (
  id uuid primary key default uuid_generate_v4(),
  brand_id uuid not null references brands(id) on delete cascade,
  provider text not null check (provider in (
    'anthropic',
    'openai',
    'perplexity',
    'google'
  )),

  -- Pointer into vault.secrets. Server reads via:
  --   select decrypted_secret from vault.decrypted_secrets where id = $1
  vault_secret_id uuid not null,

  -- Cached validation state shown in the Settings UI. NOT authoritative —
  -- the server should always be ready to handle a 401/402 from the provider
  -- and re-validate on demand. This is just a hint so the UI doesn't have
  -- to ping the provider on every page load.
  last_validated_at timestamptz,
  validation_status text check (validation_status in (
    'valid',
    'invalid',
    'rate_limited',
    'no_credits',
    'unknown'
  )) default 'unknown',
  validation_error text,

  -- Audit
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One key per (brand, provider). To rotate, update vault_secret_id and bump
-- updated_at — don't insert a duplicate.
create unique index if not exists brand_api_keys_brand_provider
  on brand_api_keys(brand_id, provider);

alter table brand_api_keys enable row level security;

-- RLS policy left intentionally empty: the server uses the service role key
-- and bypasses RLS. Add per-account policies once auth lands so customers
-- can only see/manage their own keys via direct Postgres access from the
-- browser. Until then, do not expose direct Postgres access to the browser.

-- Helpful timestamp trigger
create or replace function bump_brand_api_keys_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_bump_brand_api_keys on brand_api_keys;
create trigger trg_bump_brand_api_keys
  before update on brand_api_keys
  for each row execute function bump_brand_api_keys_updated_at();
