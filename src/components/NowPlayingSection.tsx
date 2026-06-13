import { useEffect, useState } from 'react'
import { fetchShowtimes } from '../api/client'
import type { ShowDay, ShowtimeMovie } from '../types'

function soonestDay(movie: ShowtimeMovie): ShowDay | undefined {
  const today = movie.days.find((d) => d.label === 'Today' && d.times.length > 0)
  return today ?? movie.days.find((d) => d.times.length > 0)
}

export default function NowPlayingSection() {
  const [theater, setTheater] = useState('')
  const [movies, setMovies] = useState<ShowtimeMovie[]>([])

  useEffect(() => {
    let active = true
    fetchShowtimes()
      .then(({ theater: name, movies: list }) => {
        if (!active) return
        setTheater(name)
        setMovies(list)
      })
      .catch(() => {
        /* leave empty — section hides itself */
      })
    return () => {
      active = false
    }
  }, [])

  if (movies.length === 0) return null

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-header">
        <span className="card-title">Now playing locally</span>
        {theater ? (
          <span className="dim" style={{ marginLeft: 'auto', fontSize: 12 }}>
            {theater}
          </span>
        ) : null}
      </div>
      <div className="grid grid-watch">
        {movies.map((m) => {
          const day = soonestDay(m)
          return (
            <div key={m.normalized}>
              <div className="poster">
                {m.posterUrl ? <img src={m.posterUrl} alt="" loading="lazy" /> : null}
              </div>
              <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.3, marginTop: 6 }}>
                {m.title}
              </div>
              {day ? (
                <div className="showtimes">
                  <div className="showtimes-day">
                    {day.label === 'Today' ? 'Today' : `${day.label} ${day.date}`}
                  </div>
                  <div className="showtime-chips">
                    {day.times.slice(0, 6).map((t) => (
                      <span className="showtime-chip" key={t}>
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
