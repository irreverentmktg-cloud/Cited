# Cited — Lovable Build Brief
**AEO Platform · UI Build Guide for Lovable**

---

## What We're Building

**Cited** is an Answer Engine Optimization (AEO) platform. It tells brands exactly which AI models (ChatGPT, Perplexity, Claude, Gemini) are citing them when people search, which prompts they're invisible in, what competitors are winning, and what to do about it. Think vidIQ, but for AI visibility instead of YouTube.

**The core hook:** You enter your website URL on the landing page → Cited scrapes it → shows you your AI Visibility Score → shows you today's priority prompt to win.

---

## Target User

- DTC brand marketers (supplements, beauty, health, food)
- Marketing managers at e-commerce brands
- Brand directors who care about being recommended by ChatGPT / Perplexity
- NOT developers — this is a marketer's tool

---

## Visual System (from moodboard)

### Fonts
- **UI font:** Inter (weights: 400, 500, 600, 700, 800)
- **Mono/labels:** DM Mono (weights: 400, 500)
- Load from Google Fonts

### Color System
Everything is monochrome **except** the score ring and score number:

| Name | Hex | Usage |
|---|---|---|
| Ink Black | `#0a0a0a` | Primary text, primary buttons, nav |
| Rich Dark | `#2a2a2a` | Dark backgrounds, headings |
| Mid Gray | `#6b6b6b` | Secondary text, icons |
| Silver | `#b0b0b0` | Tertiary text, placeholders |
| Light Gray | `#e5e5e5` | Borders, dividers |
| Off-White | `#f5f5f5` | Page background |
| Pure White | `#ffffff` | Cards |
| Chrome gradient | `#f0f0f0 → #e0e0e0` | Chrome-style buttons and accents |

**Score colors (ONLY used on score rings + score numbers + status tags):**
| Score Range | Color | Hex |
|---|---|---|
| 0–39 (Critical) | Red | `#ef4444` |
| 40–69 (Warning) | Amber | `#f59e0b` |
| 70–100 (Good) | Green | `#22c55e` |

### Card Style
- White background `#ffffff`
- Subtle shadow: `0 0 0 1px rgba(0,0,0,0.06), 0 2px 4px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)`
- Border radius: 12px
- No colored card backgrounds — all cards are white or off-white

### Button Styles
- **Primary:** `#0a0a0a` background, white text, 8px radius
- **Chrome:** light gray gradient (`#f0f0f0 → #e0e0e0`), dark text, subtle inset shadow
- **Ghost:** transparent, dark border, dark text on hover

---

## Screens to Build in Lovable

---

### Screen 1 — Landing Page

**Purpose:** Convert cold visitors. The URL input is the primary CTA — it's how users enter the product.

**Layout:** Single-column marketing page, `max-width: 1200px`, centered.

#### Nav
- Left: Logo "Cited." (Inter 700, with a chrome-gradient period)
- Right: "Sign in" (ghost button) + "Start free" (primary button)
- Sticky on scroll, white background with subtle bottom border

#### Hero Section
- Kicker label (DM Mono, uppercase, `#9b9b9b`): `"AI VISIBILITY PLATFORM"`
- Headline (Inter 800, 64px, tight letter-spacing): `"Is your brand the answer?"`
- Subheadline (Inter 400, 20px, `#4a4a4a`, max-width 520px): `"Cited scans ChatGPT, Perplexity, and Gemini to show you which prompts your brand is invisible in — and exactly what to do about it."`
- **URL Input component** (the hero CTA — this is the most important element):
  - White card with `1px solid #e5e5e5` border, 12px radius, subtle shadow
  - Input field: placeholder `"Enter your website URL — e.g. yourband.com"`
  - Button inside the input bar (right side): `"Analyze My Brand →"` in primary black
  - Below the input (DM Mono, 11px, `#b0b0b0`): `"Free · No credit card · Results in 30 seconds"`
- Trust strip below: logos or names of 5–6 placeholder brand names in gray

#### "How It Works" Section
3-column grid, each column:
- Step number (DM Mono, large, chrome gradient)
- Icon (simple, monochrome)
- Title (Inter 600)
- Description (Inter 400, `#6b6b6b`)

Steps:
1. **Enter your URL** — We scan your site and identify your product, category, and claims in seconds.
2. **See your score** — Your AI Visibility Score shows exactly where you rank across ChatGPT, Perplexity, and Gemini.
3. **Act on today's prompt** — Every day we surface one high-opportunity prompt you're not winning — and tell you what content to create to claim it.

#### Score Preview Section
- Section label (DM Mono): `"YOUR AI VISIBILITY SCORE"`
- Show the three score ring states side-by-side (from moodboard): red 34/100 (Critical), amber 58/100 (Improving), green 71/100 (Good)
- Caption: `"Score updates daily as AI models re-index your category"`

