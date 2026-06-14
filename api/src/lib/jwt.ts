// Self-issued HS256 JWTs used by the native iOS/tvOS app once the user has
// completed Sign in with Apple. The web client continues to use the SWA
// EasyAuth cookie + `x-ms-client-principal` header, so this token type is only
// produced/consumed for the native flow.
//
// `jose` is ESM-only and this project compiles to CommonJS, so we load it via
// a dynamic import (same pattern `calendar.ts` uses for `tsdav`).

const ISSUER = 'johnston-dashboard'
const AUDIENCE = 'johnston-dashboard-native'
const LIFETIME = '30d'

interface IssueArgs {
  sub: string
  name?: string
  email?: string
}

export interface JWTPrincipal {
  sub: string
  name?: string
  email?: string
}

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SIGNING_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SIGNING_SECRET is not configured (must be 32+ chars)')
  }
  return new TextEncoder().encode(secret)
}

export async function issueJWT({ sub, name, email }: IssueArgs): Promise<string> {
  const { SignJWT } = await import('jose')
  const payload: Record<string, unknown> = {}
  if (name) payload.name = name
  if (email) payload.email = email
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(sub)
    .setIssuedAt()
    .setExpirationTime(LIFETIME)
    .sign(getSecret())
}

export async function verifyJWT(token: string): Promise<JWTPrincipal> {
  const { jwtVerify } = await import('jose')
  const { payload } = await jwtVerify(token, getSecret(), {
    issuer: ISSUER,
    audience: AUDIENCE,
  })
  if (!payload.sub) throw new Error('jwt missing subject')
  return {
    sub: payload.sub,
    name: typeof payload.name === 'string' ? payload.name : undefined,
    email: typeof payload.email === 'string' ? payload.email : undefined,
  }
}
