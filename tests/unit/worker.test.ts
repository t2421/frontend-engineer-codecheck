import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import worker from '../../worker'

const secret = 'test-only-worker-secret'
const prefecturesPath = '/api/v1/prefectures'
const populationPath = '/api/v1/population/composition/perYear'
const prefectures = {
  message: null,
  result: [{ prefCode: 1, prefName: '北海道' }],
}
const population = {
  message: null,
  result: {
    boundaryYear: 2020,
    data: [
      { label: '総人口', data: [{ year: 1960, value: 5039206 }] },
      {
        label: '年少人口',
        data: [{ year: 1960, value: 1681479, rate: 33.37 }],
      },
      {
        label: '生産年齢人口',
        data: [{ year: 1960, value: 3288779, rate: 65.26 }],
      },
      { label: '老年人口', data: [{ year: 1960, value: 68599, rate: 1.36 }] },
    ],
  },
}
const limit = vi.fn()
const upstream = vi.fn<typeof fetch>()
const diagnosticLog = vi.fn()
const env = { API_RATE_LIMITER: { limit }, YUMEMI_API_KEY: secret }

function request(path = prefecturesPath, method = 'GET') {
  return new Request(`https://example.test${path}`, {
    method,
    headers: {
      'CF-Connecting-IP': '192.0.2.1',
      Authorization: 'Bearer browser-credential',
      'X-API-KEY': 'browser-api-key',
      Cookie: 'session=browser-session',
      'User-Agent': 'browser-user-agent',
      'X-Forwarded-For': 'spoofed-ip',
    },
  })
}

beforeEach(() => {
  diagnosticLog.mockReset()
  vi.spyOn(console, 'error').mockImplementation(diagnosticLog)
  limit.mockReset().mockResolvedValue({ success: true })
  upstream.mockReset().mockResolvedValue(Response.json(prefectures))
  vi.stubGlobal('fetch', upstream)
})

function expectDiagnostic(status: number, code: string) {
  expect(diagnosticLog).toHaveBeenCalledTimes(1)
  const call = diagnosticLog.mock.calls[0]!
  expect(call).toHaveLength(1)
  expect(typeof call[0]).toBe('string')
  expect(JSON.parse(call[0])).toEqual({ status, code })
  expect(call[0]).not.toContain(secret)
  expect(call[0]).not.toContain('https://')
  expect(call[0]).not.toContain('X-API-KEY')
  expect(call[0]).not.toContain('browser-credential')
}
afterEach(() => vi.useRealTimers())

for (const [path, body] of [
  [prefecturesPath, prefectures],
  [`${populationPath}?prefCode=1`, population],
  [`${populationPath}?prefCode=47`, population],
] as const) {
  test(`forwards only the fixed GET destination and Worker Secret: ${path}`, async () => {
    vi.useFakeTimers()
    upstream.mockResolvedValue(
      Response.json(body, {
        headers: { 'X-API-KEY': secret, 'Set-Cookie': secret },
      }),
    )
    const response = await worker.fetch(request(path), env)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(body)
    expect(response.headers.get('Content-Type')).toContain('application/json')
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(response.headers.get('X-API-KEY')).toBeNull()
    expect(response.headers.get('Set-Cookie')).toBeNull()
    expect(upstream).toHaveBeenCalledExactlyOnceWith(
      `https://frontend-engineer-codecheck-api.mirai.yumemi.io${path}`,
      {
        method: 'GET',
        headers: {
          'X-API-KEY': secret,
          'User-Agent': 'population-viewer-proxy',
        },
        redirect: 'manual',
        signal: expect.any(AbortSignal),
      },
    )
    expect(vi.getTimerCount()).toBe(0)
    expect(diagnosticLog).not.toHaveBeenCalled()
  })
}

