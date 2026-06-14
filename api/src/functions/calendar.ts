import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import * as nodeIcal from 'node-ical'
import { principalFor } from '../lib/auth'

// Reads iCloud calendars over CalDAV and returns upcoming events (personal +
// any shared calendars in the account). Recurring events are expanded within
// the requested window. Sign in with Apple does NOT grant calendar access, so
// this uses per-account app-specific passwords supplied via app settings.

const ICLOUD_CALDAV_URL = 'https://caldav.icloud.com'
const DEFAULT_DAYS = 14
const MAX_EVENTS = 60
const MAX_RANGE_DAYS = 60 // cap any explicit start/end span

interface IcloudAccount {
  label?: string
  username: string
  appPassword: string
}

// Event shape returned to the client (times are ISO; the client formats them in
// the viewer's local timezone).
interface CalendarEventDto {
  id: string
  title: string
  start: string
  end?: string
  allDay: boolean
  location?: string
  calendar: string // source calendar display name (used to attribute to a member)
  calendarId?: string // stable calendar URL, for robust matching across renames
  color?: string
}

function loadAccounts(): IcloudAccount[] {
  const raw = process.env.ICLOUD_ACCOUNTS
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as IcloudAccount[]
      if (Array.isArray(parsed)) {
        return parsed.filter((a) => a && a.username && a.appPassword)
      }
    } catch {
      // fall through to single-account env vars
    }
  }
  if (process.env.ICLOUD_USERNAME && process.env.ICLOUD_APP_PASSWORD) {
    return [{ username: process.env.ICLOUD_USERNAME, appPassword: process.env.ICLOUD_APP_PASSWORD }]
  }
  return []
}

// node-ical's event types are loose; treat occurrences pragmatically.
type IcalEvent = {
  type: string
  uid?: string
  summary?: string
  location?: string
  start: Date & { tz?: string }
  end?: Date
  datetype?: string
  rrule?: { between(after: Date, before: Date, inc?: boolean): Date[] }
  exdate?: Record<string, Date>
  recurrences?: Record<string, IcalEvent>
}

function toDto(
  ev: IcalEvent,
  start: Date,
  end: Date | undefined,
  meta: { name: string; color?: string; id?: string },
): CalendarEventDto {
  return {
    id: `${ev.uid ?? 'evt'}-${start.toISOString()}`,
    title: ev.summary?.trim() || '(no title)',
    start: start.toISOString(),
    end: end?.toISOString(),
    allDay: ev.datetype === 'date',
    location: ev.location?.trim() || undefined,
    calendar: meta.name,
    calendarId: meta.id,
    color: meta.color,
  }
}

// Expand a single VEVENT into concrete instances that fall inside [start, end].
function expandEvent(
  ev: IcalEvent,
  rangeStart: Date,
  rangeEnd: Date,
  meta: { name: string; color?: string; id?: string },
  out: CalendarEventDto[],
): void {
  const durationMs = ev.end ? ev.end.getTime() - ev.start.getTime() : 0

  if (!ev.rrule) {
    if (ev.start >= rangeStart && ev.start <= rangeEnd) {
      out.push(toDto(ev, ev.start, ev.end, meta))
    }
    return
  }

  for (const occ of ev.rrule.between(rangeStart, rangeEnd, true)) {
    const key = occ.toISOString().slice(0, 10)
    if (ev.exdate && ev.exdate[key]) continue // cancelled instance

    const override = ev.recurrences && ev.recurrences[key]
    if (override) {
      out.push(toDto(override, override.start, override.end, meta))
    } else {
      out.push(toDto(ev, occ, new Date(occ.getTime() + durationMs), meta))
    }
  }
}

async function fetchAccountEvents(
  account: IcloudAccount,
  rangeStart: Date,
  rangeEnd: Date,
  context: InvocationContext,
): Promise<CalendarEventDto[]> {
  // tsdav is ESM-only; load it dynamically from this CommonJS module.
  const { createDAVClient } = await import('tsdav')
  const client = await createDAVClient({
    serverUrl: ICLOUD_CALDAV_URL,
    credentials: { username: account.username, password: account.appPassword },
    authMethod: 'Basic',
    defaultAccountType: 'caldav',
  })

  const calendars = await client.fetchCalendars()
  const events: CalendarEventDto[] = []

  for (const cal of calendars) {
    // Only collections that hold events.
    const comps = (cal.components as string[] | undefined) ?? []
    if (comps.length && !comps.includes('VEVENT')) continue

    const name =
      typeof cal.displayName === 'string' && cal.displayName ? cal.displayName : 'Calendar'
    const color = typeof cal.calendarColor === 'string' ? cal.calendarColor : undefined
    const id = typeof cal.url === 'string' ? cal.url : undefined

    let objects
    try {
      objects = await client.fetchCalendarObjects({
        calendar: cal,
        timeRange: { start: rangeStart.toISOString(), end: rangeEnd.toISOString() },
      })
    } catch (err) {
      context.warn(`calendar "${name}" fetch failed: ${String(err)}`)
      continue
    }

    for (const obj of objects) {
      if (!obj.data) continue
      const parsed = nodeIcal.sync.parseICS(obj.data) as Record<string, IcalEvent>
      for (const v of Object.values(parsed)) {
        if (v.type !== 'VEVENT' || !v.start) continue
        expandEvent(v, rangeStart, rangeEnd, { name, color, id }, events)
      }
    }
  }

  return events
}

