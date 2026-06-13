import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  fetchWeatherForMembers,
  formatReleaseDate,
  formatWhen,
  mapCalendar,
  mapStreaming,
  mapTheatrical,
} from './client'
import type { FamilyMember } from '../types'

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
  const now = new Date(2026, 5, 13, 9, 0, 0)

  it('maps location to where and applies a default color when missing', () => {
    const events = mapCalendar(
      [
        { id: '1', title: 'Soccer', start: new Date(2026, 5, 13, 16, 0).toISOString(), allDay: false, location: 'Field', color: '#abcdef' },
        { id: '2', title: 'Holiday', start: new Date(2026, 5, 13, 0, 0).toISOString(), allDay: true },
      ],
      now,
    )
    expect(events[0]).toMatchObject({ id: '1', title: 'Soccer', where: 'Field', color: '#abcdef' })
    expect(events[1].where).toBeUndefined()
    expect(events[1].color).toBe('#378add') // fallback
  })
})

describe('fetchWeatherForMembers', () => {
  const members: FamilyMember[] = [
    {
      id: 'a',
      name: 'A',
      initials: 'A',
      color: '#000',
      textColor: '#fff',
      location: { label: 'Austin', latitude: 30.27, longitude: -97.74 },
    },
    {
      id: 'b',
      name: 'B',
      initials: 'B',
      color: '#000',
      textColor: '#fff',
      location: { label: 'Denver', latitude: 39.74, longitude: -104.99 },
    },
  ]

  it('attaches memberId and keeps members whose lookup succeeds', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url.includes('lat=30.27')) {
          return new Response(
            JSON.stringify({ tempF: 94, highF: 96, lowF: 74, condition: 'Clear', icon: 'sun' }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          )
        }
        return new Response('upstream error', { status: 502 })
      }),
    )

    const weather = await fetchWeatherForMembers(members)
    expect(weather).toHaveLength(1)
    expect(weather[0]).toMatchObject({ memberId: 'a', tempF: 94, condition: 'Clear' })
  })

  it('throws when every member lookup fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('error', { status: 502 })),
    )
    await expect(fetchWeatherForMembers(members)).rejects.toThrow()
  })
})
