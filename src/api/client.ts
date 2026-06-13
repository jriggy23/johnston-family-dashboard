// Typed clients for the dashboard's backend (Azure Functions under /api).
//
// Each fetcher throws on a non-OK response so callers can fall back to mock
// data. The pure mapping helpers are exported separately so they can be unit
// tested without the network.

import type {
  FamilyMember,
  NewsItem,
  StreamingTitle,
  TheatricalRelease,
  Weather,
} from '../types'
import { serviceColors } from '../data/serviceColors'

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { accept: 'application/json' } })
  if (!res.ok) throw new Error(`${url} -> ${res.status}`)
  return (await res.json()) as T
}

// --- Weather (Open-Meteo via /api/weather; one call per member's location) ---

interface WeatherResponse {
  tempF: number
  highF: number
  lowF: number
  condition: string
  icon: string
}

export async function fetchWeatherForMembers(
  members: FamilyMember[],
): Promise<Weather[]> {
  const settled = await Promise.allSettled(
    members.map(async (m): Promise<Weather> => {
      const { latitude, longitude } = m.location
      const data = await getJson<WeatherResponse>(
        `/api/weather?lat=${latitude}&lon=${longitude}`,
      )
      return { memberId: m.id, ...data }
    }),
  )
  const ok = settled
    .filter((r): r is PromiseFulfilledResult<Weather> => r.status === 'fulfilled')
    .map((r) => r.value)
  if (ok.length === 0) throw new Error('weather: all member lookups failed')
  return ok
}

// --- News (Fox News RSS via /api/news) ---

interface NewsResponse {
  source: string
  items: NewsItem[]
}

export async function fetchNews(topics?: string[], limit = 10): Promise<NewsItem[]> {
  const params = new URLSearchParams()
  if (topics?.length) params.set('topics', topics.join(','))
  params.set('limit', String(limit))
  const data = await getJson<NewsResponse>(`/api/news?${params.toString()}`)
  return data.items
}

// --- Streaming (TMDB via /api/streaming) ---

interface StreamingResponse {
  source: string
  titles: { id: string; title: string; service: string }[]
}

export function mapStreaming(
  titles: StreamingResponse['titles'],
): StreamingTitle[] {
  return titles.map((t) => ({
    id: t.id,
    title: t.title,
    service: t.service,
    ...serviceColors(t.service),
  }))
}

export async function fetchStreaming(): Promise<StreamingTitle[]> {
  const data = await getJson<StreamingResponse>('/api/streaming')
  return mapStreaming(data.titles)
}

// --- Theatrical (TMDB upcoming via /api/theatrical) ---

interface TheatricalResponse {
  source: string
  releases: { id: string; title: string; genre: string; releaseDate: string }[]
}

// ISO "yyyy-mm-dd" -> "Mon D" (e.g. "2026-06-20" -> "Jun 20"). Falls back to the
// raw value if it isn't a parseable date.
export function formatReleaseDate(value: string): string {
  const ms = Date.parse(value)
  if (Number.isNaN(ms)) return value
  return new Date(ms).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

export function mapTheatrical(
  releases: TheatricalResponse['releases'],
): TheatricalRelease[] {
  return releases.map((r) => ({
    id: r.id,
    title: r.title,
    genre: r.genre || 'Upcoming',
    releaseDate: formatReleaseDate(r.releaseDate),
  }))
}

export async function fetchTheatrical(): Promise<TheatricalRelease[]> {
  const data = await getJson<TheatricalResponse>('/api/theatrical')
  return mapTheatrical(data.releases)
}