#### Prompt Feed Preview
- Section headline: `"Your daily prompt, every morning"`
- Show one example suggestion card (from moodboard): vidIQ-style with prompt text, status dots, recommended content, action chips, "Generate content draft →" button
- Blurred/locked card below it with upgrade prompt

#### Pricing Section
Three-column pricing table:

| | Starter | Growth | Agency |
|---|---|---|---|
| Price | $99/mo | $349/mo | $999/mo |
| Prompts monitored | 50 | 200 | Unlimited |
| Brands | 1 | 3 | 10 |
| Platforms | ChatGPT + Perplexity | + Gemini + Claude | All + custom |
| Content drafts | 5/mo | Unlimited | Unlimited |
| CTA | Start free | Most popular | Contact us |

- "Growth" column highlighted with black border + "Most popular" badge
- All plans: 14-day free trial, no credit card

#### Footer
- Logo left
- Links: Product, Pricing, Blog, Docs, Privacy, Terms
- `© 2025 Cited Inc.`

---

### Screen 2 — Analyzing Screen (Transition)

**Purpose:** Loading state shown after user enters URL. Feels like something real is happening.

**Layout:** Centered, full-screen, off-white background.

**Content:**
- Logo at top
- Animated progress indicator (horizontal bar with chrome shimmer animation — matches moodboard's `chrome-shimmer` keyframe)
- Domain name displayed: `"Analyzing bloom-collagen.com"`
- Three sequential steps that check off as they complete:
  - ✓ Scanning site content
  - ✓ Identifying product category
  - ⏳ Building your prompt list...
- Subtle body copy: `"We're checking 50+ prompts across ChatGPT, Perplexity, and Gemini for your category"`

---

### Screen 3 — Brand Calibration (Onboarding Step 1)

**Purpose:** Show scraped data to user for confirmation. Builds trust. Critical for accuracy.

**Layout:** Centered card, max-width 560px, white card on off-white background.

**Header of card:**
- DM Mono kicker: `"BRAND CALIBRATION · STEP 1 OF 3"`
- Title (Inter 700): `"We scanned your site. Confirm what we found."`
- Subtitle (`#6b6b6b`): `"Tap ✓ to confirm or ✕ to remove. We'll use this to find the right prompts for you."`

**Check/X Items** (each is a row with label + confirm/reject buttons):
- Product type (e.g. "Marine collagen peptide supplement")
- Primary claim (e.g. "Joint health & skin elasticity")
- Target buyer (e.g. "Women 35–55")
- Price position (e.g. "Budget / value")
- Key differentiator (e.g. "Grass-fed, unflavored, hydrolyzed")

Each row:
- White background `#f8f8f8`, border `#eeeeee`, 9px radius
- Text left, two circle buttons right (✕ and ✓)
- ✕ active state: red border + red icon + red tint bg
- ✓ active state: green border + green icon + green tint bg

**Footer of card:**
- Full-width primary black button: `"Build My Prompt List →"`

---

### Screen 4 — First Score Reveal (Onboarding Step 2)

**Purpose:** The "aha" moment. User sees their score for the first time.

**Layout:** Centered, dramatic. Off-white background.

- DM Mono kicker: `"YOUR AI VISIBILITY SCORE"`
- Large animated score ring (120px, color-coded per score range)
- Score number animates counting up to actual score
- Brand name + category below ring
- Status tag: e.g. `"Critical — 7 gaps"` in red pill
- Below: three quick stat callouts (side by side):
  - Prompts checked: 50
  - Prompts you're cited in: 3
  - Competitor avg score: 61/100
- Primary CTA button: `"See your full prompt report →"`
- Ghost CTA: `"What does this score mean?"`

---

### Screen 5 — Dashboard: Overview

**Purpose:** The main logged-in home screen. Shows score + today's action + alerts.

**Layout:** Sidebar nav + main content area.

#### Sidebar (260px wide)
- Logo at top
- Brand name + category (DM Mono, small, gray)
- Small score ring (60px) centered in sidebar
- Nav items with icons:
  - Overview (active)
  - Prompts (badge showing count)
  - Competitors
  - Settings
- Bottom: plan name + prompt slot meter (progress bar, from moodboard)

#### Main Content Area
- **Page header:** `"Good morning, Jake."` + date in DM Mono
- **Today's Priority Prompt card** (full-width, from moodboard suggestion card design):
  - Type badge: `"TODAY'S PROMPT · CLAIM FIRST"`
  - The prompt text (large, bold, with key phrase in chrome gradient)
  - Status dots: cited / not cited across platforms
  - Opportunity score
  - Recommended content box
  - Action chips
  - Footer: `"Generate content draft →"` + `"Save for later"`
- **Recent Alerts** (2-col grid below):
  - Citation alert (green): "You were cited in ChatGPT for..."
  - Competitor alert (amber): "Vital Proteins claimed 2 new prompts"
- **Streak card** (right column): day streak counter + bar

---

### Screen 6 — Dashboard: Prompts

**Purpose:** Full prompt monitoring feed. User's core working view.

**Layout:** Same sidebar + main content.

**Main area:**
- Header: `"Your Prompt List"` + `"47 / 50 slots used"` progress bar
- Filter tabs: All | Not Cited | Competitor-Owned | Locked
- Date header (DM Mono): `"TODAY — MONDAY APR 28"`
- Stack of suggestion cards (from moodboard)
- Last card: locked/blurred with upgrade prompt

---

### Screen 7 — Dashboard: Competitors

**Purpose:** Show which competitors are winning which prompts.

**Layout:** Same sidebar + main content.

**Main area:**
- Header: `"Competitor Landscape · Supplements"`
- Grid of competitor cards (one per brand):
  - Brand name
  - Score ring
  - Number of prompts owned
  - Top prompt they own
- Below: `"Prompts your competitors own that you don't"` — list of prompt gaps with CTA to claim each

---

### Screen 8 — Dashboard: Settings

**Purpose:** Brand profile management + notifications + billing.

**Layout:** Same sidebar + left/right split.

**Sections:**
- Brand profile (editable version of calibration items)
- Notification preferences (daily digest, citation alerts, competitor moves)
- Plan + usage (prompt slots, current plan, upgrade CTA)
- Team members (add seats)

---

## Lovable Prompt to Get Started

Paste this as your first message in Lovable to scaffold the project:

---

```
Build a SaaS web app called "Cited" — an Answer Engine Optimization (AEO) platform that helps DTC brands track and improve their visibility in AI models like ChatGPT, Perplexity, and Gemini.

VISUAL STYLE:
- Clean, minimal, monochrome base (blacks, grays, whites)
- Font: Inter for UI copy, DM Mono for labels, scores, and mono data
- Page background: #f5f5f5 (off-white)
- Cards: pure white (#ffffff) with subtle shadows (0 0 0 1px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.06)), 12px border radius
- Buttons: primary is solid #0a0a0a with white text; chrome button is light gray gradient (#f0f0f0 to #e0e0e0) with dark text
- Color is ONLY used for the score system: red #ef4444 (0–39), amber #f59e0b (40–69), green #22c55e (70–100). Everything else is monochrome.
- Aesthetic reference: Linear.app + vidIQ combined — precision SaaS meets daily action feed

START WITH THE LANDING PAGE:
- Sticky nav: Logo "Cited." left, "Sign in" + "Start free" right
- Hero section with a large headline "Is your brand the answer?" and a URL input bar (white card with input field + "Analyze My Brand →" black button inside it, label below: "Free · No credit card · Results in 30 seconds")
- 3-step "How it works" section (Enter URL → See score → Act on today's prompt)
- Score ring preview showing three states: red 34/100, amber 58/100, green 71/100 (circular SVG ring with animated shimmer)
- A sample daily prompt card (vidIQ-style: prompt text in bold, status dots showing cited/not cited, recommended content box in #f8f8f8, action chips, "Generate content draft →" CTA)
- 3-column pricing: Starter $99/mo, Growth $349/mo (highlighted), Agency $999/mo
- Footer

Use React with Tailwind CSS. Connect to Supabase for auth (email + Google OAuth). Make it responsive. Start with the landing page only — I'll give you each additional screen after.
```

---

## Screen Build Order for Lovable

Build these one at a time, in order:

1. Landing page (above prompt)
2. Analyzing screen (loading transition)
3. Brand calibration (onboarding step 1)
4. First score reveal (onboarding step 2)
5. Dashboard: Overview
6. Dashboard: Prompts feed
7. Dashboard: Competitors
8. Dashboard: Settings

After each screen, review it and give Lovable feedback before moving to the next.

---

## What Claude (Cowork) Builds — Not Lovable

Once Lovable has the UI shells in place, Claude handles all backend logic:

- URL scraper (reads site, extracts product/claims/category)
- LLM query engine (asks ChatGPT, Perplexity, Claude, Gemini the tracked prompts)
- Score calculation algorithm
- Nightly job runner (automated daily checks)
- Database schema (brands, prompts, results, scores history)
- API routes connecting Lovable frontend to Railway backend
- Learning engine (pattern detection + recommendation generation)

---

*Brief version 1.0 — April 2026*
