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
const env = { API_RATE_LIMITER: { limit }, YUMEMI_API_KEY: secret }

function request(path = prefecturesPath, method = 'GET') {
  return new Request(`https://example.test${path}`, {
    method,
    headers: {
      'CF-Connecting-IP': '192.0.2.1',
      Authorization: 'Bearer browser-credential',
      'X-API-KEY': 'browser-api-key',
      Cookie: 'session=browser-session',
      'X-Forwarded-For': 'spoofed-ip',
    },
  })
}

beforeEach(() => {
  limit.mockReset().mockResolvedValue({ success: true })
  upstream.mockReset().mockResolvedValue(Response.json(prefectures))
  vi.stubGlobal('fetch', upstream)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

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
        headers: { 'X-API-KEY': secret },
        redirect: 'manual',
        signal: expect.any(AbortSignal),
      },
    )
    expect(vi.getTimerCount()).toBe(0)
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
  },
)

test.each([
  () => Promise.reject(new Error(secret)),
  () => Promise.resolve(new Response(secret)),
  () => Promise.resolve(Response.json({ message: secret, result: null })),
  () => Promise.resolve(Response.json({ message: null, result: { secret } })),
  () =>
    Promise.resolve(
      new Response(
        JSON.stringify({ message: null, result: { secret } }).replaceAll(
          't',
          '\\u0074',
        ),
      ),
    ),
])(
  'sanitizes network, JSON, API envelope and reflected Secret failures',
  async (implementation) => {
    const errorLog = vi.spyOn(console, 'error')
    const warnLog = vi.spyOn(console, 'warn')
    const log = vi.spyOn(console, 'log')
    upstream.mockImplementation(implementation)
    const response = await worker.fetch(request(), env)
    expect(response.status).toBe(502)
    expect(await response.text()).not.toContain(secret)
    expect(errorLog).not.toHaveBeenCalled()
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
})
