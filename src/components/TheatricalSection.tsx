import { useState } from 'react'
import TitleDetailModal from './TitleDetailModal'
import type { TheatricalRelease, TitleSelector } from '../types'

// Theatrical ids are the bare TMDB movie id (see api/watch.ts theatrical()), so
// detail can be requested directly; mock items without a numeric id fall back to
// a title query.
function selectorFor(r: TheatricalRelease): TitleSelector {
  if (/^\d+$/.test(r.id)) return { type: 'movie', id: r.id, fallbackTitle: r.title }
  return { q: r.title, fallbackTitle: r.title }
}

export default function TheatricalSection({
  releases,
  loading = false,
}: {
  releases: TheatricalRelease[]
  loading?: boolean
}) {
  const [detail, setDetail] = useState<TitleSelector | null>(null)

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Upcoming theatrical releases</span>
        <span className="dim" style={{ marginLeft: 'auto', fontSize: 12 }}>
          In theaters soon
        </span>
      </div>
      {loading && <div className="dim" style={{ fontSize: 12 }}>Loading…</div>}
      <div className="grid grid-watch" style={{ display: loading ? 'none' : undefined }}>
        {releases.map((r) => (
          <button
            type="button"
            key={r.id}
            className="title-card"
            onClick={() => setDetail(selectorFor(r))}
          >
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
            <span className="release-date-badge">{r.releaseDate}</span>
          </button>
        ))}
      </div>

      {detail && <TitleDetailModal selector={detail} onClose={() => setDetail(null)} />}
    </div>
  )
}
