// Pure, side-effect-free helpers for turning iCloud CardDAV vCard payloads into a
// name -> photo lookup, and for matching a discovered calendar owner to the right
// contact. Kept separate from the HTTP function (calendar-photo.ts) so it can be
// unit-tested without the Azure Functions host or any network access.

export interface ParsedContact {
  fn: string // formatted name, e.g. "John Johnston"
  given: string // given name, e.g. "John"
  family: string // surname, e.g. "Johnston"
  // Normalized image data-URL ("data:image/jpeg;base64,...") when the vCard
  // embeds a photo we can use; undefined for remote-only or photo-less contacts.
  photo?: string
}

// vCard property header parsed into a name + its parameters. Params are stored
// lower-cased; a bare param (no '=') maps to `true`.
interface VCardProperty {
  name: string
  params: Record<string, string | true>
  value: string
}

// Map a vCard TYPE token (JPEG/PNG/GIF/…) to an image MIME subtype.
function imageSubtype(type?: string): string {
  const t = (type ?? '').toLowerCase()
  if (t.includes('png')) return 'png'
  if (t.includes('gif')) return 'gif'
  if (t.includes('webp')) return 'webp'
  return 'jpeg'
}

// Turn a PHOTO property into a normalized image data-URL, or null when it can't
// be embedded inline (remote URI, or an unrecognized value).
//   - vCard 3.0:  PHOTO;ENCODING=b;TYPE=JPEG:<base64>
//   - vCard 4.0:  PHOTO:data:image/jpeg;base64,<base64>
//   - remote:     PHOTO;VALUE=uri:https://…  -> skipped (null)
export function photoToDataUrl(params: Record<string, string | true>, rawValue: string): string | null {
  const value = rawValue.trim()
  if (!value) return null

  // Already a data: URI (vCard 4.0) — strip internal whitespace and pass through.
  if (/^data:/i.test(value)) {
    const cleaned = value.replace(/\s+/g, '')
    return /^data:image\//i.test(cleaned) ? cleaned : null
  }

  // Remote photo — skip (we don't fetch arbitrary URLs here).
  if (/^https?:/i.test(value)) return null

  // Otherwise treat as inline base64 (ENCODING=b / BASE64, or bare base64 blob).
  const encoding = String(params['encoding'] ?? '').toLowerCase()
  const looksBase64 = encoding === 'b' || encoding === 'base64' || /^[A-Za-z0-9+/=\s]+$/.test(value)
  if (!looksBase64) return null

  const base64 = value.replace(/\s+/g, '')
  if (!base64) return null
  const subtype = imageSubtype(typeof params['type'] === 'string' ? (params['type'] as string) : undefined)
  return `data:image/${subtype};base64,${base64}`
}

// Split a single property header (everything before the first ':') into a name
// and its parameters. e.g. "PHOTO;ENCODING=b;TYPE=JPEG" -> name PHOTO, params.
function parseHeader(header: string): { name: string; params: Record<string, string | true> } {
  const parts = header.split(';')
  const name = parts[0].trim().toUpperCase()
  const params: Record<string, string | true> = {}
  for (const p of parts.slice(1)) {
    const eq = p.indexOf('=')
    if (eq === -1) {
      params[p.trim().toLowerCase()] = true
    } else {
      params[p.slice(0, eq).trim().toLowerCase()] = p.slice(eq + 1).trim().replace(/^"|"$/g, '')
    }
  }
  return { name, params }
}

// Unfold a vCard (RFC 6350 line folding: a CRLF followed by a space/tab is a
// continuation) and split into individual property lines.
function unfoldLines(block: string): string[] {
  return block
    .replace(/\r\n/g, '\n')
    .replace(/\n[ \t]/g, '') // join folded continuations
    .split('\n')
    .filter((l) => l.length > 0)
}

function toProperties(block: string): VCardProperty[] {
  const props: VCardProperty[] = []
  for (const line of unfoldLines(block)) {
    const colon = line.indexOf(':')
    if (colon === -1) continue
    const { name, params } = parseHeader(line.slice(0, colon))
    props.push({ name, params, value: line.slice(colon + 1) })
  }
  return props
}

// Unescape a vCard structured-value component (\, \; \n etc.).
function unescape(v: string): string {
  return v.replace(/\\([;,\\nN])/g, (_, c) => (c === 'n' || c === 'N' ? '\n' : c)).trim()
}

// Parse one vCard block into a ParsedContact. Returns null if it has no usable
// name. The N property (Family;Given;…) is preferred for given/family; FN is the
// display fallback and is also split when N is absent.
export function parseVCard(block: string): ParsedContact | null {
  const props = toProperties(block)
  let fn = ''
  let given = ''
  let family = ''
  let photo: string | undefined

  for (const p of props) {
    if (p.name === 'FN' && !fn) {
      fn = unescape(p.value)
    } else if (p.name === 'N') {
      const comps = p.value.split(';')
      family = unescape(comps[0] ?? '')
      given = unescape(comps[1] ?? '')
    } else if (p.name === 'PHOTO' && !photo) {
      photo = photoToDataUrl(p.params, p.value) ?? undefined
    }
  }

  if (!fn && (given || family)) fn = `${given} ${family}`.trim()
  if (!fn) return null

  if (!given && !family) {
    // Derive from FN: first token is given, last is family.
    const words = fn.split(/\s+/).filter(Boolean)
    given = words[0] ?? ''
    family = words.length > 1 ? words[words.length - 1] : ''
  }

  return { fn, given, family, photo }
}

// Parse a payload that may contain one or more concatenated vCards.
export function parseVCards(data: string): ParsedContact[] {
  const blocks = data.match(/BEGIN:VCARD[\s\S]*?END:VCARD/gi) ?? []
  const out: ParsedContact[] = []
  for (const b of blocks) {
    const c = parseVCard(b)
    if (c) out.push(c)
  }
  return out
}

const norm = (s: string): string => s.trim().toLowerCase()

// Score how well a contact matches a calendar owner's display name. Higher wins.
// The intent: prefer an exact "<calendarName> <familySurname>" record, then a
// looser given-name match, and never return 0-scored (non-)matches.
export function scoreContact(contact: ParsedContact, calName: string, familySurname: string): number {
  const cal = norm(calName)
  const given = norm(contact.given)
  const family = norm(contact.family)
  const surname = norm(familySurname)
  if (!cal) return 0
  const familyMatches = surname.length > 0 && family === surname

  if (given === cal && familyMatches) return 100
  if (given === cal) return 80
  if (given.startsWith(cal) && familyMatches) return 70
  if (given.startsWith(cal)) return 50
  if (familyMatches && (given.includes(cal) || cal.includes(given))) return 40
  if (given.includes(cal)) return 30
  return 0
}

// Pick the best contact for a calendar display name, requiring `requirePhoto`
// when set (so a name-only match without a usable photo falls back to initials).
// Returns undefined when nothing scores above zero. Ties break toward the
// family-surname match, then the shorter given name (the most "exact" record).
export function matchContact(
  calName: string,
  contacts: ParsedContact[],
  familySurname: string,
  requirePhoto = true,
): ParsedContact | undefined {
  let best: ParsedContact | undefined
  let bestScore = 0
  for (const c of contacts) {
    if (requirePhoto && !c.photo) continue
    const score = scoreContact(c, calName, familySurname)
    if (score === 0) continue
    if (
      score > bestScore ||
      (score === bestScore && best && c.given.length < best.given.length)
    ) {
      best = c
      bestScore = score
    }
  }
  return best
}
