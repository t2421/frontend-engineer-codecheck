import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { URL } from 'node:url'
import { diagnose } from './cloudflare-metadata-diagnostic.mjs'

const token = 'private-token-never-print'
const accountId = 'a'.repeat(32)
const json = (body, status = 200) =>
  new globalThis.Response(JSON.stringify(body), { status })

async function run(respond) {
  const calls = []
  const lines = []
  const success = await diagnose({
    token,
    accountId,
    write: (line) => lines.push(line),
    fetchImpl: async (url, options) => {
      calls.push({ url, options })
      return respond(calls.length, url, options)
    },
  })
  return { success, calls, lines, reports: lines.map(JSON.parse) }
}

const metadata = () =>
  json({
    success: true,
    result: { default_environment: { environment: 'production' } },
  })

test('reads only the fixed Cloudflare origin and the six Wrangler 4.143.1 endpoints', async () => {
  const result = await run((n) =>
    n === 1 ? metadata() : json({ success: true, result: { secret: token } }),
  )
  assert.equal(result.success, true)
  const root = `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers`
  const service = `${root}/services/population-viewer`
  const environment = `${service}/environments/production`
  assert.deepEqual(
    result.calls.map(({ url }) => url),
    [
      service,
      `${environment}/bindings`,
      `${environment}/routes?show_zonename=true`,
      `${root}/domains/records?page=0&per_page=5&service=population-viewer&environment=production`,
      `${environment}/subdomain`,
      environment,
      `${root}/scripts/population-viewer/schedules`,
    ],
  )
  for (const { options } of result.calls) {
    assert.equal(options.method, 'GET')
    assert.equal(options.redirect, 'error')
    assert.deepEqual(options.headers, { Authorization: `Bearer ${token}` })
    assert.ok(options.signal instanceof globalThis.AbortSignal)
    assert.equal(options.body, undefined)
  }
  assert.ok(
    result.reports.every(
      (report) =>
        Object.keys(report).join(',') === 'endpoint,status,errorCodes',
    ),
  )
  assert.ok(
    result.reports.every(
      ({ status, errorCodes }) => status === 200 && errorCodes.length === 0,
    ),
  )
  assert.ok(!result.lines.join('\n').includes(token))
})

test('continues after a failed endpoint and emits only safe numeric error codes', async () => {
  const result = await run((n) => {
    if (n === 1) return metadata()
    if (n === 4)
      return json(
        {
          success: false,
          result: token,
          errors: [
            { code: 10000, message: token },
            { code: token },
            { code: '9109' },
            { code: -1 },
            { code: 1.5 },
            { code: 10000 },
          ],
        },
        403,
      )
    return json({ success: true })
  })
  assert.equal(result.success, false)
  assert.equal(result.calls.length, 7)
  assert.deepEqual(result.reports[3], {
    endpoint: 'custom-domains',
    status: 403,
    errorCodes: [10000],
  })
  assert.ok(!result.lines.join('\n').includes(token))
})

test('transport, redirect and timeout errors never print exception details and do not stop other GETs', async () => {
  const result = await run((n) => {
    if (n === 1) return metadata()
    if (n === 2) throw new Error(token)
    if (n === 3) throw new globalThis.DOMException(token, 'TimeoutError')
    return json({ success: true })
  })
  assert.equal(result.success, false)
  assert.equal(result.calls.length, 7)
  assert.deepEqual(
    result.reports
      .slice(1, 3)
      .map(({ status, errorCodes }) => ({ status, errorCodes })),
    [
      { status: 0, errorCodes: [] },
      { status: 0, errorCodes: [] },
    ],
  )
  assert.ok(!result.lines.join('\n').includes(token))
})

test('a body parse failure retains the HTTP status without printing the body', async () => {
  const result = await run((n) =>
    n === 1 ? metadata() : new globalThis.Response(token, { status: 502 }),
  )
  assert.equal(result.success, false)
  assert.equal(result.calls.length, 7)
  assert.ok(result.reports.slice(1).every(({ status }) => status === 502))
  assert.ok(!result.lines.join('\n').includes(token))
})

test('missing or malformed credentials cause no network request', async () => {
  for (const credentials of [
    { token: '', accountId },
    { token, accountId: '../other' },
  ]) {
    const lines = []
    assert.equal(
      await diagnose({
        ...credentials,
        write: (line) => lines.push(line),
        fetchImpl: () => assert.fail('unexpected GET'),
      }),
      false,
    )
    assert.deepEqual(lines.map(JSON.parse), [
      { endpoint: 'service-metadata', status: 0, errorCodes: [] },
    ])
  }
})

test('failed metadata or an unsafe environment stops before the six GETs', async () => {
  for (const response of [
    () =>
      json({ success: false, errors: [{ code: 10000, message: token }] }, 403),
    () => json({ success: true, result: {} }),
    () =>
      json({
        success: true,
        result: { default_environment: { environment: '../../other' } },
      }),
  ]) {
    const result = await run(response)
    assert.equal(result.success, false)
    assert.equal(result.calls.length, 1)
    assert.ok(!result.lines.join('\n').includes(token))
  }
})

test('the standalone workflow is manual, uses existing production secrets and has no deploy step', () => {
  const workflow = readFileSync(
    new URL('../workflows/cloudflare-metadata-diagnostic.yml', import.meta.url),
    'utf8',
  )
  assert.match(workflow, /workflow_dispatch:/)
  assert.doesNotMatch(
    workflow,
    /pull_request:|push:|workflow_call:|wrangler|pnpm build|deploy\.yml/,
  )
  assert.match(workflow, /environment: production/)
  assert.match(workflow, /if: github\.ref == 'refs\/heads\/main'/)
  assert.match(workflow, /secrets\.CLOUDFLARE_API_TOKEN/)
  assert.match(workflow, /secrets\.CLOUDFLARE_ACCOUNT_ID/)
  assert.doesNotMatch(workflow, /YUMEMI_API_KEY|upload-artifact/)
})
