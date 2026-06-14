import { useEffect, useState } from 'react'
import { fetchStreaming, getSetting, putSetting } from '../api/client'
import { mockStreaming } from '../data/mock'
import { FAMILY_PROVIDERS } from '../data/providers'
import { serviceColors } from '../data/serviceColors'
import TitleDetailModal from './TitleDetailModal'
import type { StreamingMode, StreamingTitle, TitleSelector } from '../types'

// Streaming ids are `${mediaType}-${tmdbId}` (see api/watch.ts); derive a detail
// selector from that, falling back to a title query for mock items without one.
function selectorFor(t: StreamingTitle): TitleSelector {
  const idPart = t.id.includes('-') ? t.id.slice(t.id.indexOf('-') + 1) : t.id
  if (t.mediaType && /^\d+$/.test(idPart)) {
    return { type: t.mediaType, id: idPart, fallbackTitle: t.title }
  }
  return { q: t.title, fallbackTitle: t.title }
}

const MODE_KEY = 'streamingMode'
const PROVIDERS_KEY = 'streamingProviders'
const MODES: { value: StreamingMode; label: string }[] = [
  { value: 'popular', label: 'Popular' },
  { value: 'new', label: 'New' },
  { value: 'trending', label: 'Trending' },
]

const DEFAULT_PROVIDERS: string[] = [...FAMILY_PROVIDERS]

export default function StreamingSection() {
  const [mode, setMode] = useState<StreamingMode>('popular')
  // Starts empty (not mock) so the first paint shows a loading state rather
  // than flashing placeholder titles. Mock is applied only after a fetch.
  const [titles, setTitles] = useState<StreamingTitle[]>([])
  const [loading, setLoading] = useState(true)
  // Which providers are toggled on. Default: all of the family's providers.
  const [selected, setSelected] = useState<string[]>(DEFAULT_PROVIDERS)
  // The title whose detail overlay is open, if any.
  const [detail, setDetail] = useState<TitleSelector | null>(null)

  // Load the saved mode + provider selection once. Falls back to defaults if
  // the settings store is unavailable (501) or nothing is saved yet.
  useEffect(() => {
    let active = true
    getSetting<StreamingMode>(MODE_KEY)
      .then((saved) => {
        if (active && saved) setMode(saved)
      })
      .catch(() => {})
    getSetting<string[]>(PROVIDERS_KEY)
      .then((saved) => {
        if (!active || !Array.isArray(saved)) return
        // Keep only providers we still recognize; ignore an empty result.
        const valid = saved.filter((p) => (FAMILY_PROVIDERS as readonly string[]).includes(p))
        if (valid.length) setSelected(valid)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  // Fetch whenever the mode changes. Mock is used only as a fallback once the
  // fetch settles (empty result or error) — never during the pending phase.
  useEffect(() => {
    let active = true
    setLoading(true)
    fetchStreaming(mode)
      .then((data) => {
        if (active) setTitles(data.length > 0 ? data : mockStreaming)
      })
      .catch(() => {
        if (active) setTitles(mockStreaming)
      })
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

  function toggleProvider(provider: string) {
    setSelected((prev) => {
      const next = prev.includes(provider)
        ? prev.filter((p) => p !== provider)
        : [...prev, provider]
      putSetting(PROVIDERS_KEY, next).catch(() => {})
      return next
    })
  }

  // When every provider is selected (the default), show everything — including
  // titles with no recognized family provider. Otherwise filter to titles that
  // stream on at least one selected provider.
  const allSelected = selected.length === FAMILY_PROVIDERS.length
  const visible = allSelected
    ? titles
    : titles.filter((t) => t.services.some((s) => selected.includes(s)))

  // Show a loading state only on the initial load (nothing fetched yet). On
  // later mode/filter changes we keep the existing real data dimmed instead.
  const showLoading = loading && titles.length === 0

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

      <div
        role="group"
        aria-label="Filter by streaming provider"
        style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}
      >
        {FAMILY_PROVIDERS.map((provider) => {
          const on = selected.includes(provider)
          const palette = serviceColors(provider)
          return (
            <button
              key={provider}
              type="button"
              aria-pressed={on}
              onClick={() => toggleProvider(provider)}
              style={{
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid transparent',
                cursor: 'pointer',
                background: on ? palette.serviceColor : 'transparent',
                color: on ? palette.serviceTextColor : 'var(--text-muted, #8b8f99)',
                borderColor: on ? 'transparent' : 'var(--border, #2a2f3a)',
                opacity: on ? 1 : 0.7,
              }}
            >
              {provider}
            </button>
          )
        })}
      </div>

      {showLoading && <div className="dim" style={{ fontSize: 12 }}>Loading…</div>}
      <div
        className="grid grid-watch"
        style={{ opacity: loading ? 0.6 : 1, display: showLoading ? 'none' : undefined }}
      >
        {visible.map((t) => {
          const badges = t.services.length ? t.services : [t.service]
          return (
            <button
              type="button"
              key={t.id}
              className="title-card"
              onClick={() => setDetail(selectorFor(t))}
            >
              <div className="poster">
                {t.posterUrl ? (
                  <img src={t.posterUrl} alt="" loading="lazy" />
                ) : null}
              </div>
              <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.3, marginTop: 6 }}>
                {t.title}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 3 }}>
                {badges.map((service) => {
                  const palette = serviceColors(service)
                  return (
                    <span
                      key={service}
                      style={{
                        display: 'inline-block',
                        fontSize: 11,
                        padding: '1px 6px',
                        borderRadius: 'var(--radius-md)',
                        background: palette.serviceColor,
                        color: palette.serviceTextColor,
                      }}
                    >
                      {service}
                    </span>
                  )
                })}
              </div>
            </button>
          )
        })}
      </div>

      {detail && <TitleDetailModal selector={detail} onClose={() => setDetail(null)} />}
    </div>
  )
}
