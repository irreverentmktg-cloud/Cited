-- ============================================================
-- CITED — Supabase/Postgres Schema
-- Version 1.0 | April 2026
-- ============================================================
-- Architecture:
--   Supabase = auth (users table managed by Supabase Auth) + this DB
--   Railway  = API server + scraper + LLM engine + nightly runner
--   Lovable  = React frontend, calls Railway API
-- ============================================================


-- ── EXTENSIONS ───────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- for fuzzy text search on prompts


-- ── ENUMS ────────────────────────────────────────────────────
CREATE TYPE plan_tier AS ENUM ('free', 'starter', 'pro', 'agency');
CREATE TYPE ai_model  AS ENUM ('chatgpt', 'perplexity', 'gemini', 'claude');
CREATE TYPE alert_type AS ENUM ('citation_gained', 'citation_lost', 'competitor_gained', 'competitor_lost', 'score_drop', 'score_rise', 'new_gap');
CREATE TYPE prompt_status AS ENUM ('active', 'paused', 'archived');
CREATE TYPE recommendation_status AS ENUM ('pending', 'saved', 'acted', 'dismissed');


-- ============================================================
-- TABLE: profiles
-- One row per Supabase Auth user. Created via trigger on signup.
-- ============================================================
CREATE TABLE profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  full_name     TEXT,
  plan_tier     plan_tier NOT NULL DEFAULT 'free',
  -- prompt_slots: max prompts allowed across all brands on this plan
  prompt_slots  INT NOT NULL DEFAULT 5,
  -- billing
  stripe_customer_id    TEXT,
  stripe_subscription_id TEXT,
  plan_expires_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- ============================================================
-- TABLE: brands
-- The core entity. One user can have multiple brands (agency plan).
-- ============================================================
CREATE TABLE brands (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- Identity
  name            TEXT NOT NULL,
  domain          TEXT NOT NULL,          -- e.g. "bloom-collagen.com"
  -- Scraped + calibrated metadata (from onboarding step 1)
  category        TEXT,                   -- e.g. "Marine Collagen Supplement"
  product_type    TEXT,                   -- e.g. "Marine collagen peptide powder"
  primary_claim   TEXT,                   -- e.g. "Joint health & skin elasticity"
  target_buyer    TEXT,                   -- e.g. "Women 35-55"
  price_position  TEXT,                   -- e.g. "Premium"
  key_differentiator TEXT,               -- e.g. "Grass-fed, unflavored, hydrolyzed"
  -- Raw scraped content (stored for re-calibration)
  scraped_content JSONB,                  -- { title, meta_desc, headings[], body_excerpt }
  -- Onboarding state
  calibration_confirmed BOOLEAN DEFAULT FALSE,
  -- Status
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Constraints
  UNIQUE(user_id, domain)
);

CREATE INDEX idx_brands_user_id ON brands(user_id);
CREATE INDEX idx_brands_domain  ON brands(domain);


-- ============================================================
-- TABLE: prompts
-- The prompts being tracked for a brand. Each prompt is a
-- search query that gets fired at each AI model daily.
-- ============================================================
CREATE TABLE prompts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id        UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  -- The prompt text
  prompt_text     TEXT NOT NULL,
  -- Classification
  category        TEXT,                   -- e.g. "Product Comparison", "Use Case", "Branded"
  is_branded      BOOLEAN DEFAULT FALSE,  -- true if prompt includes brand name explicitly
  -- Metadata
  status          prompt_status NOT NULL DEFAULT 'active',
  -- Priority score: 0-100, higher = more valuable to win (calculated by Railway)
  opportunity_score FLOAT DEFAULT 0,
  -- Slot tracking: each active prompt consumes one slot from plan limit
  slot_consumed   BOOLEAN NOT NULL DEFAULT TRUE,
  -- AI-generated or user-added
  source          TEXT DEFAULT 'ai_generated', -- 'ai_generated' | 'user_added'
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(brand_id, prompt_text)
);

CREATE INDEX idx_prompts_brand_id ON prompts(brand_id);
CREATE INDEX idx_prompts_status   ON prompts(brand_id, status);
-- Full-text search on prompt text
CREATE INDEX idx_prompts_text_search ON prompts USING gin(prompt_text gin_trgm_ops);


