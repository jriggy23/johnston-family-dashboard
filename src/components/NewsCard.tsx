import type { NewsItem } from '../types'

export default function NewsCard({ items }: { items: NewsItem[] }) {
  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">News</span>
        <span
          className="card-badge"
          style={{ background: '#4a1b0c', color: '#f5c4b3' }}
        >
          Fox News
        </span>
      </div>
      {items.map((n, i) => (
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
            style={{ color: 'var(--text)', textDecoration: 'none', fontSize: 14, fontWeight: 500, lineHeight: 1.4 }}
          >
            {n.title}
          </a>
          <div className="dim" style={{ fontSize: 12, marginTop: 2 }}>
            {n.category} · {n.ago}
          </div>
        </div>
      ))}
    </div>
  )
}
