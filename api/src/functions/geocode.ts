import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'

// Resolve a US ZIP code or a place/city name to coordinates, for the
// configurable weather cards. Both upstream services are free and keyless:
//   - 5-digit ZIP -> Zippopotam.us
//   - otherwise   -> Open-Meteo geocoding (name search)

interface GeoResult {
  label: string
  latitude: number
  longitude: number
}

async function geocodeZip(zip: string): Promise<GeoResult | null> {
  const res = await fetch(`https://api.zippopotam.us/us/${zip}`)
  if (!res.ok) return null // 404 = unknown ZIP
  const data = (await res.json()) as {
    places?: {
      'place name': string
      'state abbreviation': string
      latitude: string
      longitude: string
    }[]
  }
  const place = data.places?.[0]
  if (!place) return null
  return {
    label: `${place['place name']}, ${place['state abbreviation']}`,
    latitude: Number(place.latitude),
    longitude: Number(place.longitude),
  }
}

async function geocodeName(name: string): Promise<GeoResult | null> {
  const url =
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}` +
    `&count=1&language=en&format=json`
  const res = await fetch(url)
  if (!res.ok) return null
  const data = (await res.json()) as {
    results?: {
      name: string
      admin1?: string
      country_code?: string
      latitude: number
      longitude: number
    }[]
  }
  const r = data.results?.[0]
  if (!r) return null
  const region = r.admin1 || r.country_code || ''
  return {
    label: region ? `${r.name}, ${region}` : r.name,
    latitude: r.latitude,
    longitude: r.longitude,
  }
}

export async function geocode(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const q = (request.query.get('q') ?? '').trim()
  if (!q) {
    return { status: 400, jsonBody: { error: 'q query parameter is required' } }
  }

  try {
    const result = /^\d{5}$/.test(q) ? await geocodeZip(q) : await geocodeName(q)
    if (!result || Number.isNaN(result.latitude) || Number.isNaN(result.longitude)) {
      return { status: 404, jsonBody: { error: `no match for "${q}"` } }
    }
    return { jsonBody: result }
  } catch (err) {
    context.error('geocode failed', err)
    return { status: 502, jsonBody: { error: 'geocoding upstream error' } }
  }
}

app.http('geocode', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'geocode',
  handler: geocode,
})
