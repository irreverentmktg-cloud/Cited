# BYO API Keys — design notes & migration plan

> Scaffolding only. Nothing in here is wired into the request path yet.
> See `migrations/001_byo_api_keys.sql` and `server/src/lib/keys.ts`.

## Why

Today the server reads a single `ANTHROPIC_API_KEY` from env. That works
for an internal demo but doesn't work for SaaS:

- One operator key bears all customer load → unit cost = scale × per-cycle
  cost. Doesn't fit the "Input is the brain, not the LLM" pricing model.
- No way to attribute spend to a customer.
- One bad / out-of-credits state takes down every customer at once.

The production model is: each customer brings their own key for each
provider (Anthropic, OpenAI, Perplexity, Google) and the server passes
through. Customer pays the LLM bill; we charge a flat platform fee.

## What's scaffolded in this commit

- **`migrations/001_byo_api_keys.sql`** — `brand_api_keys` table with a
  pointer to a Supabase Vault secret. Not applied yet.
- **`server/src/lib/keys.ts`** — `resolveApiKey(brandId, provider)`. Today
  it always falls back to env vars (since the table doesn't exist yet); after
  the migration it will check `brand_api_keys` first and use the customer's
  stored key.
- **No changes to existing call sites yet.** The migration is intentionally
  non-disruptive.

## What still needs to be done to fully ship BYO

### Server refactor (~2 hrs)

Five files currently construct an Anthropic client at module load using
`env.ANTHROPIC_API_KEY`. Each needs to accept a key per call (or per
brand-context) and build the client inside the call:

- `server/src/lib/providers/claude.ts` — `ClaudeProvider` is constructed
  once at boot. Make `ask(prompt, brandId)` and resolve the key inside.
- `server/src/lib/calibrate.ts` — used by `POST /api/analyze`. Tricky
  because there's no brand_id yet at analyze time. Two options:
  (a) require an existing brand context (force re-onboarding to be done
  by an existing tenant); (b) keep this one on the platform's key for
  trial-tier analysis and switch to customer key at `POST /api/brands`.
- `server/src/lib/promptlist.ts` — called from `POST /api/brands`, brand
  exists by then; pass `brandId` through.
- `server/src/lib/extract.ts` — called per-prompt-per-platform from the
  runner; `brand` already in scope.
- `server/src/lib/recommend.ts` — same as extract.

Pattern for the refactor:

```ts
// before
const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })

// after
async function clientForBrand(brandId: string | null) {
  const key = await resolveApiKey(brandId, 'anthropic')
  if (!key) throw new MissingApiKeyError('anthropic', brandId)
  return new Anthropic({ apiKey: key })
}
```

### Settings UI (~2 hrs)

Per-provider key management on the Settings page:

- Section: "Connect your AI provider keys"
- One row per provider (Anthropic, OpenAI, Perplexity, Google)
- For each: input field (masked), "Test key" button, status badge
  (valid / invalid / no_credits / not_set), "Disconnect" link
- Provider help links: where to create a key, expected key format

Backend endpoints needed:
- `POST /api/brands/:id/keys` — `{ provider, key }`. Stores in vault,
  upserts `brand_api_keys`, validates against the provider's me/usage
  endpoint.
- `DELETE /api/brands/:id/keys/:provider` — removes the secret + row.
- `POST /api/brands/:id/keys/:provider/test` — re-validates.

### Validation strategy

Each provider has a different "is this key live and has credits" check:

- **Anthropic**: `GET /v1/models` (lightweight). Inspect any error.
- **OpenAI**: `GET /v1/models` (lightweight).
- **Perplexity**: no good lightweight endpoint; do a tiny `chat/completions`
  request against `sonar-small-online`.
- **Google**: `GET /v1beta/models` for Gemini.

### Error UX

When a customer's key fails mid-cycle, the user-visible state on the
dashboard should be unambiguous:

- The platform's score bar → "Connect your Anthropic key" CTA instead of
  numbers
- Per-prompt platform dot for that provider → orange "key issue" rather
  than "pending"
- Inline link to Settings to fix

### Cost framing changes

Once BYO is live, the customer sees their LLM spend directly in their
Anthropic console. Our pricing becomes:

- Starter: $99/mo platform fee, customer pays LLM
- Growth: $249/mo, more brands, customer pays LLM
- Enterprise: $749/mo, multiple seats, customer pays LLM

The optimization work we already did (prompt caching, `max_uses: 2`,
Sonnet for extraction/recommendations) is **still valuable** in BYO — it
keeps the customer's monthly Anthropic bill closer to $30/brand than $200/
brand, which directly affects perceived value. Don't undo it.

## Order of operations when you're ready to flip

1. Apply `migrations/001_byo_api_keys.sql` to the Supabase project.
2. Refactor the five Claude call sites to take a `brandId` and resolve the
   key via `resolveApiKey()`.
3. Add the three Settings endpoints + UI section.
4. Add validation calls.
5. Switch the calibrate flow (decide: platform key or first-brand key).
6. Test end-to-end with a customer key.
7. Add per-customer error UX states.
8. Update README + pricing pages.

Estimated total: 1 focused day of work.
