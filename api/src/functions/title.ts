import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'

// Title detail: combined TMDB details + (optionally) OMDb ratings, backing the
// clickable detail view in the dashboard's Streaming / Theatrical / Now-playing
// sections.
//
// Auth: reuses the same TMDB credentials as watch.ts — set TMDB_ACCESS_TOKEN
// (v4 read token, preferred) or TMDB_API_KEY (v3). Until a key is configured the
// endpoint reports `unconfigured` and the frontend falls back to mock detail.
//
// Ratings: the TMDB rating (vote_average) is always included. Rotten Tomatoes,
// IMDb and Metacritic are added via the OMDb API — but ONLY when the app setting
// OMDB_API_KEY is configured. If it's absent (or OMDb errors), those are simply
// omitted; the detail view still renders with the TMDB rating alone.

const TMDB = 'https://api.themoviedb.org/3'
const POSTER = 'https://image.tmdb.org/t/p/w342'
const BACKDROP = 'https://image.tmdb.org/t/p/w780'
const OMDB = 'https://www.omdbapi.com/'

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

// --- Types -------------------------------------------------------------------

type MediaType = 'movie' | 'tv'

interface TmdbDetails {
  id: number
  title?: string // movie
  name?: string // tv
  overview?: string
  poster_path: string | null
  backdrop_path: string | null
  release_date?: string // movie
  first_air_date?: string // tv
  runtime?: number // movie (minutes)
  episode_run_time?: number[] // tv
  genres?: { id: number; name: string }[]
  vote_average?: number
  vote_count?: number
  external_ids?: { imdb_id?: string | null }
}

// Ratings that are present get included; missing ones are omitted entirely so
// the UI only renders the badges it actually has.
export interface TitleRatings {
  tmdb?: number // 0–10 (one decimal)
  imdb?: string // e.g. "7.5/10"
  rottenTomatoes?: string // e.g. "85%"
  metacritic?: string // e.g. "72/100"
}

export interface TitleDetail {
  id: string // `${type}-${tmdbId}`
  tmdbId: number
  mediaType: MediaType
  title: string
  overview: string
  posterUrl?: string
  backdropUrl?: string
  releaseDate?: string // ISO yyyy-mm-dd
  year?: string
  runtime?: number // minutes, when known
  genres: string[]
  ratings: TitleRatings
}

// --- OMDb mapping (pure, exported for testing) -------------------------------

interface OmdbResponse {
  Response?: string
  imdbRating?: string // "7.5" or "N/A"
  Metascore?: string // "72" or "N/A"
  Ratings?: { Source: string; Value: string }[]
}

const isNum = (v: string | undefined): boolean => !!v && v !== 'N/A' && !Number.isNaN(Number(v))

// Translate an OMDb payload into our compact ratings shape. Anything missing or
// "N/A" is dropped. Exported so it can be unit-tested without the network.
export function mapOmdbRatings(omdb: OmdbResponse): Pick<TitleRatings, 'imdb' | 'rottenTomatoes' | 'metacritic'> {
  const out: Pick<TitleRatings, 'imdb' | 'rottenTomatoes' | 'metacritic'> = {}
  if (isNum(omdb.imdbRating)) out.imdb = `${omdb.imdbRating}/10`
  if (isNum(omdb.Metascore)) out.metacritic = `${omdb.Metascore}/100`
  const rt = omdb.Ratings?.find((r) => r.Source === 'Rotten Tomatoes')
  if (rt?.Value && rt.Value !== 'N/A') out.rottenTomatoes = rt.Value
  return out
}

async function omdbRatings(imdbId: string | null | undefined): Promise<Partial<TitleRatings>> {
  const key = process.env.OMDB_API_KEY
  if (!key || !imdbId) return {}
  try {
    const url = new URL(OMDB)
    url.searchParams.set('apikey', key)
    url.searchParams.set('i', imdbId)
    const res = await fetch(url)
    if (!res.ok) return {}
    const data = (await res.json()) as OmdbResponse
    if (data.Response === 'False') return {}
    return mapOmdbRatings(data)
  } catch {
    return {}
  }
}

// --- Detail assembly ---------------------------------------------------------

