// Client for Azure Static Web Apps managed authentication.
//
// On the deployed SWA (and under the SWA CLI emulator) the signed-in user is
// exposed at /.auth/me. Under a plain `vite dev` server that endpoint does not
// exist, so we report it as "unavailable" and the AuthContext falls back to a
// dev stub so the dashboard stays usable while working on the UI in isolation.

export interface ClientPrincipal {
  identityProvider: string
  userId: string
  userDetails: string
  userRoles: string[]
  claims?: { typ: string; val: string }[]
}

export type AuthResult =
  | { kind: 'authenticated'; user: ClientPrincipal }
  | { kind: 'anonymous' }
  | { kind: 'unavailable' }

interface AuthMeResponse {
  clientPrincipal: ClientPrincipal | null
}

export async function getUser(): Promise<AuthResult> {
  try {
    const res = await fetch('/.auth/me', {
      headers: { accept: 'application/json' },
    })
    if (!res.ok) return { kind: 'unavailable' }

    // A plain vite dev server answers unknown routes with index.html (HTML),
    // which is not valid JSON — treat that as "auth endpoint not present".
    const contentType = res.headers.get('content-type') ?? ''
    if (!contentType.includes('application/json')) return { kind: 'unavailable' }

    const body = (await res.json()) as AuthMeResponse
    return body.clientPrincipal
      ? { kind: 'authenticated', user: body.clientPrincipal }
      : { kind: 'anonymous' }
  } catch {
    return { kind: 'unavailable' }
  }
}

// Prefer a human name claim if Apple supplied one, otherwise the email/userDetails.
export function displayName(user: ClientPrincipal): string {
  const nameClaim = user.claims?.find(
    (c) => c.typ === 'name' || c.typ.endsWith('/identity/claims/name'),
  )
  return nameClaim?.val || user.userDetails || 'Signed in'
}

export const LOGIN_PATH = '/login'
export const LOGOUT_PATH = '/logout'
