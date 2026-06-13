import { useEffect, useState } from 'react'
import { fetchShowtimes, normalizeTitle } from '../api/client'
import type { ShowDay, ShowtimeMovie, TheatricalRelease } from '../types'

function soonestDay(movie: ShowtimeMovie): ShowDay | undefined {
  const today = movie.days.find((d) => d.label === 'Today' && d.times.length > 0)
  return today ?? movie.days.find((d) => d.times.length > 0)
}

export default function TheatricalSection({ releases }: { releases: TheatricalRelease[] }) {
  const [theater, setTheater] = useState('')
  const [byTitle, setByTitle] = useState<Map<string, ShowtimeMovie>>(new Map())

  useEffect(() => {
    let active = true
    fetchShowtimes()
      .then(({ theater: name, movies }) => {
        if (!active) return
        setTheater(name)
        setByTitle(new Map(movies.map((m) => [m.normalized, m])))
      })
      .catch(() => {
        /* no showtimes — cards just show release dates */
      })
    return () => {
      active = false
    }
  }, [])

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Upcoming theatrical releases</span>
        {theater ? (
          <span className="dim" style={{ marginLeft: 'auto', fontSize: 12 }}>
            Showtimes · {theater}
          </span>
        ) : null}
      </div>
      <div className="grid grid-watch">
        {releases.map((r) => {
          const match = byTitle.get(normalizeTitle(r.title))
          const day = match && soonestDay(match)
          return (
            <div key={r.id}>
              <div className="poster">
                {r.posterUrl ? <img src={r.posterUrl} alt="" loading="lazy" /> : null}
              </div>
              <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.3, marginTop: 6 }}>
                {r.title}
              </div>
              {r.genre ? (
                <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
                  {r.genre}
                </div>
              ) : null}
              {day ? (
                <div className="showtimes">
                  <div className="showtimes-day">{day.label === 'Today' ? 'Today' : `${day.label} ${day.date}`}</div>
                  <div className="showtime-chips">
                    {day.times.slice(0, 6).map((t) => (
                      <span className="showtime-chip" key={t}>
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <span className="release-date-badge">{r.releaseDate}</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
