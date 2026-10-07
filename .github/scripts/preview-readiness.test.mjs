import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { previewAppUrl, waitForPreview } from './preview-readiness.mjs'

const base = 'https://pr-52.example.workers.dev'
const sha = 'a'.repeat(40)
const url = `${base}/performance/${sha}/`
function harness(
  statuses,
  {
    requestTime = 0,
    responseUrl = url,
    type = 'text/html; charset=utf-8',
  } = {},
) {
  let clock = 0
  const calls = []
  const waits = []
  const logs = []
  let cancellations = 0
  return {
    calls,
    waits,
    logs,
    get clock() {
      return clock
    },
    get cancellations() {
      return cancellations
    },
    options: {
      now: () => clock,
      delay: async (ms) => {
        waits.push(ms)
        clock += ms
      },
      log: (message) => logs.push(message),
      request: async (target, options) => {
        calls.push({ target, options })
        clock += requestTime
        const status = statuses[Math.min(calls.length - 1, statuses.length - 1)]
        if (status instanceof Error) throw status
        return {
          status,
          url: responseUrl,
          headers: { get: () => type },
          body: {
            cancel: async () => {
              cancellations++
            },
          },
        }
      },
    },
  }
}

test('temporary 404 retries only the exact SHA URL and succeeds', async () => {
  const h = harness([404, 404, 200])
  assert.equal(await waitForPreview(base, sha, h.options), url)
  assert.equal(h.calls.length, 3)
  assert.deepEqual(h.waits, [2000, 2000])
  assert.equal(h.cancellations, 3)
  for (const call of h.calls) {
    assert.equal(call.target, url)
    assert.equal(call.options.redirect, 'manual')
    assert.ok(call.options.signal instanceof globalThis.AbortSignal)
  }
})

test('persistent 404 fails at attempt limit; slow failures stop at deadline', async () => {
  const attempts = harness([404])
  await assert.rejects(
    waitForPreview(base, sha, attempts.options),
    /unavailable/,
  )
  assert.equal(attempts.calls.length, 10)
  assert.equal(attempts.waits.length, 9)
  const timeout = new Error('timeout')
  timeout.name = 'TimeoutError'
  const deadline = harness([timeout], { requestTime: 3000 })
  await assert.rejects(
    waitForPreview(base, sha, deadline.options),
    /45 seconds/,
  )
  assert.equal(deadline.clock, 45000)
  assert.equal(deadline.calls.length, 9)
  const lateSuccess = harness([200], { requestTime: 45000 })
  await assert.rejects(
    waitForPreview(base, sha, lateSuccess.options),
    /unavailable/,
  )
})

test('permissions, redirects, mismatched URL and non-HTML never become ready', async () => {
  for (const status of [401, 403, 301, 302, 400]) {
    const h = harness([status, 200])
    await assert.rejects(waitForPreview(base, sha, h.options), /non-retryable/)
    assert.equal(h.calls.length, 1)
    assert.equal(h.waits.length, 0)
  }
  for (const responseUrl of [
    base + '/',
    base + '/app/',
    base + '/performance/' + 'b'.repeat(40) + '/',
  ]) {
    const h = harness([200], { responseUrl })
    await assert.rejects(waitForPreview(base, sha, h.options), /URL differs/)
    assert.equal(h.calls.length, 1)
  }
  await assert.rejects(
    waitForPreview(
      base,
      sha,
      harness([200], { type: 'application/json' }).options,
    ),
    /not HTML/,
  )
  for (const invalid of [
    base + '/app/',
    base + '?q=1',
    base + '#fragment',
    'http://example.test',
    'https://user:pass@example.test',
  ])
    assert.throws(() => previewAppUrl(invalid, sha))
  assert.throws(() => previewAppUrl(base, 'old-sha'))
})

test('temporary rate limit, upstream failures and transport error can recover', async () => {
  const network = new TypeError('network failed')
  for (const status of [408, 429, 500, 502, 503, 504, network]) {
    const h = harness([status, 200])
    assert.equal(await waitForPreview(base, sha, h.options), url)
    assert.equal(h.calls.length, 2)
  }
})

test('workflow gates outputs on readiness and preserves privilege/artifact separation', async () => {
  const require = createRequire(import.meta.url)
  const cliRequire = createRequire(require.resolve('@lhci/cli/package.json'))
  const utilsRequire = createRequire(
    cliRequire.resolve('@lhci/utils/package.json'),
  )
  const workflow = utilsRequire('js-yaml').safeLoad(
    await readFile('.github/workflows/review-publish.yml', 'utf8'),
  )
  const publish = workflow.jobs.publish
  const step = publish.steps.find((step) => step.id === 'preview')
  assert.match(
    step.run,
    /test -f "review-assets\/performance\/\$HEAD_SHA\/index.html"/,
  )
  assert.match(
    step.run,
    /app_url="\$\(node .github\/scripts\/preview-readiness.mjs "\$url" "\$HEAD_SHA"\)"/,
  )
  assert.ok(
    step.run.indexOf('preview-readiness.mjs') <
      step.run.indexOf('echo "app-url='),
  )
  assert.equal(publish.permissions['pull-requests'], 'read')
  assert.deepEqual(workflow.jobs.measure.permissions, { contents: 'read' })
  assert.deepEqual(workflow.jobs['performance-comment'].permissions, {
    contents: 'read',
    'pull-requests': 'write',
  })
  assert.doesNotMatch(JSON.stringify(workflow.jobs.measure), /upload-artifact/)
  const config = JSON.parse(
    (await readFile('wrangler.review.jsonc', 'utf8')).replace(
      /,\s*([}\]])/g,
      '$1',
    ),
  )
  assert.equal(config.assets.not_found_handling, 'none')
})
