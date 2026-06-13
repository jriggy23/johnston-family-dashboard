import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { load } from 'cheerio'

// Showtimes for the local Epic, scraped from CinemaClock's server-rendered
// theater page (free). Source/theater are overridable via app settings.
// Note: this depends on CinemaClock's HTML; if they change it, parsing may need
// an update (the frontend falls back to release dates when this is empty).

const DEFAULT_URL = 'https://www.cinemaclock.com/movie-theaters/epic-theatres-stuart'
const DEFAULT_THEATER = 'Epic Theatres of Stuart'

export interface ShowDay {
  label: string // "Today" or weekday e.g. "Sun"
  date: string // e.g. "Jun 14"
  times: string[] // e.g. ["1:00 PM", "4:05 PM"]
}

export interface ShowtimeMovie {
  title: string
  normalized: string
  days: ShowDay[]
}

// "Aladdin: The Return!" -> "aladdinthereturn"
export function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function formatTime(hhmm: string | undefined): string | null {
  if (!hhmm || !/^\d{3,4}$/.test(hhmm)) return null
  const n = Number(hhmm)
  const h24 = Math.floor(n / 100)
  const m = n % 100
  const period = h24 >= 12 ? 'PM' : 'AM'
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return `${h12}:${String(m).padStart(2, '0')} ${period}`
}

export function parseShowtimes(html: string): ShowtimeMovie[] {
  const $ = load(html)
  const movies: ShowtimeMovie[] = []

  $('.showtimeblock.movie').each((_, block) => {
    const $block = $(block)
    const title = $block.find('h3.movietitle a').first().text().trim()
    if (!title) return

    // Aggregate times by day (a movie may repeat across formats/auditoriums).
    const byDate = new Map<string, ShowDay>()
    const add = (label: string, date: string, $scope: ReturnType<typeof $>) => {
      const key = date || label
      if (!key) return
      let day = byDate.get(key)
      if (!day) {
        day = { label, date, times: [] }
        byDate.set(key, day)
      }
      $scope.find('span.tix[data-time]').each((__, el) => {
        const t = formatTime($(el).attr('data-time'))
        if (t && !day!.times.includes(t)) day!.times.push(t)
      })
    }

    // Today's paragraph(s).
    $block.find('p.times').each((__, p) => {
      const date = $(p).find('.timesdate').first().text().trim()
      add('Today', date, $(p))
    })
    // Future days, grouped one per <s>.
    $block.find('p.timesother > s').each((__, s) => {
      const $s = $(s)
      const date = $s.find('.timesdate').first().text().trim()
      const dow = $s.find('u').first().text().replace(/\s+/g, ' ').replace(date, '').trim()
      add(dow || date, date, $s)
    })

    const days = [...byDate.values()].filter((d) => d.times.length > 0).slice(0, 5)
    if (days.length > 0) {
      movies.push({ title, normalized: normalizeTitle(title), days })
    }
  })

  return movies
}

export async function showtimes(
  _request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const url = process.env.SHOWTIMES_URL || DEFAULT_URL
  const theater = process.env.SHOWTIMES_THEATER || DEFAULT_THEATER

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
        accept: 'text/html',
      },
    }).finally(() => clearTimeout(timer))

    if (!res.ok) {
      context.warn(`CinemaClock returned ${res.status}`)
      return { status: 502, jsonBody: { error: 'showtimes upstream error' } }
    }
    const movies = parseShowtimes(await res.text())
    return { jsonBody: { source: 'cinemaclock', theater, movies } }
  } catch (err) {
    context.error('showtimes fetch failed', err)
    return { status: 502, jsonBody: { error: 'showtimes upstream error' } }
  }
}

app.http('showtimes', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'showtimes',
  handler: showtimes,
})
