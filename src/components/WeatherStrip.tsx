import type { FamilyMember, Weather } from '../types'

function WeatherIcon({ icon }: { icon: string }) {
  const common = { width: 28, height: 28, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true }
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

interface Props {
  members: FamilyMember[]
  weather: Weather[]
}

export default function WeatherStrip({ members, weather }: Props) {
  const byId = new Map(members.map((m) => [m.id, m]))
  return (
    <div className="grid grid-weather">
      {weather.map((w) => {
        const m = byId.get(w.memberId)
        if (!m) return null
        return (
          <div className="metric-tile" key={w.memberId}>
            <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>
              {m.name} · {m.location.label}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <WeatherIcon icon={w.icon} />
              <span style={{ fontSize: 24, fontWeight: 500 }}>{Math.round(w.tempF)}°</span>
            </div>
            <div className="dim" style={{ fontSize: 12, marginTop: 4 }}>
              {w.condition} · H {Math.round(w.highF)} / L {Math.round(w.lowF)}
            </div>
          </div>
        )
      })}
    </div>
  )
}
