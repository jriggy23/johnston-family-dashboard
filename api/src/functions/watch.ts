import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'

// Streaming + upcoming theatrical, backed by TMDB (free, non-commercial).
// Auth: set TMDB_ACCESS_TOKEN (v4 read token, preferred) or TMDB_API_KEY (v3).
// Until a key is configured both endpoints report `unconfigured` and the
// frontend falls back to mock data.

const TMDB = 'https://api.themoviedb.org/3'
const IMG = 'https://image.tmdb.org/t/p/w342'
const REGION = 'US'

// Family's streaming services -> TMDB watch-provider IDs (US). Overridable via
// the STREAMING_PROVIDERS app setting (comma-separated IDs).
const PROVIDER_NAMES: Record<number, string> = {
  8: 'Netflix',
  337: 'Disney+',
  1899: 'Max',
  9: 'Prime',
  531: 'Paramount+',
  15: 'Hulu',
  350: 'Apple TV+',
}

function familyProviders(): number[] {
  const override = process.env.STREAMING_PROVIDERS
  if (override) {
    const ids = override.split(',').map((s) => Number(s.trim())).filter((n) => !Number.isNaN(n))
    if (ids.length) return ids
  }
  return Object.keys(PROVIDER_NAMES).map(Number)
}

function hasKey(): boolean {
  return !!(process.env.TMDB_ACCESS_TOKEN || process.env.TMDB_API_KEY)
}

async function tmdb<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
  const url = new URL(TMDB + path)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v))
  const headers: Record<string, string> = { accept: 'application/json' }
  const v4 = process.env.TMDB_ACCESS_TOKEN
  if (v4) headers.authorization = `Bearer ${v4}`
  else url.searchParams.set('api_key', process.env.TMDB_API_KEY ?? '')
  const res = await fetch(url, { headers })
  if (!res.ok) throw new Error(`TMDB ${path} -> ${res.status}`)
  return (await res.json()) as T
}

// --- genre id -> name (cached for the lifetime of the function instance) ---
let genreCache: Record<number, string> | null = null
async function genreMap(): Promise<Record<number, string>> {
  if (genreCache) return genreCache
  const [mv, tv] = await Promise.all([
    tmdb<{ genres: { id: number; name: string }[] }>('/genre/movie/list', { language: 'en-US' }),
    tmdb<{ genres: { id: number; name: string }[] }>('/genre/tv/list', { language: 'en-US' }),
  ])
  const map: Record<number, string> = {}
  for (const g of [...mv.genres, ...tv.genres]) map[g.id] = g.name
  genreCache = map
  return map
}

function posterUrl(path: string | null): string | undefined {
  return path ? `${IMG}${path}` : undefined
}

// --- Streaming ---------------------------------------------------------------

interface DiscoverItem {
  id: number
  title?: string
  name?: string
  poster_path: string | null
  popularity?: number
  release_date?: string
  first_air_date?: string
}

interface WatchTitle {
  id: string
  title: string
  service: string
  posterUrl?: string
  mediaType: 'movie' | 'tv'
}

// Which of the family's services carries this title (first match), for the badge.
async function serviceFor(type: 'movie' | 'tv', id: number, family: Set<number>): Promise<string> {
  try {
    const data = await tmdb<{ results: Record<string, { flatrate?: { provider_id: number }[] }> }>(
      `/${type}/${id}/watch/providers`,
    )
    const flat = data.results?.[REGION]?.flatrate ?? []
    const hit = flat.find((p) => family.has(p.provider_id))
    return hit ? (PROVIDER_NAMES[hit.provider_id] ?? 'Streaming') : 'Streaming'
  } catch {
    return 'Streaming'
  }
}

