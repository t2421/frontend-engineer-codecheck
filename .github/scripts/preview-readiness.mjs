import process from 'node:process'
import { setTimeout } from 'node:timers/promises'
import { URL, pathToFileURL } from 'node:url'

export function previewAppUrl(baseUrl, sha) {
  const base = new URL(baseUrl)
  if (
    base.protocol !== 'https:' ||
    base.username ||
    base.password ||
    base.pathname !== '/' ||
    base.search ||
    base.hash ||
    !/^[a-f0-9]{40}$/.test(sha)
  )
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
  const deadline = now() + 45_000
  const retryable = new Set([404, 408, 429, 500, 502, 503, 504])
  for (let attempt = 1; attempt <= 10; attempt++) {
    const remaining = deadline - now()
    if (remaining <= 0) break
    let status
    try {
      const response = await request(url, {
        redirect: 'manual',
        signal: globalThis.AbortSignal.timeout(Math.min(3000, remaining)),
      })
      await response.body?.cancel()
      if (response.url !== url)
        throw new Error('Preview response URL differs from exact SHA URL')
      status = response.status
      if (status === 200) {
        if (
          !/^text\/html(?:\s*;|$)/i.test(
            response.headers.get('content-type') ?? '',
          )
        )
          throw new Error('Preview response is not HTML')
        if (now() >= deadline) break
        return url
      }
      if (!retryable.has(status))
        throw new Error(`Preview returned non-retryable HTTP ${status}`)
    } catch (error) {
      if (!['TypeError', 'TimeoutError', 'AbortError'].includes(error.name))
        throw error
      status = error.name
    }
    log(`Preview readiness ${attempt}/10: ${status}`)
    const wait = Math.min(2000, deadline - now())
    if (attempt === 10 || wait <= 0) break
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
