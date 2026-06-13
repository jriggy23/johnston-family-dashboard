import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchCalendars, getSetting, putSetting } from '../api/client'
import {
  DEFAULT_MEMBERS,
  MEMBER_PHOTO_KEY_PREFIX,
  OVERRIDES_KEY,
  membersFromCalendars,
  readableTextColor,
} from '../data/members'
import type { FamilyCalendarMember } from '../types'

// A roster member plus runtime state: its loaded avatar, whether it's hidden,
// and its display order. Photos live under their own settings key
// (memberPhoto_<id>) so the overrides value stays small.
export interface MemberWithPhoto extends FamilyCalendarMember {
  photo?: string
  hidden?: boolean
  order?: number
}

// Persisted per-calendar override, keyed by the member's stable calendar key.
interface MemberOverride {
  color?: string
  hidden?: boolean
  order?: number
  photo?: boolean // whether a memberPhoto_<id> value exists to load
}
type Overrides = Record<string, MemberOverride>

// What the caller may change: a custom color, hidden flag, or order. Photo is
// passed separately (data-URL to set, null to clear, omitted to leave as-is).
export type MemberPatch = Pick<MemberOverride, 'color' | 'hidden' | 'order'>

export interface FamilyMembersState {
  members: MemberWithPhoto[]
  loading: boolean
  saveMember: (id: string, patch: MemberPatch, photo?: string | null) => Promise<void>
}

function applyOverrides(base: FamilyCalendarMember[], overrides: Overrides): MemberWithPhoto[] {
  const merged: MemberWithPhoto[] = base.map((m, i) => {
    const o = overrides[m.id]
    const color = o?.color ?? m.color
    return {
      ...m,
      color,
      textColor: o?.color ? readableTextColor(color) : m.textColor,
      hidden: o?.hidden ?? false,
      order: o?.order ?? i,
    }
  })
  merged.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  return merged
}

export function useFamilyMembers(): FamilyMembersState {
  const [members, setMembers] = useState<MemberWithPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const overridesRef = useRef<Overrides>({})

  // On load: discover the iCloud event calendars and build the roster from them,
  // merging persisted overrides. Falls back to DEFAULT_MEMBERS if discovery is
  // unavailable (unconfigured / 501 / error) so the dashboard still renders.
  useEffect(() => {
    let active = true
    Promise.all([
      fetchCalendars().catch(() => null),
      getSetting<Overrides>(OVERRIDES_KEY).catch(() => null),
    ]).then(([calendars, saved]) => {
      if (!active) return
      const overrides = saved && typeof saved === 'object' ? saved : {}
      overridesRef.current = overrides
      const base =
        calendars && calendars.length > 0 ? membersFromCalendars(calendars) : DEFAULT_MEMBERS
      const roster = applyOverrides(base, overrides)
      setMembers(roster)
      setLoading(false)
      // Lazily load avatars for members flagged as having a photo.
      roster.forEach((m) => {
        if (!overrides[m.id]?.photo) return
        getSetting<string>(`${MEMBER_PHOTO_KEY_PREFIX}${m.id}`)
          .then((photo) => {
            if (active && photo) {
              setMembers((prev) => prev.map((x) => (x.id === m.id ? { ...x, photo } : x)))
            }
          })
          .catch(() => {})
      })
    })
    return () => {
      active = false
    }
  }, [])

  const saveMember = useCallback(
    async (id: string, patch: MemberPatch, photo?: string | null) => {
      const prev = overridesRef.current[id] ?? {}
      const nextOverride: MemberOverride = { ...prev }
      if (patch.color !== undefined) nextOverride.color = patch.color
      if (patch.hidden !== undefined) nextOverride.hidden = patch.hidden
      if (patch.order !== undefined) nextOverride.order = patch.order
      if (photo !== undefined) nextOverride.photo = !!photo
      const nextOverrides = { ...overridesRef.current, [id]: nextOverride }
      overridesRef.current = nextOverrides

      setMembers((list) =>
        list.map((m) => {
          if (m.id !== id) return m
          const color = patch.color ?? m.color
          const next: MemberWithPhoto = {
            ...m,
            color,
            textColor: patch.color ? readableTextColor(color) : m.textColor,
            hidden: patch.hidden ?? m.hidden,
            order: patch.order ?? m.order,
          }
          if (photo !== undefined) next.photo = photo ?? undefined
          return next
        }),
      )

      try {
        await putSetting(OVERRIDES_KEY, nextOverrides)
        if (photo !== undefined) {
          await putSetting(`${MEMBER_PHOTO_KEY_PREFIX}${id}`, photo ?? '')
        }
      } catch {
        /* settings store unavailable — the local view still reflects the change */
      }
    },
    [],
  )

  return { members, loading, saveMember }
}
