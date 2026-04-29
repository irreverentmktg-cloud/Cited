# Cited — Database Schema Guide
**Version 1.0 | April 2026**

---

## Architecture Overview

```
Lovable (React frontend)
        │
        ▼  REST API calls
Railway (Node/Express backend)
        │
        ├──▶ Supabase Postgres  ← this schema
        │       (service role key, bypasses RLS)
        │
        ├──▶ OpenAI API  (ChatGPT checks)
        ├──▶ Perplexity API  (Perplexity checks)
        ├──▶ Google Gemini API  (Gemini checks)
        └──▶ Anthropic API  (Claude checks)
```

Supabase handles **auth** (email + Google OAuth) and **the database**.  
Railway handles **all logic** — scraping, LLM queries, scoring, nightly jobs, API routes.  
Lovable handles **all UI** — calls Railway's REST API, never touches Supabase directly (except auth tokens).

---

## Table Reference

### `profiles`
One row per signed-up user. Auto-created by a Postgres trigger when Supabase Auth creates a user.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | Matches `auth.users.id` |
| `plan_tier` | enum | `free / starter / pro / agency` |
| `prompt_slots` | int | Max active prompts: free=5, starter=50, pro=200, agency=unlimited (9999) |
| `stripe_*` | text | Populated when user subscribes |

**Railway sets `prompt_slots` after Stripe webhook confirms subscription.**

---

### `brands`
The core entity. A user can have 1 brand (free/starter/pro) or up to 10 (agency).

| Column | Type | Notes |
|--------|------|-------|
| `domain` | text | Normalized: no https/www, e.g. `bloom-collagen.com` |
| `scraped_content` | jsonb | Raw site data from the URL scraper: `{ title, meta_desc, headings[], body_excerpt }` |
| `calibration_confirmed` | bool | Flips to true after user completes onboarding Step 1 |
| `category / product_type / etc.` | text | Filled by scraper; user can override in calibration |

---

### `prompts`
Each prompt is a search query tracked for a brand. These get fired at every AI model daily.

| Column | Type | Notes |
|--------|------|-------|
| `prompt_text` | text | e.g. `"best collagen supplement for joint pain"` |
| `category` | text | `"Comparison" / "Use Case" / "Branded" / "Category"` |
| `is_branded` | bool | True if prompt includes the brand name explicitly |
| `opportunity_score` | float | 0–100. Higher = more valuable to win. Updated nightly. |
| `source` | text | `ai_generated` (by Railway on onboarding) or `user_added` |
| `slot_consumed` | bool | Whether this counts against the user's prompt_slots quota |

**Prompt slots limit:** Railway checks `brand_has_prompt_slots()` before inserting new active prompts.

---

### `prompt_checks` ⭐ Core Fact Table
One row per **(prompt × model × day)**. This is the most important table. Everything else is derived from it.

| Column | Type | Notes |
|--------|------|-------|
| `is_cited` | bool | Was the brand mentioned in the AI response? |
| `citation_snippet` | text | The part of the response where brand appeared |
| `raw_response` | text | Full AI response (truncated to 2000 chars) |
| `competitors_cited` | jsonb | `[{ name, domain, snippet }]` — all other brands mentioned |
| `citation_strength` | text | `"primary"` (featured answer), `"mentioned"` (passing mention), `"absent"` |
| `check_error` | text | NULL if success; error message if the API call failed |
| `job_id` | text | References `job_runs.id` — which nightly run created this |

**Unique constraint:** one check per prompt+model per day. Railway skips if already exists.

---

### `brand_scores`
Daily score snapshot. Calculated by Railway at the end of each nightly run.

**Score formula (Railway calculates this):**
```
model_score     = (prompts_cited_on_model / total_prompts) × 100
overall_score   = weighted average:
                    chatgpt     × 0.40
                    perplexity  × 0.30
                    gemini      × 0.20
                    claude      × 0.10
```

Weights reflect real-world market share. Adjust as models evolve.

---

### `competitors`
Auto-populated when Railway parses `prompt_checks.competitors_cited` and finds recurring names. Users can also add competitors manually.

`prompts_owned` = prompts where this competitor is cited but the user's brand is not (today).  
`top_prompt` = the single highest-opportunity prompt the competitor currently owns.

---

### `competitor_checks`
Mirrors `prompt_checks` but for competitor brands. Populated when Railway sees a competitor in `competitors_cited` and separately tracks their citation status per prompt per model.

---

### `daily_priority_prompts`
The **"Today's Prompt"** feature. One row per brand per day. Railway selects this each morning using:
1. Prompts with high `opportunity_score`
2. Prompts where a competitor is cited but the brand isn't (from `v_competitor_gaps`)
3. Prompts showing recent downward momentum (cited yesterday, not today)