test.each([
  [prefecturesPath, 'POST', 405],
  [populationPath, 'HEAD', 405],
  [prefecturesPath, 'OPTIONS', 405],
  ['/api/unknown', 'GET', 404],
  [`${prefecturesPath}/`, 'GET', 404],
  [`${prefecturesPath}?url=https://attacker.test`, 'GET', 400],
  [`${prefecturesPath}?prefCode=1`, 'GET', 400],
  [populationPath, 'GET', 400],
  ...['', '0', '48', '-1', '01', '1.0', '1e0', 'NaN', '%201', '1%20'].map(
    (code) => [`${populationPath}?prefCode=${code}`, 'GET', 400],
  ),
  [`${populationPath}?prefCode=1&prefCode=2`, 'GET', 400],
  [`${populationPath}?prefCode=1&cityCode=-`, 'GET', 400],
  [`${populationPath}?prefCode=1&url=https://attacker.test`, 'GET', 400],
])(
  'rejects %s (%s) without upstream communication',
  async (path, method, status) => {
    const response = await worker.fetch(
      request(String(path), String(method)),
      env,
    )
    expect(response.status).toBe(status)
    expect(await response.json()).toEqual({ error: expect.any(String) })
    if (status === 405) expect(response.headers.get('Allow')).toBe('GET')
    expect(upstream).not.toHaveBeenCalled()
    expect(diagnosticLog).not.toHaveBeenCalled()
  },
)

test('both APIs share the same Cloudflare IP limiter key', async () => {
  await worker.fetch(request(), env)
  await worker.fetch(request(`${populationPath}?prefCode=1`), env)
  expect(limit.mock.calls).toEqual([
    [{ key: 'ip:192.0.2.1' }],
    [{ key: 'ip:192.0.2.1' }],
  ])
})

test('limit rejection returns 429 and never sends an upstream request', async () => {
  limit.mockResolvedValue({ success: false })
  const response = await worker.fetch(request(), env)
  expect(response.status).toBe(429)
  expect(response.headers.get('Retry-After')).toBe('10')
  expect(upstream).not.toHaveBeenCalled()
})

test('static routes bypass the limiter; missing API IP fails closed', async () => {
  expect(
    (await worker.fetch(new Request('https://example.test/'), env)).status,
  ).toBe(404)
  expect(
    (
      await worker.fetch(
        new Request(`https://example.test${prefecturesPath}`),
        env,
      )
    ).status,
  ).toBe(503)
  expect(limit).not.toHaveBeenCalled()
  expect(upstream).not.toHaveBeenCalled()
})

test('limiter failure is safely handled without upstream traffic or logging', async () => {
  limit.mockRejectedValue(new Error(secret))
  const response = await worker.fetch(request(), env)
  expect(response.status).toBe(503)
  expect(await response.text()).not.toContain(secret)
  expect(upstream).not.toHaveBeenCalled()
})

test.each([undefined, '', '   '])(
  'missing Secret fails closed (%s)',
  async (key) => {
    const response = await worker.fetch(request(), {
      ...env,
      YUMEMI_API_KEY: key,
    })
    expect(response.status).toBe(503)
    expect(upstream).not.toHaveBeenCalled()
  },
)

test.each([302, 400, 403, 404, 429, 500])(
  'sanitizes upstream HTTP %s without following redirects',
  async (status) => {
    upstream.mockResolvedValue(
      new Response(secret, {
        status,
        headers: { Location: 'https://attacker.test', 'X-API-KEY': secret },
      }),
    )
    const response = await worker.fetch(request(), env)
    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({ error: 'UPSTREAM_ERROR' })
    expect([...response.headers].flat().join()).not.toContain(secret)
    expect(response.headers.get('Location')).toBeNull()
    expect(upstream).toHaveBeenCalledTimes(1)
    expectDiagnostic(status, 'UPSTREAM_HTTP_ERROR')
  },
)

test('cancels an HTTP error body without logging upstream headers', async () => {
  const headers = {
    'X-API-KEY': secret,
    Location: 'https://private.test',
    'Content-Type': `text/html-${secret}`,
    'cf-mitigated': `challenge-${secret}`,
  }
  const upstreamResponse = new Response(new ReadableStream({ start() {} }), {
    status: 403,
    headers,
  })
  const cancel = vi.spyOn(upstreamResponse.body!, 'cancel')
  upstream.mockResolvedValue(upstreamResponse)
  const response = await worker.fetch(request(), env)
  expect(response.status).toBe(502)
  expect(await response.json()).toEqual({ error: 'UPSTREAM_ERROR' })
  expectDiagnostic(403, 'UPSTREAM_HTTP_ERROR')
  expect(cancel).toHaveBeenCalledTimes(1)
})

