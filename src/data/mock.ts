import type {
  CalendarEvent,
  FamilyMember,
  NewsItem,
  StreamingTitle,
  TheatricalRelease,
} from '../types'

// Placeholder data used until the live APIs are wired in.
// Family members will eventually come from Table Storage; weather from
// Open-Meteo; news from Fox News RSS; streaming/theatrical from TMDB.

export const familyMembers: FamilyMember[] = [
  {
    id: 'john',
    name: 'John',
    initials: 'JJ',
    color: '#1c3a5e',
    textColor: '#b5d4f4',
    location: { label: 'Austin, TX', latitude: 30.2672, longitude: -97.7431 },
  },
  {
    id: 'sarah',
    name: 'Sarah',
    initials: 'SJ',
    color: '#10402f',
    textColor: '#9fe1cb',
    location: { label: 'Denver, CO', latitude: 39.7392, longitude: -104.9903 },
  },
  {
    id: 'emma',
    name: 'Emma',
    initials: 'EJ',
    color: '#4a1b0c',
    textColor: '#f5c4b3',
    location: { label: 'Boston, MA', latitude: 42.3601, longitude: -71.0589 },
  },
  {
    id: 'max',
    name: 'Max',
    initials: 'MJ',
    color: '#4b1528',
    textColor: '#f4c0d1',
    location: { label: 'Chicago, IL', latitude: 41.8781, longitude: -87.6298 },
  },
]

export const mockEvents: CalendarEvent[] = [
  { id: 'e1', title: "Emma's soccer game", when: 'Today · 4:00 PM', where: 'Riverside Field', color: '#378add' },
  { id: 'e2', title: 'Family dinner', when: 'Today · 7:00 PM', where: 'Home', color: '#1d9e75' },
  { id: 'e3', title: 'Max — dentist', when: 'Tomorrow · 9:30 AM', color: '#d4537e' },
]

export const mockNews: NewsItem[] = [
  { id: 'n1', title: 'Senate passes new infrastructure bill', category: 'Politics', ago: '18m ago', link: '#' },
  { id: 'n2', title: 'Markets rally as tech leads gains', category: 'Business', ago: '1h ago', link: '#' },
  { id: 'n3', title: 'Storm system moves across Midwest', category: 'Weather', ago: '2h ago', link: '#' },
]

export const mockStreaming: StreamingTitle[] = [
  { id: 's1', title: 'The Last Frontier', service: 'Netflix', serviceColor: '#10402f', serviceTextColor: '#9fe1cb' },
  { id: 's2', title: 'Echoes of Tomorrow', service: 'Disney+', serviceColor: '#1c3a5e', serviceTextColor: '#b5d4f4' },
  { id: 's3', title: 'City of Glass', service: 'Max', serviceColor: '#2f2a6b', serviceTextColor: '#cecbf6' },
  { id: 's4', title: 'Northern Lights', service: 'Prime', serviceColor: '#4a1b0c', serviceTextColor: '#f5c4b3' },
]

export const mockTheatrical: TheatricalRelease[] = [
  { id: 't1', title: 'Horizon II', genre: 'Action · Adventure', releaseDate: 'Jun 20' },
  { id: 't2', title: 'The Quiet Hour', genre: 'Thriller', releaseDate: 'Jun 27' },
  { id: 't3', title: 'Paper Moons', genre: 'Family · Animation', releaseDate: 'Jul 3' },
]
