import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import * as nodeIcal from 'node-ical'

// Reads iCloud calendars over CalDAV and returns upcoming events (personal +
// any shared calendars in the account). Recurring events are expanded within
// the requested window. Sign in with Apple does NOT grant calendar access, so
// this uses per-account app-specific passwords supplied via app settings.

const ICLOUD_CALDAV_URL = 'https://caldav.icloud.com'
const DEFAULT_DAYS = 14
const MAX_EVENTS = 60

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

export async function calendar(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const accounts = loadAccounts()
  if (accounts.length === 0) {
    return { jsonBody: { source: 'unconfigured', events: [] } }
  }

  const days = Math.min(60, Math.max(1, Number(request.query.get('days') ?? DEFAULT_DAYS) || DEFAULT_DAYS))
  const rangeStart = new Date()
  const rangeEnd = new Date(rangeStart.getTime() + days * 86400_000)

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
