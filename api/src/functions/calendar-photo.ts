import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { matchContact, parseVCards, type ParsedContact } from '../lib/contacts'
import { principalFor } from '../lib/auth'

// GET /api/calendar-photo?cal=<calendar display name>
//
// Resolves a family-member avatar from the iCloud Contacts (CardDAV) photo of the
// matching person, reusing the same ICLOUD_ACCOUNTS app-specific credentials that
// CalDAV uses. Streams a small (≈128px) JPEG with long cache headers. Returns 404
// when there's no matching contact or the contact has no embedded photo, so the
// frontend cleanly falls back to colored initials. No credentials are ever
// returned. Contacts are fetched lazily and cached in module scope per warm
// instance, so the calendars list stays fast and we don't refetch on every hit.

const ICLOUD_CARDDAV_URL = 'https://contacts.icloud.com'
const CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes per warm instance
const MAX_PHOTO_BYTES = 5 * 1024 * 1024 // ignore absurdly large embedded blobs
const TARGET_PX = 128

interface IcloudAccount {
  label?: string
  username: string
  appPassword: string
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
      /* fall through */
    }
  }
  if (process.env.ICLOUD_USERNAME && process.env.ICLOUD_APP_PASSWORD) {
    return [{ username: process.env.ICLOUD_USERNAME, appPassword: process.env.ICLOUD_APP_PASSWORD }]
  }
  return []
}

// The family surname used to disambiguate "John Johnston" from any other "John".
function familySurname(): string {
  return (process.env.CONTACTS_FAMILY_SURNAME || 'Johnston').trim()
}

// --- Contact fetching + caching ---------------------------------------------

let cache: { contacts: ParsedContact[]; ts: number } | null = null
let inflight: Promise<ParsedContact[]> | null = null

async function fetchAllContacts(context: InvocationContext): Promise<ParsedContact[]> {
  const accounts = loadAccounts()
  if (accounts.length === 0) return []

  const { createDAVClient } = await import('tsdav')
  const all: ParsedContact[] = []

  for (const account of accounts) {
    try {
      const client = await createDAVClient({
        serverUrl: ICLOUD_CARDDAV_URL,
        credentials: { username: account.username, password: account.appPassword },
        authMethod: 'Basic',
        defaultAccountType: 'carddav',
      })
      const addressBooks = await client.fetchAddressBooks()
      for (const addressBook of addressBooks) {
        try {
          const vcards = await client.fetchVCards({ addressBook })
          for (const v of vcards) {
            if (typeof v.data === 'string') all.push(...parseVCards(v.data))
          }
        } catch (err) {
          context.warn(`address book fetch failed: ${String(err)}`)
        }
      }
    } catch (err) {
      context.warn(`CardDAV account "${account.label ?? 'account'}" failed: ${String(err)}`)
    }
  }
  return all
}

function getContacts(context: InvocationContext): Promise<ParsedContact[]> {
  if (cache && Date.now() - cache.ts < CACHE_TTL_MS) return Promise.resolve(cache.contacts)
  if (inflight) return inflight
  inflight = fetchAllContacts(context)
    .then((contacts) => {
      cache = { contacts, ts: Date.now() }
      inflight = null
      return contacts
    })
    .catch((err) => {
      inflight = null
      throw err
    })
  return inflight
}

// --- Image normalization -----------------------------------------------------

// Split a data:image/...;base64,... URL into its MIME type and raw bytes.
function decodeDataUrl(dataUrl: string): { mime: string; buf: Buffer } | null {
  const m = /^data:(image\/[a-z0-9.+-]+);base64,(.*)$/i.exec(dataUrl)
  if (!m) return null
  try {
    const buf = Buffer.from(m[2], 'base64')
    if (buf.length === 0 || buf.length > MAX_PHOTO_BYTES) return null
    return { mime: m[1].toLowerCase(), buf }
  } catch {
    return null
  }
}

// Downscale to a small square JPEG when `sharp` is available. sharp is an
// optional dependency loaded via a non-literal specifier so the API still
// type-checks and runs (serving the original bytes) when it isn't installed.
async function downscale(buf: Buffer, mime: string): Promise<{ buf: Buffer; mime: string }> {
  try {
    const specifier = 'sharp'
    const mod = (await import(specifier)) as { default?: unknown } & Record<string, unknown>
    const sharp = (mod.default ?? mod) as (input: Buffer) => {
      resize: (w: number, h: number, opts: { fit: 'cover' }) => {
        jpeg: (opts: { quality: number }) => { toBuffer: () => Promise<Buffer> }
      }
    }
    const out = await sharp(buf)
      .resize(TARGET_PX, TARGET_PX, { fit: 'cover' })
      .jpeg({ quality: 80 })
      .toBuffer()
    return { buf: out, mime: 'image/jpeg' }
  } catch {
    return { buf, mime } // sharp unavailable — serve original bytes
  }
}

// --- Handler -----------------------------------------------------------------

const notFound: HttpResponseInit = { status: 404, body: '' }

export async function calendarPhoto(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const principal = await principalFor(request)
  if (!principal) return { status: 401, jsonBody: { error: 'unauthorized' } }

  const calName = (request.query.get('cal') ?? request.query.get('name') ?? '').trim()
  if (!calName) return notFound

  let contacts: ParsedContact[]
  try {
    contacts = await getContacts(context)
  } catch (err) {
    context.warn(`contacts unavailable: ${String(err)}`)
    return notFound // never break the page — frontend falls back to initials
  }

  const match = matchContact(calName, contacts, familySurname(), true)
  if (!match || !match.photo) return notFound

  const decoded = decodeDataUrl(match.photo)
  if (!decoded) return notFound

  const { buf, mime } = await downscale(decoded.buf, decoded.mime)
  return {
    status: 200,
    headers: {
      'content-type': mime,
      'cache-control': 'public, max-age=86400',
    },
    body: new Uint8Array(buf),
  }
}

app.http('calendar-photo', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'calendar-photo',
  handler: calendarPhoto,
})
