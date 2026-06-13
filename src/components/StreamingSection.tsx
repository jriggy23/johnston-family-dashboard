import { useEffect, useState } from 'react'
import { fetchStreaming, getSetting, putSetting } from '../api/client'
import { mockStreaming } from '../data/mock'
import type { StreamingMode, StreamingTitle } from '../types'

const MODE_KEY = 'streamingMode'
const MODES: { value: StreamingMode; label: string }[] = [
  { value: 'popular', label: 'Popular' },
  { value: 'new', label: 'New' },
  { value: 'trending', label: 'Trending' },
]

export default function StreamingSection() {
  const [mode, setMode] = useState<StreamingMode>('popular')
  const [titles, setTitles] = useState<StreamingTitle[]>(mockStreaming)
  const [loading, setLoading] = useState(true)

  // Load the saved mode once.
  useEffect(() => {
    let active = true
    getSetting<StreamingMode>(MODE_KEY)
      .then((saved) => {
        if (active && saved) setMode(saved)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  // Fetch whenever the mode changes; keep mock on empty/error.
  useEffect(() => {
    let active = true
    setLoading(true)
    fetchStreaming(mode)
      .then((data) => {
        if (active && data.length > 0) setTitles(data)
      })
      .catch(() => {})
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [mode])

  function choose(next: StreamingMode) {
    if (next === mode) return
    setMode(next)
    putSetting(MODE_KEY, next).catch(() => {})
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-header">
        <span className="card-title">Streaming</span>
        <div className="seg" role="group" aria-label="Streaming selection mode">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              className={`seg-btn${mode === m.value ? ' seg-on' : ''}`}
              onClick={() => choose(m.value)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-watch" style={{ opacity: loading ? 0.6 : 1 }}>
        {titles.map((t) => (
          <div key={t.id}>
            <div className="poster">
              {t.posterUrl ? (
                <img src={t.posterUrl} alt="" loading="lazy" />
              ) : null}
            </div>
            <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.3, marginTop: 6 }}>
              {t.title}
            </div>
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
