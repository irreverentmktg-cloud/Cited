-- Cited DB schema
-- Run this in Supabase SQL editor (or via `supabase db push`).
-- Service role only — RLS is enabled but we don't define policies yet because
-- the server uses the service role key. Add policies before exposing direct
-- Postgres access from the browser.

create extension if not exists "uuid-ossp";

-- Brands ---------------------------------------------------------------------
create table if not exists brands (
  id uuid primary key default uuid_generate_v4(),
  url text not null,
  name text not null,
  category text not null,
  product_type text not null,
  primary_claim text not null,
  target_buyer text not null,
  price_position text not null,
  differentiator text not null,
  created_at timestamptz not null default now()
);

-- Prompts --------------------------------------------------------------------
create table if not exists prompts (
  id uuid primary key default uuid_generate_v4(),
  brand_id uuid not null references brands(id) on delete cascade,
  text text not null,
  awareness_stage text not null check (awareness_stage in (
    'unaware',
    'problem-aware',
    'solution-aware',
    'product-aware',
    'most-aware'
  )),
  created_at timestamptz not null default now()
);
create index if not exists prompts_brand_idx on prompts(brand_id);

-- Prompt runs ---------------------------------------------------------------
-- One row per (prompt, platform, day). Idempotent on the unique key — the
-- nightly job upserts so reruns don't duplicate.
create table if not exists prompt_runs (
  id uuid primary key default uuid_generate_v4(),
  prompt_id uuid not null references prompts(id) on delete cascade,
  platform text not null check (platform in ('claude','chatgpt','perplexity','gemini')),
  status text not null check (status in ('cited','not-cited','pending','error')),
  rank integer,
  competitors text[] not null default '{}',
  recommended_content text,
  raw_answer text,
  ran_at timestamptz not null default now(),
  run_day date not null default current_date
);
create unique index if not exists prompt_runs_unique_day
  on prompt_runs(prompt_id, platform, run_day);
create index if not exists prompt_runs_prompt_idx on prompt_runs(prompt_id);

-- Daily score snapshots -----------------------------------------------------
create table if not exists scores_daily (
  id uuid primary key default uuid_generate_v4(),
  brand_id uuid not null references brands(id) on delete cascade,
  score integer not null,
  band text not null check (band in ('critical','warning','good')),
  prompts_checked integer not null,
  prompts_cited integer not null,
  competitor_avg integer not null,
  captured_at timestamptz not null default now(),
  capture_day date not null default current_date
);
create unique index if not exists scores_daily_unique_day
  on scores_daily(brand_id, capture_day);
create index if not exists scores_daily_brand_idx on scores_daily(brand_id);

alter table brands enable row level security;
alter table prompts enable row level security;
alter table prompt_runs enable row level security;
alter table scores_daily enable row level security;
