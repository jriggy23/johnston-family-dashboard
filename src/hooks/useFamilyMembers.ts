import { useCallback, useEffect, useState } from 'react'
import { getSetting, putSetting } from '../api/client'
import { DEFAULT_MEMBERS, FAMILY_MEMBERS_KEY, MEMBER_PHOTO_KEY_PREFIX } from '../data/members'
import type { FamilyCalendarMember } from '../types'

// A roster member plus its loaded avatar (data-URL). Photos live under their own
// settings key (memberPhoto_<id>) so the roster setting stays small.
export interface MemberWithPhoto extends FamilyCalendarMember {
  photo?: string
}

export interface FamilyMembersState {
  members: MemberWithPhoto[]
  loading: boolean
  // Update a member's fields and/or avatar. Pass `photo` as a data-URL to set,
  // null to clear, or omit to leave the photo unchanged. Persists to the
  // settings store (best-effort) and updates the local view immediately.
  saveMember: (
    id: string,
    patch: Partial<FamilyCalendarMember>,
    photo?: string | null,
  ) => Promise<void>
}

function toRoster(members: MemberWithPhoto[]): FamilyCalendarMember[] {
  return members.map((m) => ({
    id: m.id,
    name: m.name,
    initials: m.initials,
    calendarSource: m.calendarSource,
    color: m.color,
    textColor: m.textColor,
    photoKey: m.photoKey,
  }))
}

export function useFamilyMembers(): FamilyMembersState {
  const [members, setMembers] = useState<MemberWithPhoto[]>(DEFAULT_MEMBERS)
  const [loading, setLoading] = useState(true)

  // Load the saved roster once, then lazily load each member's avatar. Falls
  // back to the default roster if the settings store is unavailable (501).
  useEffect(() => {
    let active = true
    getSetting<FamilyCalendarMember[]>(FAMILY_MEMBERS_KEY)
      .then((saved) => {
        if (!active) return
        const roster = Array.isArray(saved) && saved.length > 0 ? saved : DEFAULT_MEMBERS
        setMembers(roster)
        setLoading(false)
        roster
          .filter((m) => m.photoKey)
          .forEach((m) => {
            getSetting<string>(m.photoKey as string)
              .then((photo) => {
                if (active && photo) {
                  setMembers((prev) => prev.map((x) => (x.id === m.id ? { ...x, photo } : x)))
                }
              })
              .catch(() => {})
          })
      })
      .catch(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const saveMember = useCallback(
    async (id: string, patch: Partial<FamilyCalendarMember>, photo?: string | null) => {
      let nextRoster: FamilyCalendarMember[] = []
      setMembers((prev) => {
        const updated = prev.map((m) => {
          if (m.id !== id) return m
          const merged: MemberWithPhoto = { ...m, ...patch }
          if (photo !== undefined) {
            merged.photo = photo ?? undefined
            merged.photoKey = photo ? `${MEMBER_PHOTO_KEY_PREFIX}${id}` : undefined
          }
          return merged
        })
        nextRoster = toRoster(updated)
        return updated
      })
      try {
        await putSetting(FAMILY_MEMBERS_KEY, nextRoster)
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
