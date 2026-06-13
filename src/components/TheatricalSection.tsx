import type { TheatricalRelease } from '../types'

export default function TheatricalSection({
  releases,
  loading = false,
}: {
  releases: TheatricalRelease[]
  loading?: boolean
}) {
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
            <span className="release-date-badge">{r.releaseDate}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
