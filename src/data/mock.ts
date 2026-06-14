import type {
  CalendarEvent,
  NewsItem,
  StreamingTitle,
  TheatricalRelease,
  TitleDetail,
  TitleSelector,
} from '../types'

// Placeholder data used until the live APIs are wired in. The family roster now
// lives in data/members.ts (configurable via the familyMembers setting); weather
// from Open-Meteo; news from Fox News RSS; streaming/theatrical from TMDB.

// Build sample events anchored to the current week so the weekly grid always
// has something to show. `dow` is 0=Sun..6=Sat. The `calendar` source matches
// the default family roster (see data/members.ts); "Family" is intentionally
// unmatched to exercise the iCloud-color fallback. Member colors are applied by
// the calendar UI at render time, so `color` here is only a baseline.
function weekISO(dow: number, hour: number, minute = 0): string {
  const now = new Date()
  const d = new Date(now)
  d.setDate(now.getDate() - now.getDay() + dow)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

export const mockEvents: CalendarEvent[] = [
  { id: 'e1', title: '1:1 with manager', start: weekISO(1, 10, 0), end: weekISO(1, 10, 30), allDay: false, calendar: 'John', color: '#378add' },
  { id: 'e2', title: 'Yoga', start: weekISO(2, 7, 0), end: weekISO(2, 8, 0), allDay: false, where: 'Studio B', calendar: 'Sarah', color: '#1d9e75' },
  { id: 'e3', title: "Emma's soccer game", start: weekISO(3, 16, 0), end: weekISO(3, 17, 30), allDay: false, where: 'Riverside Field', calendar: 'Emma', color: '#d98a3d' },
  { id: 'e4', title: 'Family dinner', start: weekISO(3, 19, 0), end: weekISO(3, 20, 30), allDay: false, where: 'Home', calendar: 'Family', color: '#1d9e75' },
  { id: 'e5', title: 'Max — dentist', start: weekISO(4, 9, 30), end: weekISO(4, 10, 15), allDay: false, calendar: 'Max', color: '#d4537e' },
  { id: 'e6', title: 'Book club', start: weekISO(4, 18, 30), end: weekISO(4, 20, 0), allDay: false, calendar: 'Sarah', color: '#1d9e75' },
  { id: 'e7', title: 'John flight DEN → BOS', start: weekISO(5, 0, 0), allDay: true, where: 'DEN → BOS', calendar: 'John', color: '#378add' },
  { id: 'e8', title: 'Piano recital', start: weekISO(6, 17, 30), end: weekISO(6, 19, 0), allDay: false, where: 'Community Hall', calendar: 'Emma', color: '#d98a3d' },
]

export const mockNews: NewsItem[] = [
  { id: 'n1', title: 'Senate passes new infrastructure bill', source: 'NPR', ago: '18m ago', link: '#' },
  { id: 'n2', title: 'Markets rally as tech leads gains', source: 'BBC', ago: '1h ago', link: '#' },
  { id: 'n3', title: 'Storm system moves across Midwest', source: 'CBS News', ago: '2h ago', link: '#' },
]

export const mockStreaming: StreamingTitle[] = [
  { id: 's1', title: 'The Last Frontier', service: 'Netflix', services: ['Netflix'], serviceColor: '#10402f', serviceTextColor: '#9fe1cb' },
  { id: 's2', title: 'Echoes of Tomorrow', service: 'Disney+', services: ['Disney+', 'Hulu'], serviceColor: '#1c3a5e', serviceTextColor: '#b5d4f4' },
  { id: 's3', title: 'City of Glass', service: 'Max', services: ['Max'], serviceColor: '#2f2a6b', serviceTextColor: '#cecbf6' },
  { id: 's4', title: 'Northern Lights', service: 'Prime', services: ['Prime', 'Paramount+'], serviceColor: '#4a1b0c', serviceTextColor: '#f5c4b3' },
]

export const mockTheatrical: TheatricalRelease[] = [
  { id: 't1', title: 'Horizon II', genre: 'Action · Adventure', releaseDate: 'Jun 20' },
  { id: 't2', title: 'The Quiet Hour', genre: 'Thriller', releaseDate: 'Jun 27' },
  { id: 't3', title: 'Paper Moons', genre: 'Family · Animation', releaseDate: 'Jul 3' },
]

// Placeholder detail so the clickable detail overlay works in dev (plain `vite
// dev` with no /api) or when TMDB is unconfigured. Keyed loosely off whatever
// title/selector was clicked so the overlay shows something sensible.
export function mockTitleDetail(selector: TitleSelector): TitleDetail {
  const title = selector.fallbackTitle ?? selector.q ?? 'Sample Title'
  return {
    id: `${selector.type ?? 'movie'}-0`,
    tmdbId: 0,
    mediaType: selector.type ?? 'movie',
    title,
    overview:
      'Detailed descriptions appear here once the TMDB key is configured. This is sample placeholder text so the detail view renders during local development.',
    posterUrl: undefined,
    backdropUrl: undefined,
    releaseDate: '2026-06-20',
    year: '2026',
    runtime: 118,
    genres: ['Drama', 'Adventure'],
    ratings: { tmdb: 7.8, imdb: '7.5/10', rottenTomatoes: '85%', metacritic: '72/100' },
  }
}
