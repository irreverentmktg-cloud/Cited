# Cited DB schema guide

Live in Supabase project `woumlhblurmdzvbjpciu`. Apply via Supabase SQL editor or `supabase db push` from `schema.sql`.

The server runs in **memory mode** (no DB writes) when `SUPABASE_URL` /
`SUPABASE_SERVICE_ROLE_KEY` aren't set, and switches to Postgres
automatically once they are. RLS is enabled on every table because the
server uses the service role key — add policies before exposing direct
Postgres access from the browser.

## Tables

### `brands`
One row per onboarded brand. Created by `POST /api/brands` after URL scrape +
Claude calibration.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `url` | `text` | Source URL, as entered by the user |
| `name` | `text` | Brand display name |
| `category` | `text` | E.g. "Creative Services · Photography" |
| `product_type` | `text` | What they sell |
| `primary_claim` | `text` | Their hero positioning |
| `target_buyer` | `text` | Persona |
| `price_position` | `text` | Premium / mid / budget |
| `differentiator` | `text` | What separates them |
| `created_at` | `timestamptz` | |

### `prompts`
The 50 generated prompts per brand. Distributed across the awareness ladder:
10 unaware, 12 problem-aware, 14 solution-aware, 10 product-aware, 4
most-aware. Hard-capped to 50 in `lib/promptlist.ts`.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `brand_id` | `uuid` | FK → `brands(id)` ON DELETE CASCADE |
| `text` | `text` | The prompt itself |
| `awareness_stage` | `text` | enum: unaware / problem-aware / solution-aware / product-aware / most-aware |
| `created_at` | `timestamptz` | |

### `prompt_runs`
One row per (prompt × platform × day). The cycle runner upserts on the
unique-day index so re-runs within the same day overwrite cleanly. Idempotent
nightly job.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `prompt_id` | `uuid` | FK → `prompts(id)` ON DELETE CASCADE |
| `platform` | `text` | enum: claude / chatgpt / perplexity / gemini |
| `model` | `text` | Specific model that produced the run, e.g. `claude-opus-4-7`. Lets us A/B test models without losing history. |
| `status` | `text` | enum: cited / not-cited / pending / error |
| `rank` | `integer` | If cited, position in the answer (1 = first brand mentioned). Set by the Sonnet extraction step, not by regex. |
| `competitors` | `text[]` | Other named brands the AI mentioned — extracted by `lib/extract.ts`. |
| `recommended_content` | `text` | Sonnet-generated content suggestion — what the brand should publish to win this prompt. |
| `raw_answer` | `text` | The provider's full answer text. |
| `ran_at` | `timestamptz` | |
| `run_day` | `date` | Used by the unique index for idempotent upserts. |

Unique on `(prompt_id, platform, run_day)`.

### `scores_daily`
Daily snapshot of a brand's AI Visibility Score, one row per day per brand.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `brand_id` | `uuid` | FK → `brands(id)` ON DELETE CASCADE |
| `score` | `integer` | 0–100, computed by `lib/score.ts:calculateScore` |
| `band` | `text` | enum: critical / warning / good (cutoffs at 40 / 70) |
| `prompts_checked` | `integer` | Total prompts in the cycle |
| `prompts_cited` | `integer` | Of those, how many had at least one cited platform |
| `competitor_avg` | `integer` | Reserved for the competitor benchmark — currently 0 |
| `captured_at` | `timestamptz` | |
| `capture_day` | `date` | Used by the unique index |

Unique on `(brand_id, capture_day)`.

## Per-cycle pipeline

For each prompt × available platform:

1. **`provider.ask(prompt)`** — expensive call. Currently only Claude Opus
   4.7 with the web_search tool (`max_uses: 2`, cached system prompt). Other
   providers stubbed.
2. **`extractCitation(brand, answer)`** — Sonnet 4.6 structured extraction.
   Returns `{ cited, rank, competitorBrands }`. Provider-agnostic — the same
   logic works for any provider's answer.
3. **`recommendContent({ brand, prompt, answer, ... })`** — Sonnet 4.6
   tailored content suggestion. Stored in `recommended_content`.
4. **`recordRun(...)`** — upserts the row in `prompt_runs`.

After all prompts complete, a single `scores_daily` row is upserted via
`recordScore`.

## Cost notes

Per 50-prompt cycle, one provider, with caching + `max_uses: 2`:
- Opus web-search scoring: ~$5–9
- Sonnet extraction: ~$0.25
- Sonnet recommendations: ~$0.55
- **Total: ~$6–10 per cycle per provider**

When ChatGPT / Perplexity / Gemini come online, multiply by ~4.
