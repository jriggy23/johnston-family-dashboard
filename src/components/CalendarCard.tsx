import type { CalendarEvent } from '../types'

export default function CalendarCard({
  events,
  loading = false,
}: {
  events: CalendarEvent[]
  loading?: boolean
}) {
  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Family calendar</span>
      </div>
      {loading ? (
        <div className="dim" style={{ fontSize: 12 }}>Loading…</div>
      ) : (
        events.map((e) => (
          <div key={e.id} style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            <div style={{ width: 4, background: e.color, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{e.title}</div>
              <div className="muted" style={{ fontSize: 12 }}>
                {e.when}
                {e.where ? ` · ${e.where}` : ''}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
