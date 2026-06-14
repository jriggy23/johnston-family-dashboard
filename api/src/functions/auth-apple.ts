import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { verifyAppleIdentityToken } from '../lib/apple'
import { issueJWT } from '../lib/jwt'

// POST /api/auth/apple
//
// Exchanges an Apple identity token (produced natively by the iOS/tvOS app via
// ASAuthorizationController) for a long-lived HS256 JWT this backend can verify
// on subsequent calls. The web client never hits this endpoint — it uses the
// SWA EasyAuth Apple cookie flow instead.
//
// Apple only returns `fullName`/`email` to the client on FIRST sign-in, so the
// client may forward them in the request body. The identity token itself also
// carries `email` (when the user did not opt to hide it) — we prefer that one
// when both are present since it's authenticated by Apple.

interface AuthAppleRequest {
  identityToken?: unknown
  fullName?: unknown
  email?: unknown
}

function asString(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : undefined
}

export async function authApple(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  if (request.method !== 'POST') {
    return { status: 405, jsonBody: { error: 'method not allowed' } }
  }

  let body: AuthAppleRequest
  try {
    body = (await request.json()) as AuthAppleRequest
  } catch {
    return { status: 400, jsonBody: { error: 'invalid json body' } }
  }

  const identityToken = asString(body.identityToken)
  if (!identityToken) {
    return { status: 400, jsonBody: { error: 'identityToken is required' } }
  }
  const submittedName = asString(body.fullName)
  const submittedEmail = asString(body.email)

  let identity
  try {
    identity = await verifyAppleIdentityToken(identityToken)
  } catch (err) {
    context.warn(`apple identity verification failed: ${String(err)}`)
    return { status: 401, jsonBody: { error: 'apple verification failed' } }
  }

  // Prefer Apple's claim over the client-supplied value.
  const email = identity.email ?? submittedEmail
  const name = submittedName

  try {
    const token = await issueJWT({ sub: identity.sub, name, email })
    return {
      status: 200,
      jsonBody: {
        token,
        principal: {
          userId: identity.sub,
          displayName: name ?? email ?? 'Family',
          email,
        },
      },
    }
  } catch (err) {
    context.error('failed to issue jwt', err)
    return { status: 500, jsonBody: { error: 'internal error' } }
  }
}

app.http('auth-apple', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'auth/apple',
  handler: authApple,
})
