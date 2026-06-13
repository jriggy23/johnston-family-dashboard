import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { XMLParser } from 'fast-xml-parser'

// Aggregates headlines from several free RSS feeds (a balanced spread of
// outlets), merged, de-duplicated, and sorted by recency. No API keys needed.

interface Source {
  key: string
  name: string
  url: string
}

const SOURCES: Source[] = [
  { key: 'bbc', name: 'BBC', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { key: 'npr', name: 'NPR', url: 'https://feeds.npr.org/1001/rss.xml' },
  { key: 'fox', name: 'Fox News', url: 'https://moxie.foxnews.com/google-publisher/latest.xml' },
  { key: 'guardian', name: 'The Guardian', url: 'https://www.theguardian.com/world/rss' },
  { key: 'cbs', name: 'CBS News', url: 'https://www.cbsnews.com/latest/rss/main' },
]

interface RssItem {
  title?: string | { '#text'?: string }
  link?: string
  pubDate?: string
}

// processEntities:false avoids fast-xml-parser's entity-expansion limit on
// entity-heavy feeds (e.g. Fox); we decode entities ourselves below.
const parser = new XMLParser({ ignoreAttributes: false, processEntities: false })

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&') // last, so "&amp;lt;" -> "&lt;"
}

function textOf(value: RssItem['title']): string {
  const raw =
    typeof value === 'string'
      ? value
      : value && typeof value === 'object' && typeof value['#text'] === 'string'
        ? value['#text']
        : ''
  return decodeEntities(raw).trim()
}

function timeAgo(pubDate: string, now: number): string {
  const then = new Date(pubDate).getTime()
  if (Number.isNaN(then)) return ''
  const mins = Math.max(0, Math.round((now - then) / 60000))
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.round(hrs / 24)}d ago`
}

async function fetchText(url: string): Promise<string | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 6000)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'user-agent': 'JohnstonFamilyDashboard/1.0 (+https://familydash.jkcons.com)' },
    })
    return res.ok ? await res.text() : null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

interface Article {
  title: string
  link: string
  source: string
  pubDate: string
}

function parseFeed(xml: string, source: Source): Article[] {
  const parsed = parser.parse(xml)
  const raw = parsed?.rss?.channel?.item ?? []
  const items: RssItem[] = Array.isArray(raw) ? raw : [raw]
  return items
    .map((it) => ({
      title: textOf(it.title),
      link: typeof it.link === 'string' ? decodeEntities(it.link) : '#',
      source: source.name,
      pubDate: it.pubDate ?? '',
    }))
    .filter((a) => a.title && a.link !== '#')
}

export async function news(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const limit = Math.min(40, Math.max(1, Number(request.query.get('limit') ?? '14') || 14))

  // Optional ?sources=bbc,npr filter; default to all.
  const requested = request.query.get('sources')
  const selected = requested
    ? SOURCES.filter((s) => requested.split(',').includes(s.key))
    : SOURCES
  const sources = selected.length ? selected : SOURCES

  const results = await Promise.allSettled(
    sources.map(async (s) => {
      const xml = await fetchText(s.url)
      return xml ? parseFeed(xml, s) : []
    }),
  )

  const articles = results
    .filter((r): r is PromiseFulfilledResult<Article[]> => r.status === 'fulfilled')
    .flatMap((r) => r.value)

  if (articles.length === 0) {
    context.warn('news: no articles from any source')
    return { status: 502, jsonBody: { error: 'news upstream error' } }
  }

  const now = Date.now()
  const seen = new Set<string>()
  const items = articles
    .filter((a) => {
      const key = a.title.toLowerCase()
      return seen.has(key) ? false : seen.add(key)
    })
    .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
    .slice(0, limit)
    .map((a, idx) => ({
      id: `n${idx}`,
      title: a.title,
      link: a.link,
      source: a.source,
      ago: timeAgo(a.pubDate, now),
    }))

  return { jsonBody: { source: 'rss', items } }
}

app.http('news', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'news',
  handler: news,
})
