import process from 'node:process'
import { setTimeout } from 'node:timers/promises'
import { URL, pathToFileURL } from 'node:url'

const maxAttempts = 10
const totalTimeoutMs = 45_000
const requestTimeoutMs = 3000
const retryDelayMs = 2000
const retryableStatuses = new Set([404, 408, 429, 500, 502, 503, 504])
const transientErrorNames = new Set(['TypeError', 'TimeoutError', 'AbortError'])

function isHeadSha(value) {
  return /^[a-f0-9]{40}$/.test(value)
}

function isBareHttpsOrigin(url) {
  return (
    url.protocol === 'https:' &&
    !url.username &&
    !url.password &&
    url.pathname === '/' &&
    !url.search &&
    !url.hash
  )
}

function isHtmlResponse(response) {
  const contentType = response.headers.get('content-type') ?? ''
  return /^text\/html(?:\s*;|$)/i.test(contentType)
}

export function previewAppUrl(baseUrl, sha) {
  const base = new URL(baseUrl)
  if (!isBareHttpsOrigin(base) || !isHeadSha(sha))
    throw new Error('Expected HTTPS Preview origin and exact head SHA')
  return `${base.origin}/performance/${sha}/`
}

// Trusted main code only. Fetch public HTML as data; never execute PR assets.
export async function waitForPreview(
  baseUrl,
  sha,
  {
    request = globalThis.fetch,
    now = Date.now,
    delay = setTimeout,
    log = (message) => process.stderr.write(`${message}\n`),
  } = {},
) {
  const url = previewAppUrl(baseUrl, sha)
  const deadline = now() + totalTimeoutMs
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const remaining = deadline - now()
    if (remaining <= 0) break
    let outcome
    try {
      const response = await request(url, {
        redirect: 'manual',
        signal: globalThis.AbortSignal.timeout(
          Math.min(requestTimeoutMs, remaining),
        ),
      })
      await response.body?.cancel()
      if (response.url !== url)
        throw new Error('Preview response URL differs from exact SHA URL')
      outcome = response.status
      if (response.status === 200) {
        if (!isHtmlResponse(response))
          throw new Error('Preview response is not HTML')
        if (now() >= deadline) break
        return url
      }
      if (!retryableStatuses.has(response.status))
        throw new Error(
          `Preview returned non-retryable HTTP ${response.status}`,
        )
    } catch (error) {
      if (!transientErrorNames.has(error.name)) throw error
      outcome = error.name
    }
    log(`Preview readiness ${attempt}/${maxAttempts}: ${outcome}`)
    const wait = Math.min(retryDelayMs, deadline - now())
    if (attempt === maxAttempts || wait <= 0) break
    await delay(wait)
  }
  throw new Error(
    'Exact SHA Preview unavailable within 10 attempts / 45 seconds',
  )
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const url = await waitForPreview(process.argv[2], process.argv[3])
  process.stdout.write(`${url}\n`)
}
