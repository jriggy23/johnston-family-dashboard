// Verifies an Apple identity token (the RS256-signed JWT produced by
// `ASAuthorizationController` on the native iOS/tvOS app) against Apple's
// public JWKS. The `aud` claim must match one of our configured bundle IDs.
//
// `jose` is ESM-only and this project compiles to CommonJS, so we load it via
// a dynamic import. The JWKS object is cached at module scope on first use
// (jose internally caches the fetched keys), so warm workers reuse it.

const APPLE_ISSUER = 'https://appleid.apple.com'
const APPLE_JWKS_URL = 'https://appleid.apple.com/auth/keys'
const DEFAULT_BUNDLE_IDS = 'com.jkcons.johnstondashboard.ios,com.jkcons.johnstondashboard.tvos'

export interface AppleIdentity {
  sub: string
  email?: string
  email_verified?: boolean
  aud: string
}

function allowedAudiences(): string[] {
  const raw = process.env.APPLE_NATIVE_BUNDLE_IDS || DEFAULT_BUNDLE_IDS
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

// Lazily-built JWKS — jose's createRemoteJWKSet caches keys internally so we
// just need one instance per warm worker. Typed as `unknown` since jose is
// ESM-only and we can't reference its types from this CommonJS module without
// resolution-mode attributes; jwtVerify accepts the value structurally.
let jwksPromise: Promise<unknown> | null = null
async function getJwks(): Promise<unknown> {
  if (!jwksPromise) {
    jwksPromise = import('jose').then((m) => m.createRemoteJWKSet(new URL(APPLE_JWKS_URL)))
  }
  return jwksPromise
}

export async function verifyAppleIdentityToken(token: string): Promise<AppleIdentity> {
  const jose = await import('jose')
  const jwks = (await getJwks()) as Parameters<typeof jose.jwtVerify>[1]
  const { payload } = await jose.jwtVerify(token, jwks, {
    issuer: APPLE_ISSUER,
    audience: allowedAudiences(),
  })
  if (!payload.sub) throw new Error('apple token missing subject')
  const aud = Array.isArray(payload.aud) ? payload.aud[0] : payload.aud
  if (typeof aud !== 'string') throw new Error('apple token missing audience')
  return {
    sub: payload.sub,
    email: typeof payload.email === 'string' ? payload.email : undefined,
    email_verified:
      typeof payload.email_verified === 'boolean'
        ? payload.email_verified
        : payload.email_verified === 'true'
          ? true
          : payload.email_verified === 'false'
            ? false
            : undefined,
    aud,
  }
}
