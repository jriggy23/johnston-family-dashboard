import { useState } from 'react'
import { attributeEvents, readableTextColor } from '../data/members'
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
  if (member.photo) {
    return <img className="cal-avatar" src={member.photo} alt={member.name} style={dim} />
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

// Per-member photo editor: pick an image → downscale + derive a highlight color
// client-side → persist via the settings store. Initials remain the fallback.
function MemberPhotoEditor({
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
      await saveMember(id, { color, textColor: readableTextColor(color) }, dataUrl)
    } catch {
      setError('Could not process that image. Try a different photo.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="cal-editor">
      {members.map((m) => (
        <div className="cal-editor-row" key={m.id}>
          <Avatar member={m} size={36} />
          <span className="cal-editor-name">{m.name}</span>
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
  const now = new Date()
  const weekStart = startOfWeek(now)
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const weekEnd = days[6]

  // Attribute events to members, then bucket into day columns. Events outside
  // the current week (the API returns ~2 weeks) are not shown in this view.
  const attributed = attributeEvents(events, members)
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
        <span className="dim" style={{ marginLeft: 'auto', fontSize: 12 }}>
          {monthDay(weekStart)} – {monthDay(weekEnd)}
        </span>
        {saveMember ? (
          <button
            type="button"
            className="link-btn"
            onClick={() => setEditing((v) => !v)}
            aria-expanded={editing}
          >
            {editing ? 'Done' : 'Edit photos'}
          </button>
        ) : null}
      </div>

      {editing && saveMember ? (
        <MemberPhotoEditor members={members} saveMember={saveMember} />
      ) : (
        <div className="cal-legend">
          {members.map((m) => (
            <span className="cal-legend-item" key={m.id}>
              <Avatar member={m} size={24} />
              <span className="cal-legend-name">{m.name}</span>
            </span>
          ))}
        </div>
      )}

      {loading ? (
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
                    byDay[i].map((e) => <EventChip key={e.id} event={e} members={members} />)
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
