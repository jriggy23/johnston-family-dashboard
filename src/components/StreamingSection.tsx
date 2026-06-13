import type { StreamingTitle } from '../types'

export default function StreamingSection({ titles }: { titles: StreamingTitle[] }) {
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-header">
        <span className="card-title">Streaming</span>
        <span className="dim" style={{ marginLeft: 'auto', fontSize: 12 }}>
          On your services
        </span>
      </div>
      <div className="grid grid-watch">
        {titles.map((t) => (
          <div key={t.id}>
            <div
              style={{
                aspectRatio: '2 / 3',
                background: 'var(--surface-2)',
                borderRadius: 'var(--radius-md)',
                marginBottom: 6,
              }}
            />
            <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.3 }}>{t.title}</div>
            <span
              style={{
                display: 'inline-block',
                fontSize: 11,
                padding: '1px 6px',
                borderRadius: 'var(--radius-md)',
                marginTop: 3,
                background: t.serviceColor,
                color: t.serviceTextColor,
              }}
            >
              {t.service}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
