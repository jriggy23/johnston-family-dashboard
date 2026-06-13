export interface FamilyMember {
  id: string
  name: string
  initials: string
  color: string
  textColor: string
  location: {
    label: string
    latitude: number
    longitude: number
  }
}

export interface DailyForecast {
  date: string // ISO "YYYY-MM-DD"
  highF: number
  lowF: number
  condition: string
  icon: string
}

export interface PointWeather {
  tempF: number
  highF: number
  lowF: number
  condition: string
  icon: string
  daily?: DailyForecast[]
}

export interface WeatherCardConfig {
  query: string // what the user typed (ZIP or city)
  label: string // resolved display label, e.g. "Austin, TX"
  latitude: number
  longitude: number
}

export interface CalendarEvent {
  id: string
  title: string
  start: string // ISO — raw, so the weekly grid can place it
  end?: string // ISO
  allDay: boolean
  where?: string
  calendar: string // source calendar display name (the member's iCloud calendar)
  calendarId?: string // stable calendar URL, when available
  memberId?: string // resolved family member, when the calendar matches one
  color: string // member color when matched, else the event's own iCloud color
}

// A calendar discovered in the configured iCloud account(s), for mapping a
// member's calendarSource to a real shared-calendar name.
export interface CalendarInfo {
  name: string
  color?: string
  id?: string
  account: string
}

// A family member: their identity, the iCloud calendar their events come from,
// a highlight color (palette-assigned, or derived from their photo), and an
// optional uploaded avatar (stored separately in the settings store).
export interface FamilyCalendarMember {
  id: string // stable calendar key (UUID slug) or fallback slug
  name: string
  initials: string
  calendarSource: string // matches CalendarEvent.calendar (iCloud display name)
  calendarId?: string // stable calendar URL, when discovered
  color: string
  textColor: string
  photoKey?: string // settings key holding the avatar data-URL, e.g. memberPhoto_emma
}

export interface NewsItem {
  id: string
  title: string
  source: string
  ago: string
  link: string
}

export interface StreamingTitle {
  id: string
  title: string
  service: string // primary (first matched) service, kept for back-compat
  services: string[] // all family providers this title streams on (US flatrate)
  serviceColor: string
  serviceTextColor: string
  posterUrl?: string
  mediaType?: 'movie' | 'tv'
}

export interface TheatricalRelease {
  id: string
  title: string
  genre: string
  releaseDate: string
  posterUrl?: string
}

export type StreamingMode = 'popular' | 'new' | 'trending'

// Ratings for the detail view. Each is optional — only the ones we actually
// have are rendered as badges. `tmdb` is always available when the endpoint is
// configured; the rest come from OMDb and only when OMDB_API_KEY is set.
export interface TitleRatings {
  tmdb?: number // 0–10 (one decimal)
  imdb?: string // e.g. "7.5/10"
  rottenTomatoes?: string // e.g. "85%"
  metacritic?: string // e.g. "72/100"
}

// Combined TMDB (+ optional OMDb) detail backing the clickable detail overlay.
export interface TitleDetail {
  id: string // `${mediaType}-${tmdbId}`
  tmdbId: number
  mediaType: 'movie' | 'tv'
  title: string
  overview: string
  posterUrl?: string
  backdropUrl?: string
  releaseDate?: string // ISO yyyy-mm-dd
  year?: string
  runtime?: number // minutes, when known
  genres: string[]
  ratings: TitleRatings
}

// How a clicked card asks for its detail: a known TMDB (type,id) for streaming/
// theatrical items, or a free-text title query for the local now-playing scrape
// (which carries no TMDB id). `fallbackTitle` is shown while loading / on error.
export interface TitleSelector {
  type?: 'movie' | 'tv'
  id?: string
  q?: string
  fallbackTitle?: string
}

export interface ShowDay {
  label: string // "Today" or a weekday e.g. "Sun"
  date: string // e.g. "Jun 14"
  times: string[] // e.g. ["1:00 PM", "4:05 PM"]
}

export interface ShowtimeMovie {
  title: string
  normalized: string
  posterUrl?: string
  days: ShowDay[]
}
