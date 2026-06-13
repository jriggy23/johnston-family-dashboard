#!/usr/bin/env node
// Generate the Apple "client secret" — an ES256 JWT used as APPLE_CLIENT_SECRET
// for Sign in with Apple. Apple caps its lifetime at 6 months, so re-run this
// before expiry and update the SWA app setting.
//
// Reads config from the environment (or a local .env file):
//   APPLE_TEAM_ID, APPLE_CLIENT_ID (Services ID), APPLE_KEY_ID, APPLE_KEY_PATH
//
// Prints ONLY the JWT to stdout, so it can be piped/captured without exposure:
//   node scripts/generate-apple-client-secret.mjs
//
import { sign as cryptoSign, createPrivateKey } from 'node:crypto'
import { readFileSync, existsSync } from 'node:fs'

// Minimal .env loader (does not override already-set process.env vars).
function loadDotEnv(path = '.env') {
  if (!existsSync(path)) return
  for (const raw of readFileSync(path, 'utf8').split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    const val = line.slice(eq + 1).trim()
    if (!(key in process.env)) process.env[key] = val
  }
}

function b64url(input) {
  return Buffer.from(input).toString('base64url')
}

function die(msg) {
  console.error(`error: ${msg}`)
  process.exit(1)
}

loadDotEnv()

const teamId = process.env.APPLE_TEAM_ID
const clientId = process.env.APPLE_CLIENT_ID // Services ID
const keyId = process.env.APPLE_KEY_ID
const keyPath = process.env.APPLE_KEY_PATH

for (const [name, val] of Object.entries({ APPLE_TEAM_ID: teamId, APPLE_CLIENT_ID: clientId, APPLE_KEY_ID: keyId, APPLE_KEY_PATH: keyPath })) {
  if (!val) die(`missing ${name}`)
}
if (!existsSync(keyPath)) die(`key file not found: ${keyPath}`)

const privateKey = createPrivateKey(readFileSync(keyPath))

const now = Math.floor(Date.now() / 1000)
const SIX_MONTHS = 86400 * 180 // < Apple's 15777000s (≈182.6 days) cap

const header = { alg: 'ES256', kid: keyId, typ: 'JWT' }
const payload = {
  iss: teamId,
  iat: now,
  exp: now + SIX_MONTHS,
  aud: 'https://appleid.apple.com',
  sub: clientId,
}

const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`
// JOSE requires the raw R||S signature (IEEE P1363), not DER.
const signature = cryptoSign('sha256', Buffer.from(signingInput), {
  key: privateKey,
  dsaEncoding: 'ieee-p1363',
})

process.stdout.write(`${signingInput}.${signature.toString('base64url')}\n`)
// Note to stderr so it doesn't pollute the captured token:
const expDate = new Date((now + SIX_MONTHS) * 1000).toISOString().slice(0, 10)
console.error(`generated APPLE_CLIENT_SECRET (sub=${clientId}, exp=${expDate})`)
