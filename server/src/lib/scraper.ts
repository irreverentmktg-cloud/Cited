import * as cheerio from 'cheerio'

export interface ScrapeResult {
  url: string
  finalUrl: string
  title: string
  description: string
  bodyText: string
  headings: string[]
}

const MAX_BODY_CHARS = 12_000

export async function scrapeSite(url: string): Promise<ScrapeResult> {
  const normalized = normalizeUrl(url)
  const res = await fetch(normalized, {
    redirect: 'follow',
    headers: {
      'user-agent':
        'Mozilla/5.0 (compatible; CitedBot/0.1; +https://cited.so/bot)',
      accept: 'text/html,application/xhtml+xml',
    },
  })
  if (!res.ok) {
    throw new ScrapeError(`Fetch failed: ${res.status} ${res.statusText}`)
  }
  const html = await res.text()
  const $ = cheerio.load(html)

  $('script, style, noscript, iframe, svg').remove()

  const title = $('title').first().text().trim() || $('h1').first().text().trim()
  const description =
    $('meta[name="description"]').attr('content')?.trim() ||
    $('meta[property="og:description"]').attr('content')?.trim() ||
    ''
  const headings = $('h1, h2, h3')
    .map((_, el) => $(el).text().replace(/\s+/g, ' ').trim())
    .get()
    .filter(Boolean)
    .slice(0, 30)

  const bodyText = $('body')
    .text()
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_BODY_CHARS)

  return {
    url,
    finalUrl: res.url,
    title,
    description,
    bodyText,
    headings,
  }
}

export class ScrapeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ScrapeError'
  }
}

export function normalizeUrl(input: string): string {
  const trimmed = input.trim()
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed.replace(/^\/+/, '')}`
}
