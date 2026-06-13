import { useEffect, useState } from 'react'
import { fetchCalendar, fetchNews, fetchTheatrical } from '../api/client'
import { mockEvents, mockNews, mockTheatrical } from '../data/mock'
import type { CalendarEvent, NewsItem, TheatricalRelease } from '../types'

// Each section is either still loading or settled with items. While loading we
// expose NO data (empty items + loading: true) so cards show a loading state
// instead of flashing mock/placeholder content. Mock is used only as a
// fallback once a fetch has actually completed with an error or empty result.
export interface AsyncSection<T> {
  loading: boolean
  items: T[]
}

interface DashboardData {
  calendar: AsyncSection<CalendarEvent>
  news: AsyncSection<NewsItem>
  theatrical: AsyncSection<TheatricalRelease>
}

function pending<T>(): AsyncSection<T> {
  return { loading: true, items: [] }
}

export function useDashboardData(): DashboardData {
  const [data, setData] = useState<DashboardData>({
    calendar: pending(),
    news: pending(),
    theatrical: pending(),
  })

  useEffect(() => {
    let active = true
    const load = <K extends keyof DashboardData>(
      key: K,
      fetcher: () => Promise<DashboardData[K]['items']>,
      fallback: DashboardData[K]['items'],
    ) => {
      fetcher()
        .then((value) => {
          if (!active) return
          // Real data when present; otherwise fall back to mock (e.g. an
          // unconfigured endpoint that returns empty). Only after the fetch
          // settles — never during the pending phase.
          const items = Array.isArray(value) && value.length > 0 ? value : fallback
          setData((prev) => ({ ...prev, [key]: { loading: false, items } }))
        })
        .catch(() => {
          // Genuine failure (e.g. plain `vite dev` with no /api): keep the
          // mock fallback so the dashboard still renders.
          if (active) setData((prev) => ({ ...prev, [key]: { loading: false, items: fallback } }))
        })
    }

    load('calendar', () => fetchCalendar(), mockEvents)
    load('news', () => fetchNews(), mockNews)
    load('theatrical', fetchTheatrical, mockTheatrical)

    return () => {
      active = false
    }
  }, [])

  return data
}
