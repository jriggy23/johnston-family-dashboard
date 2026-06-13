import { useEffect, useState } from 'react'
import {
  fetchCalendar,
  fetchNews,
  fetchStreaming,
  fetchTheatrical,
  fetchWeatherForMembers,
} from '../api/client'
import {
  familyMembers,
  mockEvents,
  mockNews,
  mockStreaming,
  mockTheatrical,
  mockWeather,
} from '../data/mock'
import type {
  CalendarEvent,
  NewsItem,
  StreamingTitle,
  TheatricalRelease,
  Weather,
} from '../types'

interface DashboardData {
  calendar: CalendarEvent[]
  weather: Weather[]
  news: NewsItem[]
  streaming: StreamingTitle[]
  theatrical: TheatricalRelease[]
}

// Each section starts from mock data and is replaced if its live fetch succeeds.
// A failed fetch (e.g. plain `vite dev` with no /api, or a missing TMDB key)
// quietly keeps the mock fallback so the dashboard always renders.
export function useDashboardData(): DashboardData {
  const [data, setData] = useState<DashboardData>({
    calendar: mockEvents,
    weather: mockWeather,
    news: mockNews,
    streaming: mockStreaming,
    theatrical: mockTheatrical,
  })

  useEffect(() => {
    let active = true
    const load = <K extends keyof DashboardData>(
      key: K,
      fetcher: () => Promise<DashboardData[K]>,
    ) => {
      fetcher()
        .then((value) => {
          // Empty result (e.g. unconfigured endpoint) keeps the mock fallback.
          if (active && Array.isArray(value) && value.length > 0) {
            setData((prev) => ({ ...prev, [key]: value }))
          }
        })
        .catch(() => {
          /* keep mock fallback */
        })
    }

    load('calendar', () => fetchCalendar())
    load('weather', () => fetchWeatherForMembers(familyMembers))
    load('news', () => fetchNews())
    load('streaming', fetchStreaming)
    load('theatrical', fetchTheatrical)

    return () => {
      active = false
    }
  }, [])

  return data
}
