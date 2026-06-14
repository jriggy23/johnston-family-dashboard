import type { HttpRequest } from '@azure/functions'
import { verifyJWT } from './jwt'

// Resolves the calling principal from one of two auth schemes:
//   - Native (iOS/tvOS): `Authorization: Bearer <our HS256 JWT>`
//   - Web (SWA EasyAuth):  `x-ms-client-principal` header containing a
//     base64-encoded JSON principal injected by the SWA gateway.
// Returns null if neither path produces an authenticated user — Functions can
// then early-return 401 to keep the gate uniform.

export interface Principal {
  identityProvider: 'apple' | 'swa'
  userId: string
  email?: string
  name?: string
}

interface SwaClientPrincipal {
  identityProvider?: string
  userId?: string
  userDetails?: string
  userRoles?: string[]
  claims?: Array<{ typ?: string; val?: string }>
}

function parseBearer(authorization: string | null | undefined): string | null {
  if (!authorization) return null
  const m = /^Bearer\s+(.+)$/i.exec(authorization.trim())
  return m ? m[1].trim() : null
}

function parseSwaPrincipal(value: string | null | undefined): SwaClientPrincipal | null {
  if (!value) return null
  try {
    const decoded = Buffer.from(value, 'base64').toString()
    return JSON.parse(decoded) as SwaClientPrincipal
  } catch {
    return null
  }
}

function findClaim(principal: SwaClientPrincipal, types: string[]): string | undefined {
  for (const claim of principal.claims ?? []) {
    if (claim.typ && types.includes(claim.typ) && typeof claim.val === 'string' && claim.val) {
      return claim.val
    }
  }
  return undefined
}

export async function principalFor(request: HttpRequest): Promise<Principal | null> {
  // 1. Native Bearer JWT (iOS/tvOS app post-Sign-in-with-Apple).
  const bearer = parseBearer(request.headers.get('authorization'))
  if (bearer) {
    try {
      const claims = await verifyJWT(bearer)
      return {
        identityProvider: 'apple',
        userId: claims.sub,
        email: claims.email,
        name: claims.name,
      }
    } catch {
      // Fall through — invalid Bearer shouldn't mask a valid SWA cookie.
    }
  }

  // 2. SWA EasyAuth client principal (web).
  const swa = parseSwaPrincipal(request.headers.get('x-ms-client-principal'))
  if (swa && Array.isArray(swa.userRoles) && swa.userRoles.includes('authenticated') && swa.userId) {
    const email =
      findClaim(swa, [
        'emails',
        'email',
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
      ]) || (swa.userDetails && swa.userDetails.includes('@') ? swa.userDetails : undefined)
    const name =
      findClaim(swa, [
        'name',
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name',
      ]) || (swa.userDetails && !swa.userDetails.includes('@') ? swa.userDetails : undefined)
    return {
      identityProvider: 'swa',
      userId: swa.userId,
      email,
      name,
    }
  }

  return null
}
