import { Check, Compass, Layers, Search, Sparkles } from 'lucide-react'
import { Nav } from '@/components/Nav'
import { Footer } from '@/components/Footer'
import { UrlInput } from '@/components/UrlInput'
import { ScoreRing } from '@/components/ScoreRing'
import { SuggestionCard } from '@/components/SuggestionCard'
import { Button } from '@/components/Button'

const trustBrands = ['BLOOM', 'KETONE', 'AURA LABS', 'PLANTA', 'NEKTAR', 'ATLAS®']

const steps = [
  {
    n: '01',
    icon: Search,
    title: 'Enter your URL',
    body: 'We scan your site and identify your product, category, and claims in seconds.',
  },
  {
    n: '02',
    icon: Compass,
    title: 'See your score',
    body: 'Your AI Visibility Score shows exactly where you rank across ChatGPT, Perplexity, and Gemini.',
  },
  {
    n: '03',
    icon: Layers,
    title: "Act on today's prompt",
    body: "Every day we surface one high-opportunity prompt you're not winning — and tell you what to publish to claim it.",
  },
]

const tiers = [
  {
    name: 'Starter',
    price: '$99',
    description: 'For solo brands getting started with AEO.',
    features: [
      '50 prompts monitored',
      '1 brand',
      'ChatGPT + Perplexity',
      '5 content drafts / mo',
      'Daily score refresh',
    ],
    cta: 'Start free',
    highlighted: false,
  },
  {
    name: 'Growth',
    price: '$349',
    description: 'For brands scaling their AI visibility.',
    features: [
      '200 prompts monitored',
      '3 brands',
      '+ Gemini + Claude',
      'Unlimited content drafts',
      'Competitor tracking',
      'Slack alerts',
    ],
    cta: 'Start 14-day trial',
    highlighted: true,
  },
  {
    name: 'Agency',
    price: '$999',
    description: 'For agencies running multiple accounts.',
    features: [
      'Unlimited prompts',
      '10 brands',
      'All platforms + custom',
      'White-label reports',
      'API access',
      'Priority support',
    ],
    cta: 'Contact us',
    highlighted: false,
  },
]

