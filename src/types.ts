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

export interface PointWeather {
  tempF: number
  highF: number
  lowF: number
  condition: string
  icon: string
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
  when: string
  where?: string
  color: string
}

export interface NewsItem {
  id: string
  title: string
  category: string
  ago: string
  link: string
}

export interface StreamingTitle {
  id: string
  title: string
  service: string
  serviceColor: string
  serviceTextColor: string
}

export interface TheatricalRelease {
  id: string
  title: string
  genre: string
  releaseDate: string
}
