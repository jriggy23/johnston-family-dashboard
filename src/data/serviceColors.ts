// Streaming service → badge palette. The TMDB-backed /api/streaming endpoint
// returns only a service name, so the frontend maps it to colors here.

interface Palette {
  serviceColor: string
  serviceTextColor: string
}

const PALETTES: Record<string, Palette> = {
  Netflix: { serviceColor: '#4a0d0d', serviceTextColor: '#f4b5b5' },
  'Disney+': { serviceColor: '#1c3a5e', serviceTextColor: '#b5d4f4' },
  Max: { serviceColor: '#2f2a6b', serviceTextColor: '#cecbf6' },
  Hulu: { serviceColor: '#10402f', serviceTextColor: '#9fe1cb' },
  Prime: { serviceColor: '#0a3a4a', serviceTextColor: '#a3dcee' },
  'Apple TV+': { serviceColor: '#2a2a2a', serviceTextColor: '#e7e9ee' },
  'Paramount+': { serviceColor: '#13294a', serviceTextColor: '#a9c5f0' },
  Streaming: { serviceColor: '#1f232c', serviceTextColor: '#a6abb6' },
}

const DEFAULT: Palette = { serviceColor: '#1f232c', serviceTextColor: '#a6abb6' }

export function serviceColors(service: string): Palette {
  return PALETTES[service] ?? DEFAULT
}
