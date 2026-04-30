# Cited

Answer Engine Optimization for DTC brands. Tells you which AI models are
citing you, which prompts you're invisible in, and what specific content to
publish to claim each one.

## Layout

This repo is an npm workspaces monorepo plus design assets:

```
.
├── server/                   # Hono + TypeScript API (Node 18+)
├── web/                      # React + Vite + Tailwind frontend
├── shared/                   # Types shared between web and server
├── package.json              # Workspace root
│
├── schema.sql                # Supabase schema (apply via SQL editor)
├── schema_guide.md           # Tables, columns, pipeline notes
│
├── sited-lovable-brief.md    # Original UI brief
├── aeo-moodboard-v2.html     # Visual moodboard
├── cited-blueprint.html      # UI blueprint
├── cited-moodboard.html      # Earlier moodboard
└── Cited_Launch_Strategy.docx
```

## Run it locally

You need Node 18+, an Anthropic API key, and a Supabase project.

```bash
npm install                       # installs web, server, shared together
cp server/.env.example server/.env
# edit server/.env — set ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

# Apply the schema once via Supabase SQL editor (or supabase db push):
#   schema.sql

# in one terminal:
npm run dev:server                # http://localhost:8787

# in another:
npm run dev:web                   # http://localhost:5173
```

The web dev server proxies `/api/*` to the API server, so hit
`http://localhost:5173/` and the whole stack works end-to-end.

## What works today

**Onboarding**
- `POST /api/analyze` — scrapes a URL, asks Claude to extract
  product/category/claims/buyer/price/differentiator
- `POST /api/brands` — confirms calibration, generates a 50-prompt list
  with Claude, kicks off the first score cycle in the background. Enforces
  one-brand-per-account (returns 409 `brand_limit` on second).

**Read**
- `GET /api/brands` — list (currently always 0 or 1 brand)
- `GET /api/brands/latest` — most recent brand (used as fallback when the
  client has no brand id in sessionStorage)
- `GET /api/brands/:id` — full detail: brand, current score, history, all
  50 prompts with per-platform citation status, plus `cycleActive` flag for
  live-polling

**Write**
- `PATCH /api/brands/:id` — partial brand update (used by Settings page)
- `POST /api/brands/:id/refresh` — re-runs the score cycle in the background
  (idempotent: refuses if a cycle is already in flight)

**The score cycle pipeline (per prompt × available provider):**
1. `provider.ask(prompt)` — Opus 4.7 with `web_search` tool, cached system
   prompt (5-min ephemeral), `max_uses: 2`. Concurrency 8 across the 50
   prompts.
2. `extractCitation(brand, answer)` — Sonnet 4.6 structured extraction:
   `{ cited, rank, competitorBrands }`. Replaces the old regex-based
   detection.
3. `recommendContent({ brand, prompt, answer, ... })` — Sonnet 4.6 tailored
   "what to publish" recommendation. Stored in `recommended_content`.
4. `recordRun(...)` — upserts into `prompt_runs` keyed on
   `(prompt_id, platform, run_day)` for nightly idempotence.

A daily score snapshot lands in `scores_daily` after every cycle.

## What's not built yet

- **Other providers**. ChatGPT, Perplexity, Gemini are stubs that report
  `available: false` until their API keys are wired. Drop the implementation
  into `server/src/lib/providers/` and they'll activate. The
  extraction/recommendation steps are already provider-agnostic — they'll
  work the moment a provider returns a real answer.
- **Auth**. Endpoints are open. Add Supabase Auth + per-user session before
  exposing publicly.
- **BYO API keys**. Today the server reads one shared `ANTHROPIC_API_KEY`
  from env. The production model (`Input` brief) is per-customer keys —
  needs a key-storage strategy (Supabase Vault or pgcrypto) and a Settings
  UI to connect/test/rotate per provider.
- **Nightly cron**. The runner exists; wire `POST /api/brands/:id/refresh`
  to a Railway / Fly cron schedule.
- **Real billing / multi-brand**. The one-brand limit is enforced server-
  side as a 409. To upgrade and add more brands, add Stripe + an
  `account_id` foreign key on brands.

## Cost (per 50-prompt cycle, one provider, with caching + max_uses=2)

| Component | Estimate |
|---|---|
| Opus web-search scoring | $5–9 |
| Sonnet extraction (cited / rank / competitors) | ~$0.25 |
| Sonnet content recommendations | ~$0.55 |
| **Total per cycle per provider** | **~$6–10** |

Multiply by ~4 once ChatGPT / Perplexity / Gemini come online. A weekly
refresh keeps a single brand around $25–40/mo across all four providers.

## Deploy

Server target: Railway (or Fly, or Render). Set the env vars from
`server/.env.example` and deploy `server/`. Web can ship to Vercel or
Netlify; point its `/api/*` to the server's public URL.

## Useful scripts

```bash
# Sonnet vs Opus scoring comparison (no Opus re-run; uses existing answers).
# Output: /tmp/cited-sonnet-comparison.md
cd server && npx tsx scripts/compare-sonnet.ts <brand_id>
```
