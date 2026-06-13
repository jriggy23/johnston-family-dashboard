// Family member roster: the single source of truth for who's in the family,
// which iCloud calendar attributes to them, and their highlight color/avatar.
// The roster is built DYNAMICALLY at load from the discovered iCloud event
// calendars (see useFamilyMembers); this module provides the discovery→member
// mapping, the persisted-override key, a default fallback roster, and the pure
// helpers that attribute calendar events to members.
import type { CalendarEvent, CalendarInfo, FamilyCalendarMember } from '../types'

// Per-calendar overrides (photo flag + color/hidden/order), persisted as a single
// settings value keyed by the member's stable calendar key.
export const OVERRIDES_KEY = 'calendarOverrides'
export const MEMBER_PHOTO_KEY_PREFIX = 'memberPhoto_'

// Fallback roster, used only when calendar discovery is unavailable
// (unconfigured / 501 / network error) so the dashboard still renders.
export const DEFAULT_MEMBERS: FamilyCalendarMember[] = [
  { id: 'john', name: 'John', initials: 'JJ', calendarSource: 'John', color: '#1c3a5e', textColor: '#b5d4f4' },
  { id: 'sarah', name: 'Sarah', initials: 'SJ', calendarSource: 'Sarah', color: '#10402f', textColor: '#9fe1cb' },
  { id: 'emma', name: 'Emma', initials: 'EJ', calendarSource: 'Emma', color: '#4a1b0c', textColor: '#f5c4b3' },
  { id: 'max', name: 'Max', initials: 'MJ', calendarSource: 'Max', color: '#4b1528', textColor: '#f4c0d1' },
]

// iCloud sometimes returns colors as #RRGGBBAA; drop the trailing alpha.
export function stripAlpha(hex: string): string {
  return /^#[0-9a-f]{8}$/i.test(hex) ? hex.slice(0, 7) : hex
}

// Initials from a calendar/display name: first letters of up to two words,
// else the first two characters. e.g. "John" → "J", "Family Home" → "FH".
export function initialsFromName(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

// A stable, settings-key-safe id for a calendar: the last path segment of its
// URL (the iCloud calendar UUID) when available, else a slug of the name.
export function calendarKey(info: CalendarInfo): string {
  const fromId = (info.id ?? '')
    .replace(/\/+$/, '')
    .split('/')
    .pop()
  const raw = fromId && fromId.length > 0 ? fromId : info.name
  const slug = raw.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
  return (slug || 'cal').slice(0, 48).toLowerCase()
}

// Build base members from discovered event calendars (display order preserved).
export function membersFromCalendars(calendars: CalendarInfo[]): FamilyCalendarMember[] {
  return calendars.map((c) => {
    const color = stripAlpha(c.color ?? '#1f232c')
    return {
      id: calendarKey(c),
      name: c.name,
      initials: initialsFromName(c.name),
      calendarSource: c.name,
      calendarId: c.id,
      color,
      textColor: readableTextColor(color),
    }
  })
}

// The member whose calendar an event came from, matched by source-calendar name
// (case-insensitive). Returns undefined when no member's calendar matches.
export function memberForEvent(
  event: CalendarEvent,
  members: FamilyCalendarMember[],
): FamilyCalendarMember | undefined {
  const src = event.calendar.trim().toLowerCase()
  if (!src) return undefined
  return members.find((m) => m.calendarSource.trim().toLowerCase() === src)
}

// Attribute events to members: set memberId + the member's color. Events with no
// matching member keep their own iCloud color (the existing fallback behavior).
export function attributeEvents(
  events: CalendarEvent[],
  members: FamilyCalendarMember[],
): CalendarEvent[] {
  return events.map((e) => {
    const m = memberForEvent(e, members)
    return m ? { ...e, memberId: m.id, color: m.color } : e
  })
}

// Pick a readable foreground color (near-white or near-black) for a background,
// used when a member's color is derived from an uploaded photo.
export function readableTextColor(hex: string): string {
  const c = hex.replace('#', '')
  if (c.length < 6) return '#ffffff'
  const r = parseInt(c.slice(0, 2), 16)
  const g = parseInt(c.slice(2, 4), 16)
  const b = parseInt(c.slice(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.6 ? '#1a1a1a' : '#ffffff'
}
