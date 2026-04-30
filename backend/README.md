# Cited Backend — Railway Service

## Quick Start

```bash
cd backend
npm install
cp .env.example .env   # fill in your API keys
```

## Run the nightly job manually right now
```bash
npm run nightly
```

## Check any brand from the command line (no DB needed)
```bash
# Basic check — 5 prompts across all 4 models
npm run check -- --domain vital-proteins.com

# Custom prompts + models
npm run check -- --domain bloom-collagen.com --prompts 10 --models chatgpt,perplexity

# Just ChatGPT, 3 prompts
npm run check -- --domain yourbrand.com --prompts 3 --models chatgpt
```

## Start the API server (for Lovable to call)
```bash
npm run dev     # development (with nodemon)
npm start       # production
```

## API Endpoints
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/analyze` | Landing page URL scan |
| GET | `/api/brands/:id/overview` | Dashboard data |
| GET | `/api/brands/:id/daily-prompt` | Today's priority prompt |
| PATCH | `/api/brands/:id/calibration` | Save onboarding calibration |
| GET | `/api/scores/:brandId` | Latest score + 30d history |
| GET | `/api/prompts/:brandId` | Prompt feed |
| GET | `/api/alerts/:brandId` | Alert feed |
| PATCH | `/api/alerts/:id/read` | Mark alert read |
| GET | `/api/competitors/:brandId` | Competitor landscape |
| GET | `/health` | Health check |
| POST | `/internal/run-nightly` | Manually trigger nightly job |

## Environment Variables
See `.env.example` — minimum to get started:
- `OPENAI_API_KEY` — required for scraping + prompt generation + ChatGPT checks
- `PERPLEXITY_API_KEY` — for Perplexity checks
- `GOOGLE_GEMINI_API_KEY` — for Gemini checks
- `ANTHROPIC_API_KEY` — for Claude checks

Supabase vars are optional for local testing — the app runs in dry-run mode without them.

## File Structure
```
src/
├── index.js              # Express server + cron scheduler
├── lib/
│   ├── supabase.js       # DB client (service role)
│   └── logger.js         # Winston logger
├── services/
│   ├── llmEngine.js      # Core: fire prompts at AI models
│   ├── scraper.js        # URL → brand metadata
│   ├── promptGenerator.js # Brand metadata → 50 prompts
│   └── scoreCalculator.js # Check results → 0-100 score
├── jobs/
│   ├── nightly.js        # Main daily job runner
│   └── check-single.js   # CLI tool for manual checks
└── routes/
    ├── analyze.js        # POST /api/analyze
    ├── brands.js         # Brand routes
    ├── scores.js         # Score routes
    ├── prompts.js        # Prompt routes
    ├── alerts.js         # Alert routes
    └── competitors.js    # Competitor routes
```
