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

// A family member: their identity, the iCloud calendar their events come from,
// a highlight color (palette-assigned, or derived from their photo), and an
// optional uploaded avatar (stored separately in the settings store).
export interface FamilyCalendarMember {
  id: string
  name: string
  initials: string
  calendarSource: string // matches CalendarEvent.calendar (iCloud display name)
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