// Resolve the fetch window. An explicit `start`+`end` (ISO) is used when valid
// (clamped to MAX_RANGE_DAYS) so the client can request any week, past or
// future; otherwise fall back to [now, now + `days`].
function resolveRange(request: HttpRequest): { rangeStart: Date; rangeEnd: Date } {
  const startParam = request.query.get('start')
  const endParam = request.query.get('end')
  if (startParam && endParam) {
    const s = new Date(startParam)
    const e = new Date(endParam)
    if (!Number.isNaN(s.getTime()) && !Number.isNaN(e.getTime()) && e.getTime() > s.getTime()) {
      const maxEnd = new Date(s.getTime() + MAX_RANGE_DAYS * 86400_000)
      return { rangeStart: s, rangeEnd: e.getTime() > maxEnd.getTime() ? maxEnd : e }
    }
  }
  const days = Math.min(
    MAX_RANGE_DAYS,
    Math.max(1, Number(request.query.get('days') ?? DEFAULT_DAYS) || DEFAULT_DAYS),
  )
  const rangeStart = new Date()
  return { rangeStart, rangeEnd: new Date(rangeStart.getTime() + days * 86400_000) }
}

export async function calendar(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const principal = await principalFor(request)
  if (!principal) return { status: 401, jsonBody: { error: 'unauthorized' } }

  const accounts = loadAccounts()
  if (accounts.length === 0) {
    return { jsonBody: { source: 'unconfigured', events: [] } }
  }

  const { rangeStart, rangeEnd } = resolveRange(request)

  const all: CalendarEventDto[] = []
  let failures = 0
  for (const account of accounts) {
    try {
      all.push(...(await fetchAccountEvents(account, rangeStart, rangeEnd, context)))
    } catch (err) {
      failures++
      context.error(`iCloud account "${account.label ?? account.username}" failed: ${String(err)}`)
    }
  }

  if (all.length === 0 && failures > 0) {
    return { status: 502, jsonBody: { error: 'calendar upstream error' } }
  }

  // Dedupe (same instance can appear via overlapping shared calendars) and sort.
  const seen = new Set<string>()
  const events = all
    .filter((e) => (seen.has(e.id) ? false : seen.add(e.id)))
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, MAX_EVENTS)

  return { jsonBody: { source: 'icloud', events } }
}

app.http('calendar', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'calendar',
  handler: calendar,
})

// --- Calendar discovery -------------------------------------------------------
// Read-only listing of the event calendars visible in the configured iCloud
// account(s), so the family roster's `calendarSource` values can be aligned to
// the real shared-calendar names. No credentials are returned.

interface CalendarInfoDto {
  name: string
  color?: string
  id?: string // calendar URL
  account: string // friendly label, never the raw Apple ID
}

function normalizeColor(color?: string): string | undefined {
  if (!color) return undefined
  return /^#[0-9a-f]{8}$/i.test(color) ? color.slice(0, 7) : color
}

async function fetchAccountCalendars(
  account: IcloudAccount,
  accountLabel: string,
): Promise<CalendarInfoDto[]> {
  const { createDAVClient } = await import('tsdav')
  const client = await createDAVClient({
    serverUrl: ICLOUD_CALDAV_URL,
    credentials: { username: account.username, password: account.appPassword },
    authMethod: 'Basic',
    defaultAccountType: 'caldav',
  })

  const calendars = await client.fetchCalendars()
  return calendars
    .filter((cal) => {
      const comps = (cal.components as string[] | undefined) ?? []
      return comps.length === 0 || comps.includes('VEVENT')
    })
    .map((cal) => ({
      name:
        typeof cal.displayName === 'string' && cal.displayName ? cal.displayName : 'Calendar',
      color: normalizeColor(typeof cal.calendarColor === 'string' ? cal.calendarColor : undefined),
      id: typeof cal.url === 'string' ? cal.url : undefined,
      account: accountLabel,
    }))
}

export async function calendars(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const principal = await principalFor(request)
  if (!principal) return { status: 401, jsonBody: { error: 'unauthorized' } }

  const accounts = loadAccounts()
  if (accounts.length === 0) {
    return { jsonBody: { source: 'unconfigured', calendars: [] } }
  }

  const all: CalendarInfoDto[] = []
  let failures = 0
  for (let i = 0; i < accounts.length; i++) {
    const label = accounts[i].label ?? `Account ${i + 1}`
    try {
      all.push(...(await fetchAccountCalendars(accounts[i], label)))
    } catch (err) {
      failures++
      context.error(`iCloud account "${label}" calendar discovery failed: ${String(err)}`)
    }
  }

  if (all.length === 0 && failures > 0) {
    return { status: 502, jsonBody: { error: 'calendar upstream error' } }
  }

  return { jsonBody: { source: 'icloud', calendars: all } }
}

app.http('calendars', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'calendars',
  handler: calendars,
})
