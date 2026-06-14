import { useEffect, useRef, useState } from 'react'
import { fetchTitleDetail } from '../api/client'
import { mockTitleDetail } from '../data/mock'
import type { TitleDetail, TitleRatings, TitleSelector } from '../types'

// Accessible detail overlay for a clicked entertainment item. Fetches combined
// TMDB (+ optional OMDb) detail for the given selector, with a loading state and
// a graceful mock fallback so it always renders something. Closes on Esc, on a
// backdrop click, or via the close button; focus moves to the dialog on open and
// returns to the trigger on close.

function formatReleaseDate(iso?: string): string | undefined {
  if (!iso) return undefined
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) return iso
  return new Date(ms).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

function formatRuntime(min?: number): string | undefined {
  if (!min || min <= 0) return undefined
  const h = Math.floor(min / 60)
  const m = min % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

// Ratings rendered as labeled badges — only those present are shown.
function RatingBadges({ ratings }: { ratings: TitleRatings }) {
  const items: { key: string; label: string; value: string; className: string }[] = []
  if (ratings.rottenTomatoes)
    items.push({ key: 'rt', label: 'RT', value: ratings.rottenTomatoes, className: 'rating-rt' })
  if (ratings.imdb)
    items.push({ key: 'imdb', label: 'IMDb', value: ratings.imdb, className: 'rating-imdb' })
  if (ratings.metacritic)
    items.push({ key: 'mc', label: 'Metacritic', value: ratings.metacritic, className: 'rating-mc' })
  if (typeof ratings.tmdb === 'number')
    items.push({ key: 'tmdb', label: 'TMDB', value: `${ratings.tmdb}/10`, className: 'rating-tmdb' })

  if (items.length === 0) {
    return <div className="dim" style={{ fontSize: 12 }}>No ratings available</div>
  }

  return (
    <div className="rating-badges" aria-label="Ratings">
      {items.map((r) => (
        <span key={r.key} className={`rating-badge ${r.className}`}>
          <span className="rating-label">{r.label}</span>
          <span className="rating-value">{r.value}</span>
        </span>
      ))}
    </div>
  )
}

export default function TitleDetailModal({
  selector,
  onClose,
}: {
  selector: TitleSelector
  onClose: () => void
}) {
  const [detail, setDetail] = useState<TitleDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  // Fetch detail for the selector. Falls back to mock detail when the endpoint
  // is unconfigured (returns null) or on any error, so the overlay always shows.
  useEffect(() => {
    let active = true
    setLoading(true)
    setDetail(null)
    fetchTitleDetail(selector)
      .then((d) => {
        if (active) setDetail(d ?? mockTitleDetail(selector))
      })
      .catch(() => {
        if (active) setDetail(mockTitleDetail(selector))
      })
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [selector])

  // Esc to close + restore focus to the element that opened the modal.
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    // Move focus into the dialog (close button) once mounted.
    closeRef.current?.focus()
    // Prevent the page behind from scrolling while open.
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      trigger?.focus?.()
    }
  }, [onClose])

  // Minimal focus trap: keep Tab cycling inside the dialog.
  function onKeyDownDialog(e: React.KeyboardEvent) {
    if (e.key !== 'Tab') return
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    )
    if (!focusable || focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  const heading = detail?.title ?? selector.fallbackTitle ?? 'Loading…'
  const release = formatReleaseDate(detail?.releaseDate) ?? detail?.year
  const runtime = formatRuntime(detail?.runtime)
  const meta = [release, runtime, detail?.genres?.join(' · ') || undefined].filter(Boolean)

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="title-detail-heading"
        ref={dialogRef}
        onKeyDown={onKeyDownDialog}
      >
        <button
          type="button"
          className="modal-close"
          aria-label="Close"
          onClick={onClose}
          ref={closeRef}
        >
          ✕
        </button>

        {detail?.backdropUrl ? (
          <div className="modal-backdrop-img">
            <img src={detail.backdropUrl} alt="" />
          </div>
        ) : null}

        <div className="modal-body">
          <div className="modal-main">
            {detail?.posterUrl ? (
              <div className="modal-poster">
                <img src={detail.posterUrl} alt="" />
              </div>
            ) : null}

            <div className="modal-info">
              <h2 id="title-detail-heading" className="modal-title">
                {heading}
              </h2>
              {meta.length > 0 ? <div className="modal-meta">{meta.join('  ·  ')}</div> : null}

              {loading ? (
                <div className="dim" style={{ fontSize: 13, marginTop: 10 }}>
                  Loading…
                </div>
              ) : (
                <>
                  {detail?.ratings ? <RatingBadges ratings={detail.ratings} /> : null}
                  {detail?.overview ? (
                    <p className="modal-overview">{detail.overview}</p>
                  ) : (
                    <p className="modal-overview dim">No description available.</p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
