import { useEffect, useReducer, useRef, useState } from 'react'
import { fetchCalendarRange } from '../api/client'
import { attributeEvents } from '../data/members'
import type { FamilyMembersState, MemberWithPhoto } from '../hooks/useFamilyMembers'
import { processAvatar } from '../lib/avatar'
import type { CalendarEvent } from '../types'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function startOfWeek(d: Date): Date {
  const s = new Date(d)
  s.setHours(0, 0, 0, 0)
  s.setDate(s.getDate() - s.getDay()) // back to Sunday
  return s
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

function sameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

function monthDay(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function weekOffsetLabel(offset: number): string {
  if (offset === -1) return 'last week'
  if (offset === 1) return 'next week'
  return `${offset > 0 ? '+' : ''}${offset} weeks`
}

// Faint background tint from a member's hex color, layered over the surface.
function tint(hex: string, alpha: number): string {
  const c = hex.replace('#', '')
  if (c.length < 6) return 'transparent'
  const r = parseInt(c.slice(0, 2), 16)
  const g = parseInt(c.slice(2, 4), 16)
  const b = parseInt(c.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function Avatar({ member, size = 28 }: { member: MemberWithPhoto; size?: number }) {
  const dim = { width: size, height: size }
  // Precedence: manual upload → Contacts photo → colored initials.
  const photo = member.photo ?? member.contactPhoto
  if (photo) {
    return <img className="cal-avatar" src={photo} alt={member.name} style={dim} />
  }
  return (
    <span
      className="cal-avatar cal-avatar-initials"
      style={{ ...dim, background: member.color, color: member.textColor }}
      aria-label={member.name}
    >
      {member.initials}
    </span>
  )
}

function EventChip({ event, members }: { event: CalendarEvent; members: MemberWithPhoto[] }) {
  const member = members.find((m) => m.id === event.memberId)
  return (
    <div
      className="cal-event"
      style={{ borderLeftColor: event.color, background: tint(event.color, 0.16) }}
      title={member ? `${event.title} · ${member.name}` : event.title}
    >
      <div className="cal-event-time">{event.allDay ? 'All day' : timeLabel(event.start)}</div>
      <div className="cal-event-title">{event.title}</div>
      {event.where ? <div className="cal-event-where">{event.where}</div> : null}
    </div>
  )
}

// Per-member editor over the dynamically-discovered calendars: show/hide each
// calendar, and upload/replace/remove a photo (downscaled + highlight color
// derived client-side). Initials remain the fallback avatar.
function MemberEditor({
  members,
  saveMember,
}: {
  members: MemberWithPhoto[]
  saveMember: FamilyMembersState['saveMember']
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function onPick(id: string, file?: File) {
    if (!file) return
    setBusy(id)
    setError('')
    try {
      const { dataUrl, color } = await processAvatar(file)
      await saveMember(id, { color }, dataUrl)
    } catch {
      setError('Could not process that image. Try a different photo.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="cal-editor">
      {members.map((m) => (
        <div className={`cal-editor-row${m.hidden ? ' cal-editor-hidden' : ''}`} key={m.id}>
          <Avatar member={m} size={36} />
          <span className="cal-editor-name">{m.name}</span>
          <label className="cal-toggle">
            <input
              type="checkbox"
              checked={!m.hidden}
              onChange={() => saveMember(m.id, { hidden: !m.hidden })}
            />
            Show
          </label>
          <label className="btn-small">
            {busy === m.id ? 'Working…' : m.photo ? 'Replace' : 'Upload'}
            <input
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              disabled={busy !== null}
              onChange={(e) => onPick(m.id, e.target.files?.[0])}
            />
          </label>
          {m.photo ? (
            <button
              type="button"
              className="btn-small btn-ghost"
              disabled={busy !== null}
              onClick={() => saveMember(m.id, {}, null)}
            >
              Remove
            </button>
          ) : null}
        </div>
      ))}
      {error ? <div className="weather-error">{error}</div> : null}
    </div>
  )
}

export default function WeeklyCalendar({
  events,
  members,
  loading = false,
  saveMember,
}: {
  events: CalendarEvent[]
  members: MemberWithPhoto[]
  loading?: boolean
  saveMember?: FamilyMembersState['saveMember']
}) {
  const [editing, setEditing] = useState(false)
  const [weekOffset, setWeekOffset] = useState(0)
  const [weekLoading, setWeekLoading] = useState(false)
  // Cache fetched weeks (offset → events) in a ref so navigating back and forth
  // doesn't refetch; offset 0 always uses the `events` prop (already loaded).
  const cacheRef = useRef<Record<number, CalendarEvent[]>>({})
  const [, bumpRender] = useReducer((x: number) => x + 1, 0)

  const now = new Date()
  const weekStart = addDays(startOfWeek(now), weekOffset * 7)
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const weekEnd = days[6]

  // Fetch the displayed week's events when navigated away from the current week.
  useEffect(() => {
    if (weekOffset === 0 || cacheRef.current[weekOffset]) {
      setWeekLoading(false)
      return
    }
    let active = true
    setWeekLoading(true)
    const start = addDays(startOfWeek(new Date()), weekOffset * 7)
    const end = addDays(start, 7)
    fetchCalendarRange(start, end)
      .then((evs) => {
        if (!active) return
        cacheRef.current[weekOffset] = evs
        bumpRender()
      })
      .catch(() => {
        if (!active) return
        cacheRef.current[weekOffset] = []
        bumpRender()
      })
      .finally(() => active && setWeekLoading(false))
    return () => {
      active = false
    }
  }, [weekOffset])

  const sourceEvents = weekOffset === 0 ? events : cacheRef.current[weekOffset] ?? []
  const isLoading = weekOffset === 0 ? loading : weekLoading && !cacheRef.current[weekOffset]

  // Hidden calendars are excluded from the grid + legend (the editor still lists
  // them so they can be re-shown). Drop their events, then attribute the rest to
  // the visible members.
  const visibleMembers = members.filter((m) => !m.hidden)
  const hiddenSources = new Set(
    members.filter((m) => m.hidden).map((m) => m.calendarSource.trim().toLowerCase()),
  )
  const shownEvents = sourceEvents.filter(
    (e) => !hiddenSources.has(e.calendar.trim().toLowerCase()),
  )

  // Attribute events to members, then bucket into the 7 day columns.
  const attributed = attributeEvents(shownEvents, visibleMembers)
  const byDay: CalendarEvent[][] = days.map(() => [])
  for (const e of attributed) {
    const d = new Date(e.start)
    if (Number.isNaN(d.getTime())) continue
    const idx = days.findIndex((day) => sameLocalDay(day, d))
    if (idx >= 0) byDay[idx].push(e)
  }
  byDay.forEach((list) =>
    list.sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start.localeCompare(b.start)),
  )

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Family calendar</span>
        <div className="cal-nav">
          <button
            type="button"
            className="cal-nav-btn"
            onClick={() => setWeekOffset((o) => o - 1)}
            aria-label="Previous week"
          >
            ‹
          </button>
          <span className="cal-range">
            {monthDay(weekStart)} – {monthDay(weekEnd)}
            {weekOffset !== 0 ? <span className="cal-off"> · {weekOffsetLabel(weekOffset)}</span> : null}
          </span>
          <button
            type="button"
            className="cal-nav-btn"
            onClick={() => setWeekOffset((o) => o + 1)}
            aria-label="Next week"
          >
            ›
          </button>
          {weekOffset !== 0 ? (
            <button type="button" className="link-btn" onClick={() => setWeekOffset(0)}>
              This week
            </button>
          ) : null}
        </div>
        {saveMember ? (
          <button
            type="button"
            className="link-btn cal-edit-btn"
            onClick={() => setEditing((v) => !v)}
            aria-expanded={editing}
          >
            {editing ? 'Done' : 'Edit'}
          </button>
        ) : null}
      </div>

      {editing && saveMember ? (
        <MemberEditor members={members} saveMember={saveMember} />
      ) : (
        <div className="cal-legend">
          {visibleMembers.map((m) => (
            <span className="cal-legend-item" key={m.id}>
              <Avatar member={m} size={24} />
              <span className="cal-legend-name">{m.name}</span>
            </span>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="dim" style={{ fontSize: 12 }}>Loading…</div>
      ) : (
        <div className="cal-grid">
          {days.map((day, i) => {
            const isToday = sameLocalDay(day, now)
            const empty = byDay[i].length === 0
            return (
              <div
                className={`cal-day${isToday ? ' cal-today' : ''}${empty ? ' cal-day-empty' : ''}`}
                key={day.toISOString()}
              >
                <div className="cal-day-head">
                  <span className="cal-dow">{DAY_NAMES[i]}</span>
                  <span className="cal-date">{day.getDate()}</span>
                  {isToday && <span className="cal-today-tag">Today</span>}
                </div>
                <div className="cal-events">
                  {empty ? (
                    <div className="cal-empty">—</div>
                  ) : (
                    byDay[i].map((e) => <EventChip key={e.id} event={e} members={visibleMembers} />)
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
