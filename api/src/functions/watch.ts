import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'

// Streaming + upcoming theatrical releases, backed by TMDB.
// TMDB is free for non-commercial use but requires an API key (TMDB_API_KEY).
// Until the key is configured, both endpoints return mock data so the UI works.

const TMDB_BASE = 'https://api.themoviedb.org/3'

const MOCK_STREAMING = [
  { id: 's1', title: 'The Last Frontier', service: 'Netflix' },
  { id: 's2', title: 'Echoes of Tomorrow', service: 'Disney+' },
  { id: 's3', title: 'City of Glass', service: 'Max' },
  { id: 's4', title: 'Northern Lights', service: 'Prime' },
]

const MOCK_THEATRICAL = [
  { id: 't1', title: 'Horizon II', genre: 'Action · Adventure', releaseDate: '2026-06-20' },
  { id: 't2', title: 'The Quiet Hour', genre: 'Thriller', releaseDate: '2026-06-27' },
  { id: 't3', title: 'Paper Moons', genre: 'Family · Animation', releaseDate: '2026-07-03' },
]

async function tmdb(path: string, key: string): Promise<unknown> {
  const sep = path.includes('?') ? '&' : '?'
  const res = await fetch(`${TMDB_BASE}${path}${sep}api_key=${key}`)
  if (!res.ok) throw new Error(`TMDB ${res.status}`)
  return res.json()
}

export async function streaming(
  _request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const key = process.env.TMDB_API_KEY
  if (!key) {
    return { jsonBody: { source: 'mock', titles: MOCK_STREAMING } }
  }
  try {
    const data = (await tmdb('/trending/all/week?language=en-US', key)) as {
      results: { id: number; title?: string; name?: string }[]
    }
    const titles = data.results.slice(0, 8).map((r) => ({
      id: String(r.id),
      title: r.title ?? r.name ?? 'Untitled',
      service: 'TMDB',
    }))
    return { jsonBody: { source: 'tmdb', titles } }
  } catch (err) {
    context.error('streaming fetch failed', err)
    return { jsonBody: { source: 'mock', titles: MOCK_STREAMING } }
  }
}

export async function theatrical(
  _request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const key = process.env.TMDB_API_KEY
  if (!key) {
    return { jsonBody: { source: 'mock', releases: MOCK_THEATRICAL } }
  }
  try {
    const data = (await tmdb('/movie/upcoming?language=en-US&page=1', key)) as {
      results: { id: number; title: string; release_date: string }[]
    }
    const releases = data.results.slice(0, 8).map((r) => ({
      id: String(r.id),
      title: r.title,
      genre: '',
      releaseDate: r.release_date,
    }))
    return { jsonBody: { source: 'tmdb', releases } }
  } catch (err) {
    context.error('theatrical fetch failed', err)
    return { jsonBody: { source: 'mock', releases: MOCK_THEATRICAL } }
  }
}

app.http('streaming', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'streaming',
  handler: streaming,
})

app.http('theatrical', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'theatrical',
  handler: theatrical,
})