-- ============================================================
-- TABLE: prompt_checks
-- One row per (prompt × model × day). The raw result of
-- asking an AI model the prompt and checking if brand is cited.
-- This is the core fact table — everything else is derived from it.
-- ============================================================
CREATE TABLE prompt_checks (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prompt_id       UUID NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  brand_id        UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,  -- denormalized for query speed
  model           ai_model NOT NULL,
  checked_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Results
  is_cited        BOOLEAN NOT NULL DEFAULT FALSE,
  -- The snippet of the AI response where the brand appears (NULL if not cited)
  citation_snippet TEXT,
  -- Raw full response from the model (truncated to 2000 chars)
  raw_response    TEXT,
  -- Which competitors appeared in this response
  competitors_cited JSONB DEFAULT '[]',  -- [{ name, domain, snippet }]
  -- How prominently was brand mentioned: 'primary' | 'mentioned' | 'absent'
  citation_strength TEXT DEFAULT 'absent',
  -- Error tracking
  check_error     TEXT,   -- NULL if successful
  -- Job reference
  job_id          TEXT,   -- references the Railway nightly job run
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_prompt_checks_prompt_id   ON prompt_checks(prompt_id);
CREATE INDEX idx_prompt_checks_brand_id    ON prompt_checks(brand_id);
CREATE INDEX idx_prompt_checks_model       ON prompt_checks(brand_id, model);
CREATE INDEX idx_prompt_checks_checked_at  ON prompt_checks(brand_id, checked_at DESC);
-- Prevent duplicate checks for same prompt+model on same day
CREATE UNIQUE INDEX idx_prompt_checks_daily
  ON prompt_checks(prompt_id, model, DATE(checked_at));


-- ============================================================
-- TABLE: brand_scores
-- Daily snapshot of the overall visibility score per brand.
-- Calculated by Railway after each nightly run completes.
-- ============================================================
CREATE TABLE brand_scores (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id        UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  score_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  -- Overall score (0-100), weighted average across all models
  overall_score   INT NOT NULL DEFAULT 0,
  -- Per-model breakdown
  chatgpt_score   INT DEFAULT 0,
  perplexity_score INT DEFAULT 0,
  gemini_score    INT DEFAULT 0,
  claude_score    INT DEFAULT 0,
  -- Citation counts
  prompts_checked INT DEFAULT 0,
  prompts_cited   INT DEFAULT 0,
  -- Change from previous day
  score_delta     INT DEFAULT 0,        -- positive = improved, negative = dropped
  -- Prompt gap count
  gap_count       INT DEFAULT 0,        -- prompts where competitor cited but brand not
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(brand_id, score_date)
);

CREATE INDEX idx_brand_scores_brand_date ON brand_scores(brand_id, score_date DESC);


-- ============================================================
-- TABLE: competitors
-- Competitors tracked per brand. Populated from prompt_checks
-- JSONB (competitors_cited) and/or user-added.
-- ============================================================
CREATE TABLE competitors (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id        UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  domain          TEXT,
  -- Latest stats (updated nightly by Railway)
  latest_score    INT DEFAULT 0,
  prompts_owned   INT DEFAULT 0,        -- prompts where they're cited but brand isn't
  top_prompt      TEXT,                 -- their highest-opportunity prompt they own
  -- Discovery
  first_seen_at   TIMESTAMPTZ DEFAULT NOW(),
  is_user_added   BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(brand_id, domain)
);

CREATE INDEX idx_competitors_brand_id ON competitors(brand_id);


-- ============================================================
-- TABLE: competitor_checks
-- Tracks competitor citation results per prompt, mirroring
-- prompt_checks but for competitor brands.
-- ============================================================
CREATE TABLE competitor_checks (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prompt_id       UUID NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  competitor_id   UUID NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  brand_id        UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  model           ai_model NOT NULL,
  checked_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_cited        BOOLEAN NOT NULL DEFAULT FALSE,
  citation_strength TEXT DEFAULT 'absent',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(prompt_id, competitor_id, model, DATE(checked_at))
);

CREATE INDEX idx_competitor_checks_brand_id ON competitor_checks(brand_id);
CREATE INDEX idx_competitor_checks_prompt_id ON competitor_checks(prompt_id);


-- ============================================================
-- TABLE: daily_priority_prompts
-- The "Today's Prompt" feature. One row per brand per day.
-- Selected by Railway based on opportunity_score, recent momentum,
-- and competitor gaps.
-- ============================================================
CREATE TABLE daily_priority_prompts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id        UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  prompt_id       UUID NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  priority_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  -- Why this prompt was selected
  opportunity_score     FLOAT DEFAULT 0,
  selection_reason      TEXT,           -- e.g. "Competitor winning this; high search intent"
  -- Recommended action
  recommended_content_type TEXT,        -- e.g. "FAQ page", "Blog post", "Product page section"
  recommendation_text      TEXT,        -- the specific content recommendation
  -- Has user acted on it?
  is_acted_on     BOOLEAN DEFAULT FALSE,
  acted_at        TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(brand_id, priority_date)
);

CREATE INDEX idx_daily_priority_brand_date ON daily_priority_prompts(brand_id, priority_date DESC);


