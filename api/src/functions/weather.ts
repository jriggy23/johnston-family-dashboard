import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'

// Open-Meteo WMO weather codes → label + simple icon key.
function describe(code: number): { condition: string; icon: string } {
  if (code === 0) return { condition: 'Clear', icon: 'sun' }
  if (code <= 2) return { condition: 'Partly cloudy', icon: 'sun' }
  if (code === 3) return { condition: 'Cloudy', icon: 'cloud' }
  if (code <= 49) return { condition: 'Fog', icon: 'cloud' }
  if (code <= 69) return { condition: 'Rain', icon: 'rain' }
  if (code <= 79) return { condition: 'Snow', icon: 'cloud' }
  if (code <= 99) return { condition: 'Storms', icon: 'rain' }
  return { condition: 'Unknown', icon: 'cloud' }
}

export async function weather(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const lat = request.query.get('lat')
  const lon = request.query.get('lon')
  if (!lat || !lon) {
    return { status: 400, jsonBody: { error: 'lat and lon query parameters are required' } }
  }

  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}` +
    `&longitude=${encodeURIComponent(lon)}` +
    `&current=temperature_2m,weather_code` +
    `&daily=temperature_2m_max,temperature_2m_min` +
    `&temperature_unit=fahrenheit&timezone=auto&forecast_days=1`

  try {
    const res = await fetch(url)
    if (!res.ok) {
      context.warn(`Open-Meteo returned ${res.status}`)
      return { status: 502, jsonBody: { error: 'weather upstream error' } }
    }
    const data = (await res.json()) as {
      current: { temperature_2m: number; weather_code: number }
      daily: { temperature_2m_max: number[]; temperature_2m_min: number[] }
    }
    const { condition, icon } = describe(data.current.weather_code)
    return {
      jsonBody: {
        tempF: Math.round(data.current.temperature_2m),
        highF: Math.round(data.daily.temperature_2m_max[0]),
        lowF: Math.round(data.daily.temperature_2m_min[0]),
        condition,
        icon,
      },
    }
  } catch (err) {
    context.error('weather fetch failed', err)
    return { status: 502, jsonBody: { error: 'weather upstream error' } }
  }
}

app.http('weather', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'weather',
  handler: weather,
})
