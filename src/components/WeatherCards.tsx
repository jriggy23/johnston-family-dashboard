import { useEffect, useState } from 'react'
import { fetchWeatherPoint, geocode, getSetting, putSetting } from '../api/client'
import type { PointWeather, WeatherCardConfig } from '../types'

const SETTING_KEY = 'weatherCards'
const CARD_COUNT = 2

type Slot = WeatherCardConfig | null
type WeatherState = PointWeather | 'loading' | 'error' | undefined

function WeatherIcon({ icon, size = 28 }: { icon: string; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true }
  if (icon === 'rain') {
    return (
      <svg {...common} stroke="#85b7eb" strokeWidth="1.6" strokeLinecap="round">
        <path d="M7 15a4 4 0 0 1 0-8 5 5 0 0 1 9.6 1.5A3.5 3.5 0 0 1 16 15z" />
        <path d="M9 19l-1 2M13 19l-1 2M17 19l-1 2" />
      </svg>
    )
  }
  if (icon === 'cloud') {
    return (
      <svg {...common} stroke="#a6abb6" strokeWidth="1.6" strokeLinecap="round">
        <path d="M7 18a4 4 0 0 1 0-8 5 5 0 0 1 9.6 1.5A3.5 3.5 0 0 1 16 18z" />
      </svg>
    )
  }
  return (
    <svg {...common} stroke="#efa033" strokeWidth="1.6" strokeLinecap="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4" />
    </svg>
  )
}

function emptySlots(): Slot[] {
  return Array.from({ length: CARD_COUNT }, () => null)
}

// Parse "YYYY-MM-DD" as a local date and label it (index 0 = today).
function dayLabel(dateStr: string, index: number): string {
  if (index === 0) return 'Today'
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, (m ?? 1) - 1, d ?? 1)
  return date.toLocaleDateString(undefined, { weekday: 'short' })
}

export default function WeatherCards() {
  const [slots, setSlots] = useState<Slot[]>(emptySlots)
  const [weather, setWeather] = useState<Record<number, WeatherState>>({})
  const [editing, setEditing] = useState<number | null>(null)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function loadWeatherFor(index: number, cfg: WeatherCardConfig) {
    setWeather((w) => ({ ...w, [index]: 'loading' }))
    fetchWeatherPoint(cfg.latitude, cfg.longitude)
      .then((data) => setWeather((w) => ({ ...w, [index]: data })))
      .catch(() => setWeather((w) => ({ ...w, [index]: 'error' })))
  }

  // Load saved config once, then fetch weather for configured slots.
  useEffect(() => {
    let active = true
    getSetting<Slot[]>(SETTING_KEY)
      .then((saved) => {
        if (!active || !Array.isArray(saved)) return
        const next = emptySlots().map((_, i) => saved[i] ?? null)
        setSlots(next)
        next.forEach((cfg, i) => cfg && loadWeatherFor(i, cfg))
      })
      .catch(() => {
        /* no saved config / store unavailable — keep empty slots */
      })
    return () => {
      active = false
    }
  }, [])

  function startEdit(index: number) {
    setEditing(index)
    setInput(slots[index]?.query ?? '')
    setError('')
  }

  async function save(index: number) {
    const query = input.trim()
    if (!query) return
    setBusy(true)
    setError('')
    try {
      const cfg = await geocode(query)
      const next = slots.map((s, i) => (i === index ? cfg : s))
      setSlots(next)
      setEditing(null)
      setInput('')
      loadWeatherFor(index, cfg)
      // Persist shared config (best-effort; the local view already updated).
      putSetting(SETTING_KEY, next).catch(() => {})
    } catch {
      setError(`Couldn't find "${query}". Try a ZIP code or "City, State".`)
    } finally {
      setBusy(false)
    }
  }

  function remove(index: number) {
    const next = slots.map((s, i) => (i === index ? null : s))
    setSlots(next)
    setWeather((w) => ({ ...w, [index]: undefined }))
    putSetting(SETTING_KEY, next).catch(() => {})
  }

  return (
    <div className="grid grid-weather">
      {slots.map((cfg, i) => (
        <div className="metric-tile weather-card" key={i}>
          {editing === i ? (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                void save(i)
              }}
            >
              <input
                className="weather-input"
                autoFocus
                placeholder="ZIP or City, State"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={busy}
              />
              <div className="weather-edit-actions">
                <button type="submit" className="btn-small" disabled={busy}>
                  {busy ? 'Finding…' : 'Save'}
                </button>
                <button
                  type="button"
                  className="btn-small btn-ghost"
                  onClick={() => {
                    setEditing(null)
                    setError('')
                  }}
                  disabled={busy}
                >
                  Cancel
                </button>
              </div>
              {error && <div className="weather-error">{error}</div>}
            </form>
          ) : cfg ? (
            <>
              <div className="weather-card-head">
                <span className="muted" style={{ fontSize: 13 }}>
                  {cfg.label}
                </span>
                <span className="weather-card-actions">
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => startEdit(i)}
                    aria-label="Edit location"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => remove(i)}
                    aria-label="Remove location"
                  >
                    Remove
                  </button>
                </span>
              </div>
              <WeatherBody state={weather[i]} />
            </>
          ) : (
            <button type="button" className="weather-add" onClick={() => startEdit(i)}>
              ＋ Set location
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

function WeatherBody({ state }: { state: WeatherState }) {
  if (state === 'loading' || state === undefined) {
    return <div className="dim" style={{ fontSize: 12, marginTop: 8 }}>Loading…</div>
  }
  if (state === 'error') {
    return <div className="dim" style={{ fontSize: 12, marginTop: 8 }}>Weather unavailable</div>
  }
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
        <WeatherIcon icon={state.icon} />
        <span style={{ fontSize: 24, fontWeight: 500 }}>{Math.round(state.tempF)}°</span>
      </div>
      <div className="dim" style={{ fontSize: 12, marginTop: 4 }}>
        {state.condition} · H {Math.round(state.highF)} / L {Math.round(state.lowF)}
      </div>
      {state.daily && state.daily.length > 0 && (
        <div className="forecast-row">
          {state.daily.map((d, i) => (
            <div className="forecast-day" key={d.date}>
              <div className="forecast-dow">{dayLabel(d.date, i)}</div>
              <WeatherIcon icon={d.icon} size={18} />
              <div className="forecast-temps">
                <span>{d.highF}°</span>
                <span className="dim">{d.lowF}°</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