-- ============================================================
-- TABLE: content_recommendations
-- Actionable content recommendations per prompt.
-- Generated by Railway LLM layer after gap analysis.
-- ============================================================
CREATE TABLE content_recommendations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prompt_id       UUID NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  brand_id        UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  -- The recommendation
  content_type    TEXT NOT NULL,        -- e.g. "FAQ", "Blog Post", "Landing Page", "Reddit Thread"
  title_suggestion TEXT,               -- e.g. "Is [Brand] good for joint pain?"
  body_outline    TEXT,                -- full content outline
  -- Why this will work
  rationale       TEXT,
  -- Priority
  impact_score    FLOAT DEFAULT 0,     -- estimated citation gain if implemented
  status          recommendation_status NOT NULL DEFAULT 'pending',
  -- Timestamps
  acted_at        TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_content_recs_brand_id  ON content_recommendations(brand_id);
CREATE INDEX idx_content_recs_prompt_id ON content_recommendations(prompt_id);


-- ============================================================
-- TABLE: alerts
-- Real-time feed of notable events for the brand.
-- Created by Railway when nightly checks detect changes.
-- ============================================================
CREATE TABLE alerts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id        UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  prompt_id       UUID REFERENCES prompts(id) ON DELETE SET NULL,
  type            alert_type NOT NULL,
  -- Human-readable message
  title           TEXT NOT NULL,        -- e.g. "You were cited in ChatGPT"
  body            TEXT,                 -- e.g. "For prompt: 'best collagen powder for women'"
  -- Context
  model           ai_model,
  competitor_name TEXT,                 -- populated for competitor alerts
  -- Read state
  is_read         BOOLEAN DEFAULT FALSE,
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_alerts_brand_id    ON alerts(brand_id, created_at DESC);
CREATE INDEX idx_alerts_unread      ON alerts(brand_id, is_read) WHERE is_read = FALSE;


