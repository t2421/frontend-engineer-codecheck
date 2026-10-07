import { pathToFileURL } from 'node:url'
import process from 'node:process'
import console from 'node:console'

// Match Wrangler 4.143.1's dashboard configuration reads. Never log bodies or errors.
export async function diagnose({
  token,
  accountId,
  fetchImpl = globalThis.fetch,
  write = console.log,
}) {
  const emit = (endpoint, status, errorCodes) =>
    write(JSON.stringify({ endpoint, status, errorCodes }))

  if (!token || !/^[a-fA-F0-9]{32}$/.test(accountId ?? '')) {
    emit('service-metadata', 0, [])
    return false
  }

  const root = `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers`
  const service = `${root}/services/population-viewer`
  async function read(endpoint, url) {
    let status = 0
    try {
      const response = await fetchImpl(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
        redirect: 'error',
        signal: globalThis.AbortSignal.timeout(10_000),
      })
      status = response.status
      const body = await response.json()
      const errorCodes = Array.isArray(body?.errors)
        ? [
            ...new Set(
              body.errors
                .map((error) => error?.code)
                .filter(
                  (code) =>
                    Number.isSafeInteger(code) &&
                    code >= 0 &&
                    code <= 999_999_999,
                ),
            ),
          ].slice(0, 10)
        : []
      emit(endpoint, status, errorCodes)
      return { ok: response.ok && body?.success === true, result: body?.result }
    } catch {
      emit(endpoint, status, [])
      return { ok: false }
    }
  }

  // Wrangler obtains the environment from this preliminary GET; do not guess it.
  const metadata = await read('service-metadata', service)
  const environment = metadata.result?.default_environment?.environment
  if (
    !metadata.ok ||
    typeof environment !== 'string' ||
    !/^[a-zA-Z0-9_-]{1,64}$/.test(environment)
  )
    return false

  const environmentUrl = `${service}/environments/${environment}`
  const endpoints = [
    ['bindings', `${environmentUrl}/bindings`],
    ['routes', `${environmentUrl}/routes?show_zonename=true`],
    [
      'custom-domains',
      `${root}/domains/records?page=0&per_page=5&service=population-viewer&environment=${environment}`,
    ],
    ['subdomain', `${environmentUrl}/subdomain`],
    ['environment-metadata', environmentUrl],
    ['schedules', `${root}/scripts/population-viewer/schedules`],
  ]
  let success = true
  for (const [endpoint, url] of endpoints) {
    const response = await read(endpoint, url)
    if (!response.ok) success = false
  }
  return success
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const success = await diagnose({
      token: process.env.CLOUDFLARE_API_TOKEN,
      accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    })
    process.exitCode = success ? 0 : 1
  } catch {
    // Also suppress unexpected exception text at the CLI boundary.
    console.log(
      JSON.stringify({
        endpoint: 'service-metadata',
        status: 0,
        errorCodes: [],
      }),
    )
    process.exitCode = 1
  }
}
