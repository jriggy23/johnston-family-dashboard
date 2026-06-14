// Typed clients for the dashboard's backend (Azure Functions under /api).
//
// Each fetcher throws on a non-OK response so callers can fall back to mock
// data. The pure mapping helpers are exported separately so they can be unit
// tested without the network.

import type {
  CalendarEvent,
  CalendarInfo,
  NewsItem,
  PointWeather,
  ShowtimeMovie,
  StreamingMode,
  StreamingTitle,
  TheatricalRelease,
  WeatherCardConfig,
} from '../types'
import { serviceColors } from '../data/serviceColors'

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { accept: 'application/json' } })
  if (!res.ok) throw new Error(`${url} -> ${res.status}`)
  return (await res.json()) as T
}

// --- Weather (Open-Meteo via /api/weather) ---

export async function fetchWeatherPoint(
  latitude: number,
  longitude: number,
): Promise<PointWeather> {
  return getJson<PointWeather>(`/api/weather?lat=${latitude}&lon=${longitude}`)
}

// --- Geocoding (ZIP or city name via /api/geocode) ---

export async function geocode(query: string): Promise<WeatherCardConfig> {
  const result = await getJson<{ label: string; latitude: number; longitude: number }>(
    `/api/geocode?q=${encodeURIComponent(query)}`,
  )
  return { query, ...result }
}

// --- Shared settings (Azure Table Storage via /api/settings/{key}) ---

export async function getSetting<T>(key: string): Promise<T | null> {
  const data = await getJson<{ key: string; value: T | null }>(`/api/settings/${key}`)
  return data.value
}

export async function putSetting<T>(key: string, value: T): Promise<void> {
  const res = await fetch(`/api/settings/${key}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(value),
  })
  if (!res.ok) throw new Error(`PUT /api/settings/${key} -> ${res.status}`)
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
  titles: {
    id: string
    title: string
    service: string
    services?: string[]
    posterUrl?: string
    mediaType?: 'movie' | 'tv'
  }[]
}

export function mapStreaming(titles: StreamingResponse['titles']): StreamingTitle[] {
  return titles.map((t) => ({
    id: t.id,
    title: t.title,
    service: t.service,
    services: t.services ?? (t.service ? [t.service] : []),
    posterUrl: t.posterUrl,
    mediaType: t.mediaType,
    ...serviceColors(t.service),
  }))
}

export async function fetchStreaming(mode: StreamingMode = 'popular'): Promise<StreamingTitle[]> {
  const data = await getJson<StreamingResponse>(`/api/streaming?mode=${mode}`)
  return mapStreaming(data.titles)
}

// --- Theatrical (TMDB upcoming via /api/theatrical) ---

interface TheatricalResponse {
  source: string
  releases: { id: string; title: string; genre: string; releaseDate: string; posterUrl?: string }[]
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
    posterUrl: r.posterUrl,
  }))
}

export async function fetchTheatrical(): Promise<TheatricalRelease[]> {
  const data = await getJson<TheatricalResponse>('/api/theatrical')
  return mapTheatrical(data.releases)
}

// --- Showtimes (local Epic, scraped via /api/showtimes) ---

interface ShowtimesResponse {
  source: string
  theater: string
  movies: ShowtimeMovie[]
}

export function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export async function fetchShowtimes(): Promise<{ theater: string; movies: ShowtimeMovie[] }> {
  const data = await getJson<ShowtimesResponse>('/api/showtimes')
  return { theater: data.theater, movies: data.movies }
}

// --- Calendar (iCloud via CalDAV through /api/calendar) ---

interface CalendarResponse {
  source: string
  events: {
    id: string
    title: string
    start: string // ISO
    end?: string // ISO
    allDay: boolean
    location?: string
    calendar?: string
    calendarId?: string
    color?: string
  }[]
}

const DEFAULT_EVENT_COLOR = '#378add'

// iCloud returns colors as 8-digit #RRGGBBAA; normalize to #RRGGBB.
function normalizeColor(color?: string): string {
  if (!color) return DEFAULT_EVENT_COLOR
  return /^#[0-9a-f]{8}$/i.test(color) ? color.slice(0, 7) : color
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

// Format an event's start into a viewer-local label like "Today · 4:00 PM",
// "Tomorrow", "Friday · 9:30 AM", or "Jun 20 · 7:00 PM".
export function formatWhen(startISO: string, allDay: boolean, now: Date = new Date()): string {
  const d = new Date(startISO)
  if (Number.isNaN(d.getTime())) return startISO

  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)
  const daysAhead = Math.round((d.getTime() - now.getTime()) / 86400_000)

  let day: string
  if (sameDay(d, now)) day = 'Today'
  else if (sameDay(d, tomorrow)) day = 'Tomorrow'
  else if (daysAhead >= 0 && daysAhead < 7)
    day = d.toLocaleDateString(undefined, { weekday: 'long' })
  else day = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

  if (allDay) return day
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  return `${day} · ${time}`
}

// Map the API response into raw CalendarEvents. Member attribution (memberId +
// member color) is applied separately by the calendar UI once the family roster
// is loaded; here `color` is just the event's own iCloud color as a baseline.
export function mapCalendar(events: CalendarResponse['events']): CalendarEvent[] {
  return events.map((e) => ({
    id: e.id,
    title: e.title,
    start: e.start,
    end: e.end,
    allDay: e.allDay,
    where: e.location,
    calendar: e.calendar ?? '',
    calendarId: e.calendarId,
    color: normalizeColor(e.color),
  }))
}

export async function fetchCalendar(days = 14): Promise<CalendarEvent[]> {
  const data = await getJson<CalendarResponse>(`/api/calendar?days=${days}`)
  return mapCalendar(data.events)
}

// Fetch events within an explicit [start, end) window — used by week navigation
// so past/future weeks return their own events.
export async function fetchCalendarRange(start: Date, end: Date): Promise<CalendarEvent[]> {
  const qs = `start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(
    end.toISOString(),
  )}`
  const data = await getJson<CalendarResponse>(`/api/calendar?${qs}`)
  return mapCalendar(data.events)
}

// --- Calendar discovery (GET /api/calendars) ---

interface CalendarsResponse {
  source: string
  calendars: CalendarInfo[]
}

export async function fetchCalendars(): Promise<CalendarInfo[]> {
  const data = await getJson<CalendarsResponse>('/api/calendars')
  return data.calendars
}

// --- Contact avatar (iCloud Contacts photo via GET /api/calendar-photo) ---

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('blob read failed'))
    reader.readAsDataURL(blob)
  })
}

// Fetch the Contacts photo for a calendar owner (matched server-side by name),
// returned as a data-URL so it can be both rendered and color-sampled. Resolves
// to null when there's no matching contact/photo (404) or on any error, so the
// caller silently falls back to colored initials.
export async function fetchContactPhoto(calendarName: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/calendar-photo?cal=${encodeURIComponent(calendarName)}`, {
      headers: { accept: 'image/*' },
    })
    if (!res.ok) return null
    const blob = await res.blob()
    if (!blob.size) return null
    return await blobToDataUrl(blob)
  } catch {
    return null
  }
}