function toDetail(type: MediaType, d: TmdbDetails): TitleDetail {
  const releaseDate = type === 'movie' ? d.release_date : d.first_air_date
  const runtime = type === 'movie' ? d.runtime : d.episode_run_time?.[0]
  const ratings: TitleRatings = {}
  if (typeof d.vote_average === 'number' && d.vote_count && d.vote_count > 0) {
    ratings.tmdb = Math.round(d.vote_average * 10) / 10
  }
  return {
    id: `${type}-${d.id}`,
    tmdbId: d.id,
    mediaType: type,
    title: d.title ?? d.name ?? 'Untitled',
    overview: d.overview ?? '',
    posterUrl: d.poster_path ? `${POSTER}${d.poster_path}` : undefined,
    backdropUrl: d.backdrop_path ? `${BACKDROP}${d.backdrop_path}` : undefined,
    releaseDate: releaseDate || undefined,
    year: releaseDate ? releaseDate.slice(0, 4) : undefined,
    runtime: runtime && runtime > 0 ? runtime : undefined,
    genres: (d.genres ?? []).map((g) => g.name).filter(Boolean),
    ratings,
  }
}

// Resolve a free-text title to a TMDB (type,id) via search. Used for the local
// "now playing" scrape, whose items carry no TMDB id. Movies first (theaters
// show movies), then a multi search as a backstop.
async function resolveByQuery(q: string): Promise<{ type: MediaType; id: number } | null> {
  try {
    const movie = await tmdb<{ results: { id: number }[] }>('/search/movie', {
      query: q,
      language: 'en-US',
      include_adult: 'false',
      page: '1',
    })
    if (movie.results?.[0]) return { type: 'movie', id: movie.results[0].id }
  } catch {
    /* fall through to multi */
  }
  try {
    const multi = await tmdb<{ results: { id: number; media_type: string }[] }>('/search/multi', {
      query: q,
      language: 'en-US',
      include_adult: 'false',
      page: '1',
    })
    const hit = multi.results?.find((r) => r.media_type === 'movie' || r.media_type === 'tv')
    if (hit) return { type: hit.media_type as MediaType, id: hit.id }
  } catch {
    /* give up */
  }
  return null
}

// --- Cache (per function instance) -------------------------------------------

const CACHE_TTL_MS = 6 * 60 * 60 * 1000 // 6h — details rarely change
const cache = new Map<string, { expires: number; detail: TitleDetail }>()

function cacheGet(key: string): TitleDetail | null {
  const hit = cache.get(key)
  if (hit && hit.expires > Date.now()) return hit.detail
  if (hit) cache.delete(key)
  return null
}

// --- Handler -----------------------------------------------------------------

export async function title(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  if (!hasKey()) return { jsonBody: { source: 'unconfigured', detail: null } }

  const rawType = (request.query.get('type') ?? '').toLowerCase()
  const id = request.query.get('id')
  const q = request.query.get('q')

  let type: MediaType | null = rawType === 'movie' || rawType === 'tv' ? rawType : null
  let tmdbId: number | null = id && /^\d+$/.test(id) ? Number(id) : null

  try {
    // Resolve a title-only request (local now-playing) into a (type,id).
    if ((!type || tmdbId === null) && q) {
      const resolved = await resolveByQuery(q)
      if (!resolved) return { status: 404, jsonBody: { error: 'no match for query' } }
      type = resolved.type
      tmdbId = resolved.id
    }

    if (!type || tmdbId === null) {
      return { status: 400, jsonBody: { error: 'provide type+id or q' } }
    }

    const cacheKey = `${type}-${tmdbId}`
    const cached = cacheGet(cacheKey)
    if (cached) return { jsonBody: { source: 'tmdb', detail: cached } }

    const details = await tmdb<TmdbDetails>(`/${type}/${tmdbId}`, {
      language: 'en-US',
      append_to_response: 'external_ids',
    })

    const detail = toDetail(type, details)
    const extra = await omdbRatings(details.external_ids?.imdb_id)
    detail.ratings = { ...detail.ratings, ...extra }

    cache.set(cacheKey, { expires: Date.now() + CACHE_TTL_MS, detail })
    return { jsonBody: { source: 'tmdb', detail } }
  } catch (err) {
    context.error('title detail fetch failed', err)
    return { status: 502, jsonBody: { error: 'title detail upstream error' } }
  }
}

app.http('title', { methods: ['GET'], authLevel: 'anonymous', route: 'title', handler: title })