export async function streaming(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  if (!hasKey()) return { jsonBody: { source: 'unconfigured', titles: [] } }

  const mode = (request.query.get('mode') ?? 'popular').toLowerCase()
  const ids = familyProviders()
  const family = new Set(ids)
  const providerParam = ids.join('|')

  try {
    let raw: { item: DiscoverItem; type: 'movie' | 'tv' }[]

    if (mode === 'trending') {
      const data = await tmdb<{ results: (DiscoverItem & { media_type: string })[] }>(
        '/trending/all/week',
        { language: 'en-US' },
      )
      raw = data.results
        .filter((r) => r.media_type === 'movie' || r.media_type === 'tv')
        .map((r) => ({ item: r, type: r.media_type as 'movie' | 'tv' }))
    } else {
      const newMode = mode === 'new'
      const today = new Date().toISOString().slice(0, 10)
      const floor = new Date(Date.now() - 120 * 86400_000).toISOString().slice(0, 10)
      const movieParams: Record<string, string> = {
        language: 'en-US',
        watch_region: REGION,
        with_watch_providers: providerParam,
        with_watch_monetization_types: 'flatrate',
        sort_by: newMode ? 'primary_release_date.desc' : 'popularity.desc',
        page: '1',
      }
      const tvParams: Record<string, string> = { ...movieParams, sort_by: newMode ? 'first_air_date.desc' : 'popularity.desc' }
      if (newMode) {
        movieParams['primary_release_date.gte'] = floor
        movieParams['primary_release_date.lte'] = today
        tvParams['first_air_date.gte'] = floor
        tvParams['first_air_date.lte'] = today
      }
      const [mv, tv] = await Promise.all([
        tmdb<{ results: DiscoverItem[] }>('/discover/movie', movieParams),
        tmdb<{ results: DiscoverItem[] }>('/discover/tv', tvParams),
      ])
      raw = [
        ...mv.results.slice(0, 8).map((item) => ({ item, type: 'movie' as const })),
        ...tv.results.slice(0, 8).map((item) => ({ item, type: 'tv' as const })),
      ]
    }

    // Interleave/sort and cap, then resolve the service badge per title.
    const top = raw
      .filter((r) => r.item.poster_path)
      .sort((a, b) => (b.item.popularity ?? 0) - (a.item.popularity ?? 0))
      .slice(0, 12)

    const titles: WatchTitle[] = await Promise.all(
      top.map(async ({ item, type }) => ({
        id: `${type}-${item.id}`,
        title: item.title ?? item.name ?? 'Untitled',
        service: await serviceFor(type, item.id, family),
        posterUrl: posterUrl(item.poster_path),
        mediaType: type,
      })),
    )

    return { jsonBody: { source: 'tmdb', mode, titles } }
  } catch (err) {
    context.error('streaming fetch failed', err)
    return { jsonBody: { source: 'unconfigured', titles: [] } }
  }
}

// --- Theatrical --------------------------------------------------------------

export async function theatrical(
  _request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  if (!hasKey()) return { jsonBody: { source: 'unconfigured', releases: [] } }

  try {
    const today = new Date().toISOString().slice(0, 10)
    const [data, genres] = await Promise.all([
      tmdb<{
        results: { id: number; title: string; release_date: string; genre_ids: number[]; poster_path: string | null }[]
      }>('/discover/movie', {
        region: REGION,
        language: 'en-US',
        sort_by: 'popularity.desc',
        with_release_type: '3|2', // theatrical (wide/limited)
        'primary_release_date.gte': today,
        page: '1',
      }),
      genreMap(),
    ])

    const releases = data.results
      .filter((r) => r.release_date && r.release_date >= today)
      .slice(0, 10)
      .map((r) => ({
        id: String(r.id),
        title: r.title,
        genre: (r.genre_ids ?? []).slice(0, 2).map((g) => genres[g]).filter(Boolean).join(' · ') || 'Upcoming',
        releaseDate: r.release_date,
        posterUrl: posterUrl(r.poster_path),
      }))
      .sort((a, b) => a.releaseDate.localeCompare(b.releaseDate))

    return { jsonBody: { source: 'tmdb', releases } }
  } catch (err) {
    context.error('theatrical fetch failed', err)
    return { jsonBody: { source: 'unconfigured', releases: [] } }
  }
}

app.http('streaming', { methods: ['GET'], authLevel: 'anonymous', route: 'streaming', handler: streaming })
app.http('theatrical', { methods: ['GET'], authLevel: 'anonymous', route: 'theatrical', handler: theatrical })
