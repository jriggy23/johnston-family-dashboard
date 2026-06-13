import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  fetchWeatherPoint,
  formatReleaseDate,
  formatWhen,
  geocode,
  getSetting,
  mapCalendar,
  mapStreaming,
  mapTheatrical,
  titleDetailUrl,
} from './client'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('mapStreaming', () => {
  it('attaches a known service palette', () => {
    const [t] = mapStreaming([{ id: '1', title: 'X', service: 'Disney+' }])
    expect(t).toMatchObject({ id: '1', title: 'X', service: 'Disney+' })
    expect(t.serviceColor).toBe('#1c3a5e')
    expect(t.serviceTextColor).toBe('#b5d4f4')
  })

  it('falls back to a default palette for unknown services', () => {
    const [t] = mapStreaming([{ id: '2', title: 'Y', service: 'TMDB' }])
    expect(t.serviceColor).toBe('#1f232c')
    expect(t.serviceTextColor).toBe('#a6abb6')
  })
})

describe('formatReleaseDate', () => {
  it('formats an ISO date to "Mon D"', () => {
    expect(formatReleaseDate('2026-06-20')).toBe('Jun 20')
  })

  it('returns the raw value when unparseable', () => {
    expect(formatReleaseDate('coming soon')).toBe('coming soon')
  })
})

describe('mapTheatrical', () => {
  it('formats the date and defaults an empty genre', () => {
    const [r] = mapTheatrical([
      { id: 't1', title: 'Movie', genre: '', releaseDate: '2026-07-03' },
    ])
    expect(r).toEqual({
      id: 't1',
      title: 'Movie',
      genre: 'Upcoming',
      releaseDate: 'Jul 3',
    })
  })
})

describe('formatWhen', () => {
  const now = new Date(2026, 5, 13, 9, 0, 0) // Sat Jun 13 2026, 09:00 local

  it('labels an all-day event today as "Today" with no time', () => {
    const start = new Date(2026, 5, 13, 0, 0, 0).toISOString()
    expect(formatWhen(start, true, now)).toBe('Today')
  })

  it('labels a timed event tomorrow as "Tomorrow · <time>"', () => {
    const start = new Date(2026, 5, 14, 14, 30, 0).toISOString()
    expect(formatWhen(start, false, now)).toMatch(/^Tomorrow · /)
  })

  it('labels a far-off event with a short date', () => {
    const start = new Date(2026, 5, 23, 19, 0, 0).toISOString()
    expect(formatWhen(start, false, now)).toMatch(/^Jun 23 · /)
  })

  it('returns the raw value when unparseable', () => {
    expect(formatWhen('not a date', false, now)).toBe('not a date')
  })
})

describe('mapCalendar', () => {
  it('carries raw fields, maps location to where, and applies a default color when missing', () => {
    const events = mapCalendar([
      {
        id: '1',
        title: 'Soccer',
        start: '2026-06-13T16:00:00.000Z',
        end: '2026-06-13T17:00:00.000Z',
        allDay: false,
        location: 'Field',
        calendar: 'Emma',
        color: '#abcdef',
      },
      { id: '2', title: 'Holiday', start: '2026-06-13T00:00:00.000Z', allDay: true },
    ])
    expect(events[0]).toMatchObject({
      id: '1',
      title: 'Soccer',
      start: '2026-06-13T16:00:00.000Z',
      allDay: false,
      where: 'Field',
      calendar: 'Emma',
      color: '#abcdef',
    })
    expect(events[1].where).toBeUndefined()
    expect(events[1].calendar).toBe('') // unset source → empty (unmatched)
    expect(events[1].color).toBe('#378add') // fallback color
  })
})

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('fetchWeatherPoint', () => {
  it('requests the given coordinates and returns the point weather', async () => {
    const fetchMock = vi.fn<(url: RequestInfo | URL) => Promise<Response>>(async () =>
      jsonResponse({ tempF: 72, highF: 80, lowF: 60, condition: 'Clear', icon: 'sun' }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const w = await fetchWeatherPoint(30.27, -97.74)
    expect(w).toMatchObject({ tempF: 72, condition: 'Clear' })
    const url = String(fetchMock.mock.calls[0][0])
    expect(url).toContain('lat=30.27')
    expect(url).toContain('lon=-97.74')
  })
})

describe('geocode', () => {
  it('echoes the query alongside the resolved location', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ label: 'Austin, TX', latitude: 30.27, longitude: -97.74 })),
    )
    const result = await geocode('78701')
    expect(result).toEqual({ query: '78701', label: 'Austin, TX', latitude: 30.27, longitude: -97.74 })
  })

  it('throws when the location is not found', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('not found', { status: 404 })))
    await expect(geocode('zzzzz')).rejects.toThrow()
  })
})

describe('titleDetailUrl', () => {
  it('uses type+id when both are present', () => {
    expect(titleDetailUrl({ type: 'movie', id: '123', fallbackTitle: 'X' })).toBe(
      '/api/title?type=movie&id=123',
    )
  })

  it('falls back to a title query when no id is given', () => {
    expect(titleDetailUrl({ q: 'The Quiet Hour' })).toBe('/api/title?q=The+Quiet+Hour')
  })
})

describe('getSetting', () => {
  it('returns the stored value', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ key: 'weatherCards', value: [{ label: 'Austin, TX' }] })),
    )
    const value = await getSetting<{ label: string }[]>('weatherCards')
    expect(value).toEqual([{ label: 'Austin, TX' }])
  })

  it('returns null when the key is unset', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ key: 'weatherCards', value: null })))
    expect(await getSetting('weatherCards')).toBeNull()
  })
})
