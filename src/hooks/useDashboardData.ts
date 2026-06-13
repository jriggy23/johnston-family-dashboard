import { useEffect, useState } from 'react'
import {
  fetchNews,
  fetchStreaming,
  fetchTheatrical,
  fetchWeatherForMembers,
} from '../api/client'
import {
  familyMembers,
  mockNews,
  mockStreaming,
  mockTheatrical,
  mockWeather,
} from '../data/mock'
import type { NewsItem, StreamingTitle, TheatricalRelease, Weather } from '../types'

interface DashboardData {
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
          if (active) setData((prev) => ({ ...prev, [key]: value }))
        })
        .catch(() => {
          /* keep mock fallback */
        })
    }

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