test.each([
  [() => Promise.reject(new Error(secret)), 0],
  [() => Promise.resolve(new Response(secret)), 200],
  [
    () => Promise.resolve(Response.json({ message: secret, result: null })),
    200,
  ],
  [
    () => Promise.resolve(Response.json({ message: null, result: { secret } })),
    200,
  ],
  [
    () =>
      Promise.resolve(
        new Response(
          JSON.stringify({ message: null, result: { secret } }).replaceAll(
            't',
            '\\u0074',
          ),
        ),
      ),
    200,
  ],
])(
  'sanitizes network, JSON, API envelope and reflected Secret failures',
  async (implementation, status) => {
    const warnLog = vi.spyOn(console, 'warn')
    const log = vi.spyOn(console, 'log')
    upstream.mockImplementation(implementation)
    const response = await worker.fetch(request(), env)
    expect(response.status).toBe(502)
    expect(await response.text()).not.toContain(secret)
    expectDiagnostic(status, 'UNKNOWN')
    expect(warnLog).not.toHaveBeenCalled()
    expect(log).not.toHaveBeenCalled()
  },
)

for (const phase of ['headers', 'body']) {
  test(`times out stalled upstream ${phase}, aborts and clears the timer`, async () => {
    vi.useFakeTimers()
    if (phase === 'headers')
      upstream.mockImplementation(() => new Promise(() => {}))
    else
      upstream.mockResolvedValue(
        new Response(new ReadableStream({ start() {} })),
      )
    const pending = worker.fetch(request(), env)
    await vi.advanceTimersByTimeAsync(10_000)
    const response = await pending
    expect(response.status).toBe(504)
    expect(await response.json()).toEqual({ error: 'UPSTREAM_TIMEOUT' })
    expect(upstream.mock.calls[0]?.[1]?.signal?.aborted).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
    expectDiagnostic(phase === 'headers' ? 0 : 200, 'UPSTREAM_TIMEOUT')
  })
}

test('rejects reflected Secrets containing JSON special characters', async () => {
  const specialKey = 'test-"secret\\value'
  upstream.mockResolvedValue(
    Response.json({ message: null, result: { specialKey } }),
  )
  const response = await worker.fetch(request(), {
    ...env,
    YUMEMI_API_KEY: specialKey,
  })
  expect(response.status).toBe(502)
  expect(await response.json()).toEqual({ error: 'UPSTREAM_ERROR' })
  expectDiagnostic(200, 'UNKNOWN')
  expect(diagnosticLog.mock.calls.flat().join()).not.toContain(specialKey)
})

test.each([
  new TypeError(`${secret} https://private.test X-API-KEY`),
  new DOMException(secret, 'AbortError'),
  new Error(secret, {
    cause: { body: secret, headers: { Authorization: secret } },
  }),
  secret,
  {
    get name() {
      throw new Error('must not inspect arbitrary exception properties')
    },
    message: secret,
  },
])(
  'reports unknown failures without reading or logging their free-form properties',
  async (error) => {
    upstream.mockRejectedValue(error)
    const response = await worker.fetch(request(), env)
    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({ error: 'UPSTREAM_ERROR' })
    expectDiagnostic(0, 'UNKNOWN')
  },
)

test('an HTTP body cancellation failure retains the original upstream status and classification', async () => {
  const upstreamResponse = new Response(secret, { status: 403 })
  vi.spyOn(upstreamResponse.body!, 'cancel').mockRejectedValue(
    new TypeError(secret),
  )
  upstream.mockResolvedValue(upstreamResponse)
  const response = await worker.fetch(request(), env)
  expect(response.status).toBe(502)
  expectDiagnostic(403, 'UPSTREAM_HTTP_ERROR')
})

test('a body-read failure retains its received status without printing its exception', async () => {
  upstream.mockResolvedValue(
    new Response(
      new ReadableStream({
        start(controller) {
          controller.error(new TypeError(secret))
        },
      }),
      { status: 201 },
    ),
  )
  const response = await worker.fetch(request(), env)
  expect(response.status).toBe(502)
  expectDiagnostic(201, 'UNKNOWN')
})

test('rate rejection precedes method, query and Secret validation', async () => {
  limit.mockResolvedValue({ success: false })
  const response = await worker.fetch(
    request('/api/unknown?url=https://attacker.test', 'POST'),
    {
      API_RATE_LIMITER: { limit },
    },
  )
  expect(response.status).toBe(429)
  expect(await response.json()).toEqual({ error: 'RATE_LIMITED' })
  expect(upstream).not.toHaveBeenCalled()
})
