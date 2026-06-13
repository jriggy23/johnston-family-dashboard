import type { TheatricalRelease } from '../types'

export default function TheatricalSection({ releases }: { releases: TheatricalRelease[] }) {
  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Upcoming theatrical releases</span>
      </div>
      {releases.map((r, i) => (
        <div
          key={r.id}
          style={{
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            marginBottom: i < releases.length - 1 ? 10 : 0,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 'var(--radius-md)',
              background: 'var(--surface-2)',
              flexShrink: 0,
            }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 500 }}>{r.title}</div>
            <div className="muted" style={{ fontSize: 12 }}>
              {r.genre}
            </div>
          </div>
          <div
            style={{
              fontSize: 12,
              color: '#efa033',
              background: '#3a2a10',
              padding: '3px 10px',
              borderRadius: 'var(--radius-md)',
              whiteSpace: 'nowrap',
            }}
          >
            {r.releaseDate}
          </div>
        </div>
      ))}
    </div>
  )
}