export function Landing() {
  return (
    <div className="min-h-screen bg-offwhite">
      <Nav />

      {/* Hero */}
      <section className="mx-auto max-w-[1200px] px-6 pb-20 pt-20 md:pt-28">
        <div className="flex flex-col items-center text-center">
          <span className="kicker">AI VISIBILITY PLATFORM</span>
          <h1 className="mt-5 max-w-[820px] text-balance text-[44px] font-extrabold leading-[0.98] tracking-tightest text-ink md:text-[64px]">
            Is your brand <span className="chrome-text">the answer?</span>
          </h1>
          <p className="mt-6 max-w-[560px] text-[17px] leading-relaxed text-rich md:text-[20px]">
            Cited scans ChatGPT, Perplexity, and Gemini to show you which prompts
            your brand is invisible in — and exactly what to do about it.
          </p>
          <div className="mt-10 w-full">
            <div className="mx-auto flex w-full justify-center">
              <UrlInput />
            </div>
          </div>

          <div className="mt-14 flex w-full flex-col items-center gap-4">
            <span className="kicker">TRUSTED BY GROWTH-STAGE BRANDS</span>
            <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
              {trustBrands.map((b) => (
                <span
                  key={b}
                  className="font-mono text-[12px] tracking-[0.18em] text-silver"
                >
                  {b}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-y border-line bg-white">
        <div className="mx-auto max-w-[1200px] px-6 py-20">
          <div className="flex items-end justify-between">
            <div>
              <span className="kicker">HOW IT WORKS</span>
              <h2 className="mt-2 max-w-[640px] text-[34px] font-bold tracking-tight text-ink md:text-[40px]">
                From URL to actionable prompt in 30 seconds.
              </h2>
            </div>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {steps.map((s) => (
              <div key={s.n} className="card p-7">
                <div className="flex items-baseline justify-between">
                  <span className="chrome-text font-mono text-[28px] font-medium tracking-tightest">
                    {s.n}
                  </span>
                  <s.icon size={18} className="text-mid" />
                </div>
                <h3 className="mt-6 text-[20px] font-semibold text-ink">{s.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-mid">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Score Preview */}
      <section id="preview" className="bg-offwhite">
        <div className="mx-auto max-w-[1200px] px-6 py-20">
          <div className="flex flex-col items-center text-center">
            <span className="kicker">YOUR AI VISIBILITY SCORE</span>
            <h2 className="mt-3 max-w-[680px] text-[34px] font-bold tracking-tight text-ink md:text-[40px]">
              One number. Three platforms. Updated daily.
            </h2>
            <p className="mt-3 max-w-[560px] text-mid">
              Score updates daily as AI models re-index your category.
            </p>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {[
              { score: 34, label: 'Critical · 7 gaps' },
              { score: 58, label: 'Improving · 3 gaps' },
              { score: 71, label: 'Good · holding ground' },
            ].map((s) => (
              <div key={s.score} className="card flex flex-col items-center p-8">
                <ScoreRing score={s.score} size={140} stroke={12} animate={false} />
                <div className="mt-2 text-sm text-mid">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Daily prompt preview */}
      <section className="border-y border-line bg-white">
        <div className="mx-auto max-w-[1200px] px-6 py-20">
          <div className="flex flex-col items-center text-center">
            <span className="kicker">YOUR DAILY PROMPT</span>
            <h2 className="mt-3 max-w-[680px] text-[34px] font-bold tracking-tight text-ink md:text-[40px]">
              Your daily prompt, every morning.
            </h2>
            <p className="mt-3 max-w-[560px] text-mid">
              We surface the highest-opportunity prompt you're not winning, and
              tell you exactly what to publish to claim it.
            </p>
          </div>

          <div className="mx-auto mt-12 grid max-w-[760px] gap-5">
            <SuggestionCard
              prompt="best collagen powder for women over 40"
              highlight="best collagen powder"
              platforms={[
                { platform: 'ChatGPT', cited: false },
                { platform: 'Perplexity', cited: true },
                { platform: 'Gemini', cited: false },
                { platform: 'Claude', cited: false },
              ]}
              opportunity={92}
              recommended="Publish a side-by-side comparison post: 'Marine vs bovine collagen for women over 40.' Cite 2 peer-reviewed studies on hydrolyzed collagen + skin elasticity."
              chips={['Listicle', 'Comparison', '900–1200 words', 'Schema: HowTo']}
            />

            <SuggestionCard
              badge="LOCKED · UPGRADE TO SEE 47 MORE"
              prompt="grass-fed unflavored collagen with no fillers"
              platforms={[
                { platform: 'ChatGPT', cited: false },
                { platform: 'Perplexity', cited: false },
                { platform: 'Gemini', cited: false },
                { platform: 'Claude', cited: false },
              ]}
              opportunity={88}
              recommended="Upgrade to see today's recommendation."
              chips={['LOCKED']}
              locked
            />
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-offwhite">
        <div className="mx-auto max-w-[1200px] px-6 py-20">
          <div className="flex flex-col items-center text-center">
            <span className="kicker">PRICING</span>
            <h2 className="mt-3 max-w-[680px] text-[34px] font-bold tracking-tight text-ink md:text-[40px]">
              Simple plans. 14-day free trial. No credit card.
            </h2>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {tiers.map((t) => (
              <div
                key={t.name}
                className={
                  'relative flex flex-col rounded-xl bg-white p-8 ' +
                  (t.highlighted
                    ? 'border-2 border-ink shadow-card'
                    : 'border border-line shadow-card')
                }
              >
                {t.highlighted && (
                  <span className="absolute -top-3 left-8 inline-flex items-center gap-1 rounded-full bg-ink px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-white">
                    <Sparkles size={11} /> Most popular
                  </span>
                )}
                <div className="kicker">{t.name.toUpperCase()}</div>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-[40px] font-extrabold tracking-tightest text-ink">
                    {t.price}
                  </span>
                  <span className="text-mid">/mo</span>
                </div>
                <p className="mt-2 text-sm text-mid">{t.description}</p>
                <ul className="mt-6 flex flex-col gap-3">
                  {t.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-rich">
                      <span className="mt-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-ink text-white">
                        <Check size={11} strokeWidth={3} />
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-8">
                  <Button
                    variant={t.highlighted ? 'primary' : 'chrome'}
                    size="lg"
                    className="w-full"
                  >
                    {t.cta}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
