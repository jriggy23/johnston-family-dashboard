import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { XMLParser } from 'fast-xml-parser'

const FEEDS: Record<string, string> = {
  latest: 'https://moxie.foxnews.com/google-publisher/latest.xml',
  world: 'https://moxie.foxnews.com/google-publisher/world.xml',
  politics: 'https://moxie.foxnews.com/google-publisher/politics.xml',
  sports: 'https://moxie.foxnews.com/google-publisher/sports.xml',
}

interface RssItem {
  title?: string
  link?: string
  pubDate?: string
  category?: string | string[]
}

const parser = new XMLParser()

function timeAgo(pubDate?: string): string {
  if (!pubDate) return ''
  const then = new Date(pubDate).getTime()
  if (Number.isNaN(then)) return ''
  const mins = Math.round((Date.now() - then) / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.round(hrs / 24)}d ago`
}

export async function news(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const topicsParam = request.query.get('topics')
  const topics = topicsParam
    ? topicsParam.split(',').filter((t) => t in FEEDS)
    : ['latest']
  const limit = Number(request.query.get('limit') ?? '10')

  try {
    const results = await Promise.all(
      topics.map(async (topic) => {
        const res = await fetch(FEEDS[topic])
        if (!res.ok) return []
        const xml = await res.text()
        const parsed = parser.parse(xml)
        const items: RssItem[] = parsed?.rss?.channel?.item ?? []
        return (Array.isArray(items) ? items : [items]).map((it) => ({
          title: it.title ?? '',
          link: it.link ?? '#',
          category: Array.isArray(it.category) ? it.category[0] : (it.category ?? topic),
          ago: timeAgo(it.pubDate),
          pubDate: it.pubDate ?? '',
        }))
      }),
    )

    const merged = results
      .flat()
      .filter((i) => i.title)
      .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
      .slice(0, limit)
      .map((it, idx) => ({
        id: `n${idx}`,
        title: it.title,
        link: it.link,
        category: it.category,
        ago: it.ago,
      }))

    return { jsonBody: { source: 'Fox News', items: merged } }
  } catch (err) {
    context.error('news fetch failed', err)
    return { status: 502, jsonBody: { error: 'news upstream error' } }
  }
}

app.http('news', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'news',
  handler: news,
})
