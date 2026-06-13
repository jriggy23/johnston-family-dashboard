import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { TableClient, RestError } from '@azure/data-tables'

// Shared (family-wide) key/value settings stored in Azure Table Storage.
// Used so dashboard config (e.g. the weather cards) syncs across devices and
// family members. /api/* is auth-gated, so only signed-in users can read/write.

const TABLE_NAME = 'settings'
const PARTITION = 'settings'
const VALID_KEY = /^[a-zA-Z0-9_-]{1,64}$/

function getClient(): TableClient | null {
  const conn = process.env.SETTINGS_TABLES_CONNECTION
  if (!conn) return null
  return TableClient.fromConnectionString(conn, TABLE_NAME)
}

interface SettingEntity {
  partitionKey: string
  rowKey: string
  data: string // JSON-stringified value
}

export async function settings(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const key = request.params.key
  if (!key || !VALID_KEY.test(key)) {
    return { status: 400, jsonBody: { error: 'invalid settings key' } }
  }

  const client = getClient()
  if (!client) {
    return { status: 501, jsonBody: { error: 'settings store not configured' } }
  }

  try {
    if (request.method === 'GET') {
      try {
        const entity = await client.getEntity<SettingEntity>(PARTITION, key)
        return { jsonBody: { key, value: JSON.parse(entity.data) } }
      } catch (err) {
        if (err instanceof RestError && err.statusCode === 404) {
          return { jsonBody: { key, value: null } }
        }
        throw err
      }
    }

    if (request.method === 'PUT') {
      const value = await request.json()
      await client.upsertEntity<SettingEntity>(
        { partitionKey: PARTITION, rowKey: key, data: JSON.stringify(value) },
        'Replace',
      )
      return { jsonBody: { key, value } }
    }

    return { status: 405, jsonBody: { error: 'method not allowed' } }
  } catch (err) {
    context.error('settings store error', err)
    return { status: 502, jsonBody: { error: 'settings store error' } }
  }
}

app.http('settings', {
  methods: ['GET', 'PUT'],
  authLevel: 'anonymous',
  route: 'settings/{key}',
  handler: settings,
})
