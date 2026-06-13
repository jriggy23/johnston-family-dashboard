import type { NewsItem } from '../types'

export default function NewsCard({
  items,
  loading = false,
}: {
  items: NewsItem[]
  loading?: boolean
}) {
  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">News</span>
        <span className="dim" style={{ marginLeft: 'auto', fontSize: 12 }}>
          Top stories
        </span>
      </div>
      <div className="news-list">
        {loading && <div className="dim" style={{ fontSize: 12 }}>Loading…</div>}
        {!loading &&
          items.map((n, i) => (
          <div
            key={n.id}
            style={{
              borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none',
              paddingBottom: i < items.length - 1 ? 10 : 0,
              marginBottom: i < items.length - 1 ? 10 : 0,
            }}
          >
            <a
              href={n.link}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--text)', textDecoration: 'none', fontSize: 14, fontWeight: 500, lineHeight: 1.4 }}
            >
              {n.title}
            </a>
            <div className="dim" style={{ fontSize: 12, marginTop: 2 }}>
              <span className="news-source">{n.source}</span>
              {n.ago ? ` · ${n.ago}` : ''}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