---

### `content_recommendations`
Actionable recommendations per prompt. Railway generates these using GPT-4 after identifying gaps, using the brand's calibrated metadata as context.

`impact_score` = estimated citation gain (0–100) if the recommendation is implemented. Used to sort the recommendations feed.

---

### `alerts`
Event feed shown in the dashboard. Railway creates alerts when:
- Brand gains a new citation it didn't have yesterday → `citation_gained`
- Brand loses a citation it had yesterday → `citation_lost`
- Competitor gains prompts → `competitor_gained`
- Score drops by 5+ points → `score_drop`
- New gap detected → `new_gap`

---

### `job_runs`
Audit log for every Railway nightly job. Useful for debugging failed checks and retry logic.

Job ID format: `run_YYYYMMDD_HHMM` e.g. `run_20260428_0200`

---

### `url_analyses`
Stores landing page URL scans (pre-signup). When a visitor enters their URL in the hero, Railway:
1. Scrapes the URL
2. Runs 5 sample prompts (not full 50)
3. Generates a preview score
4. Stores the result here
5. Returns the analysis ID to Lovable (stored in session)

When the user signs up, Railway links `url_analyses.user_id` to their new profile, then promotes the analysis to a full `brands` row and runs the complete 50-prompt check.

**Expires after 7 days** if no signup. Railway runs a cleanup job weekly.

---

## Views

| View | Used By | Purpose |
|------|---------|---------|
| `v_brand_latest_score` | Dashboard Overview | Latest score without date query |
| `v_prompt_citation_summary` | Prompts Feed | Citation stats + last checked per prompt |
| `v_competitor_gaps` | Competitor screen + daily priority | Prompts competitor owns that brand doesn't |

---

## Row-Level Security

All tables have RLS enabled. Users can only read/write their own data.

**Railway uses the Supabase service role key** — this bypasses RLS so the nightly job can write `prompt_checks` for all brands regardless of which user owns them.

**Never expose the service role key to Lovable frontend.** Lovable uses the anon key + user JWT.

---

## Railway API Route → Table Mapping

| Route | Method | Tables touched |
|-------|--------|---------------|
| `POST /api/analyze` | Public | `url_analyses` |
| `POST /api/auth/convert` | Auth | `url_analyses` → `brands`, `prompts` |
| `GET /api/brands/:id/score` | Auth | `v_brand_latest_score`, `brand_scores` |
| `GET /api/brands/:id/prompts` | Auth | `v_prompt_citation_summary` |
| `GET /api/brands/:id/daily-prompt` | Auth | `daily_priority_prompts`, `prompts` |
| `GET /api/brands/:id/competitors` | Auth | `competitors`, `v_competitor_gaps` |
| `GET /api/brands/:id/alerts` | Auth | `alerts` |
| `PATCH /api/alerts/:id/read` | Auth | `alerts` |
| `POST /api/brands/:id/prompts` | Auth | `prompts` (user-added) |
| `PATCH /api/brands/:id/calibration` | Auth | `brands` |
| Nightly cron (internal) | Internal | `prompt_checks`, `competitor_checks`, `brand_scores`, `daily_priority_prompts`, `content_recommendations`, `alerts`, `job_runs` |

---

## Prompt Slots by Plan

| Plan | `prompt_slots` | Brands | Notes |
|------|---------------|--------|-------|
| free | 5 | 1 | ChatGPT only |
| starter | 50 | 1 | 4 models |
| pro | 200 | 3 | 4 models + content recs |
| agency | 9999 | 10 | Unlimited effective |

Railway enforces slots via `brand_has_prompt_slots()` function before inserting new prompts.

---

## Nightly Job Flow (Railway)

```
02:00 UTC — job starts, creates job_runs row
  │
  ├── For each active brand:
  │     ├── Fetch active prompts
  │     ├── For each prompt × model:
  │     │     ├── Fire prompt at AI API
  │     │     ├── Parse response → is_cited, competitors_cited, snippet
  │     │     └── INSERT into prompt_checks
  │     │
  │     ├── Calculate brand_scores for today
  │     ├── Update competitors table from new competitors_cited data
  │     ├── Insert competitor_checks
  │     ├── Select daily_priority_prompt (best gap opportunity)
  │     ├── Generate content_recommendations for top 3 gaps
  │     └── Create alerts for notable changes
  │
  └── Update job_runs → status: 'completed'
```

Total runtime estimate: ~2–4 minutes for 100 brands × 50 prompts × 4 models  
(200,000 API calls/night at scale — use batching + rate limiting)

---

*Schema v1.0 — built for Cited AEO Platform, April 2026*