-- ============================================================
-- TABLE: job_runs
-- Audit log of every nightly Railway job run.
-- Used for debugging, retry logic, and run history.
-- ============================================================
CREATE TABLE job_runs (
  id              TEXT PRIMARY KEY,     -- e.g. "run_20260428_0200"
  run_type        TEXT NOT NULL,        -- 'nightly' | 'manual' | 'onboarding'
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ,
  -- Stats
  brands_processed    INT DEFAULT 0,
  prompts_checked     INT DEFAULT 0,
  checks_succeeded    INT DEFAULT 0,
  checks_failed       INT DEFAULT 0,
  -- Status
  status          TEXT DEFAULT 'running',  -- 'running' | 'completed' | 'failed' | 'partial'
  error_summary   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- TABLE: url_analyses
-- Stores one-time landing page URL analyses (pre-signup).
-- Used by the "Enter your URL" hero flow.
-- ============================================================
CREATE TABLE url_analyses (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  domain          TEXT NOT NULL,
  -- Scraped data
  scraped_name    TEXT,
  scraped_category TEXT,
  scraped_product_type TEXT,
  scraped_primary_claim TEXT,
  scraped_target_buyer TEXT,
  scraped_raw     JSONB,
  -- Quick score (from 5 sample prompts, not full 50)
  preview_score   INT,
  preview_prompts_checked INT DEFAULT 5,
  preview_prompts_cited   INT DEFAULT 0,
  preview_results JSONB,               -- [{prompt, model, is_cited, snippet}]
  -- User conversion
  converted_to_signup BOOLEAN DEFAULT FALSE,
  user_id         UUID REFERENCES profiles(id) ON DELETE SET NULL,
  -- TTL: purge after 7 days if no signup
  expires_at      TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_url_analyses_domain ON url_analyses(domain);
CREATE INDEX idx_url_analyses_expires ON url_analyses(expires_at);


-- ============================================================
-- VIEWS
-- Pre-computed views used by Railway API for common queries
-- ============================================================

-- Latest score per brand
CREATE OR REPLACE VIEW v_brand_latest_score AS
SELECT DISTINCT ON (brand_id)
  brand_id,
  score_date,
  overall_score,
  chatgpt_score,
  perplexity_score,
  gemini_score,
  claude_score,
  prompts_checked,
  prompts_cited,
  score_delta,
  gap_count
FROM brand_scores
ORDER BY brand_id, score_date DESC;

-- Prompt citation summary (last 7 days)
CREATE OR REPLACE VIEW v_prompt_citation_summary AS
SELECT
  p.id AS prompt_id,
  p.brand_id,
  p.prompt_text,
  p.category,
  p.opportunity_score,
  p.status,
  COUNT(pc.id) FILTER (WHERE pc.is_cited = TRUE)  AS total_citations_7d,
  COUNT(pc.id) FILTER (WHERE pc.is_cited = FALSE) AS total_misses_7d,
  COUNT(DISTINCT pc.model) FILTER (WHERE pc.is_cited = TRUE) AS models_citing,
  MAX(pc.checked_at) AS last_checked_at,
  BOOL_OR(pc.is_cited) AS ever_cited
FROM prompts p
LEFT JOIN prompt_checks pc
  ON pc.prompt_id = p.id
  AND pc.checked_at >= NOW() - INTERVAL '7 days'
WHERE p.status = 'active'
GROUP BY p.id, p.brand_id, p.prompt_text, p.category, p.opportunity_score, p.status;

-- Competitor gap view: prompts where competitor cited but brand not (today)
CREATE OR REPLACE VIEW v_competitor_gaps AS
SELECT
  p.id AS prompt_id,
  p.brand_id,
  p.prompt_text,
  comp.id AS competitor_id,
  comp.name AS competitor_name,
  cc.model,
  DATE(cc.checked_at) AS gap_date
FROM prompts p
JOIN competitor_checks cc ON cc.prompt_id = p.id AND cc.is_cited = TRUE
JOIN competitors comp ON comp.id = cc.competitor_id
WHERE NOT EXISTS (
  SELECT 1 FROM prompt_checks pc
  WHERE pc.prompt_id = p.id
    AND pc.model = cc.model
    AND pc.is_cited = TRUE
    AND DATE(pc.checked_at) = DATE(cc.checked_at)
)
AND DATE(cc.checked_at) = CURRENT_DATE;


-- ============================================================
-- ROW-LEVEL SECURITY (RLS)
-- Users can only access their own data.
-- Railway service role bypasses RLS using service key.
-- ============================================================

ALTER TABLE profiles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompts                ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_checks          ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_scores           ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitors            ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_checks      ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_priority_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE url_analyses           ENABLE ROW LEVEL SECURITY;

-- Profiles: user sees only their own
CREATE POLICY "profiles_own" ON profiles
  FOR ALL USING (auth.uid() = id);

-- Brands: user sees only their own
CREATE POLICY "brands_own" ON brands
  FOR ALL USING (auth.uid() = user_id);

-- All brand-linked tables: access via brand ownership
CREATE POLICY "prompts_own" ON prompts
  FOR ALL USING (
    brand_id IN (SELECT id FROM brands WHERE user_id = auth.uid())
  );

CREATE POLICY "prompt_checks_own" ON prompt_checks
  FOR ALL USING (
    brand_id IN (SELECT id FROM brands WHERE user_id = auth.uid())
  );

CREATE POLICY "brand_scores_own" ON brand_scores
  FOR ALL USING (
    brand_id IN (SELECT id FROM brands WHERE user_id = auth.uid())
  );

CREATE POLICY "competitors_own" ON competitors
  FOR ALL USING (
    brand_id IN (SELECT id FROM brands WHERE user_id = auth.uid())
  );

CREATE POLICY "competitor_checks_own" ON competitor_checks
  FOR ALL USING (
    brand_id IN (SELECT id FROM brands WHERE user_id = auth.uid())
  );

CREATE POLICY "daily_priority_own" ON daily_priority_prompts
  FOR ALL USING (
    brand_id IN (SELECT id FROM brands WHERE user_id = auth.uid())
  );

CREATE POLICY "content_recs_own" ON content_recommendations
  FOR ALL USING (
    brand_id IN (SELECT id FROM brands WHERE user_id = auth.uid())
  );

CREATE POLICY "alerts_own" ON alerts
  FOR ALL USING (
    brand_id IN (SELECT id FROM brands WHERE user_id = auth.uid())
  );

-- url_analyses: user sees only their own (or anonymous rows by session — Railway handles this)
CREATE POLICY "url_analyses_own" ON url_analyses
  FOR ALL USING (
    user_id = auth.uid() OR user_id IS NULL
  );


-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Auto-update updated_at on row changes
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER brands_updated_at
  BEFORE UPDATE ON brands FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER prompts_updated_at
  BEFORE UPDATE ON prompts FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER competitors_updated_at
  BEFORE UPDATE ON competitors FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER content_recs_updated_at
  BEFORE UPDATE ON content_recommendations FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Check if a brand has prompt slots available
CREATE OR REPLACE FUNCTION brand_has_prompt_slots(p_brand_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  user_slots    INT;
  used_slots    INT;
BEGIN
  SELECT p.prompt_slots INTO user_slots
  FROM profiles p
  JOIN brands b ON b.user_id = p.id
  WHERE b.id = p_brand_id;

  SELECT COUNT(*) INTO used_slots
  FROM prompts
  WHERE brand_id = p_brand_id
    AND status = 'active'
    AND slot_consumed = TRUE;

  RETURN used_slots < user_slots;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
