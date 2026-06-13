// Family member roster: the single source of truth for who's in the family,
// which iCloud calendar attributes to them, and their highlight color/avatar.
// The roster is configurable via the `familyMembers` setting (Table Storage);
// this module provides the defaults, the color palette, and the pure helpers
// that attribute calendar events to members.
import type { CalendarEvent, FamilyCalendarMember } from '../types'

export const FAMILY_MEMBERS_KEY = 'familyMembers'
export const MEMBER_PHOTO_KEY_PREFIX = 'memberPhoto_'

// Highlight palette for members without a photo-derived color. Tuned to match
// the dashboard's existing badge palette (see data/serviceColors.ts).
export const MEMBER_PALETTE: { color: string; textColor: string }[] = [
  { color: '#1c3a5e', textColor: '#b5d4f4' }, // blue
  { color: '#10402f', textColor: '#9fe1cb' }, // green
  { color: '#4a1b0c', textColor: '#f5c4b3' }, // rust
  { color: '#4b1528', textColor: '#f4c0d1' }, // berry
  { color: '#2f2a6b', textColor: '#cecbf6' }, // indigo
  { color: '#13294a', textColor: '#a9c5f0' }, // navy
]

export const DEFAULT_MEMBERS: FamilyCalendarMember[] = [
  { id: 'john', name: 'John', initials: 'JJ', calendarSource: 'John', color: '#1c3a5e', textColor: '#b5d4f4' },
  { id: 'sarah', name: 'Sarah', initials: 'SJ', calendarSource: 'Sarah', color: '#10402f', textColor: '#9fe1cb' },
  { id: 'emma', name: 'Emma', initials: 'EJ', calendarSource: 'Emma', color: '#4a1b0c', textColor: '#f5c4b3' },
  { id: 'max', name: 'Max', initials: 'MJ', calendarSource: 'Max', color: '#4b1528', textColor: '#f4c0d1' },
]

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
