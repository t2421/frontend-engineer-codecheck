import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import worker from '../../worker/review'

const origin = 'https://population-viewer.t2421-loop.workers.dev'
const prefectures = '/api/v1/prefectures'
const population = '/api/v1/population/composition/perYear'
const fetchProduction = vi.fn<typeof fetch>()
const data = { message: null, result: [{ prefCode: 1, prefName: '北海道' }] }

beforeEach(() => {
  fetchProduction.mockReset().mockResolvedValue(Response.json(data))
  vi.stubGlobal('fetch', fetchProduction)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

test.each([
  prefectures,
  `${population}?prefCode=1`,
  `${population}?prefCode=47`,
])('relays the public production API without credentials: %s', async (path) => {
  fetchProduction.mockResolvedValue(
    Response.json(data, {
      headers: { 'Set-Cookie': 'private', 'X-API-KEY': 'private' },
    }),
  )
  const response = await worker.fetch(
    new Request(`https://preview.test${path}`, {
      headers: {
        Authorization: 'private',
        Cookie: 'private',
        'X-API-KEY': 'private',
        'CF-Connecting-IP': '192.0.2.1',
        'X-Forwarded-For': '192.0.2.2',
      },
    }),
  )
  expect(fetchProduction).toHaveBeenCalledExactlyOnceWith(`${origin}${path}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    redirect: 'manual',
    signal: expect.any(AbortSignal),
  })
  expect(await response.json()).toEqual(data)
  expect([...response.headers]).toEqual([
    ['cache-control', 'no-store'],
    ['content-type', 'application/json'],
  ])
})

test.each([
  [prefectures, 'POST', 405],
  [prefectures, 'HEAD', 405],
  ['/api/unknown', 'GET', 404],
  ['/', 'GET', 404],
  [`${prefectures}?url=https://attacker.test`, 'GET', 400],
  [population, 'GET', 400],
  [`${population}?prefCode=48`, 'GET', 400],
  [`${population}?prefCode=1&prefCode=2`, 'GET', 400],
  [`${population}?prefCode=1&url=https://attacker.test`, 'GET', 400],
])('rejects %s %s before public API traffic', async (path, method, status) => {
  const response = await worker.fetch(
    new Request(`https://preview.test${path}`, { method }),
  )
  expect(response.status).toBe(status)
  if (status === 405) expect(response.headers.get('Allow')).toBe('GET')
  expect(fetchProduction).not.toHaveBeenCalled()
})

test.each([
  [429, 'RATE_LIMITED'],
  [503, 'SERVICE_UNAVAILABLE'],
  [502, 'UPSTREAM_ERROR'],
  [504, 'UPSTREAM_TIMEOUT'],
])(
  'preserves API failure %s %s without arbitrary data',
  async (status, error) => {
    fetchProduction.mockResolvedValue(
      Response.json(
        { error, detail: 'private' },
        { status, headers: { 'Retry-After': '10', 'Set-Cookie': 'private' } },
      ),
    )
    const response = await worker.fetch(
      new Request(`https://preview.test${prefectures}`),
    )
    expect(response.status).toBe(status)
    expect(await response.json()).toEqual({ error })
    expect(response.headers.get('Retry-After')).toBe('10')
    expect(response.headers.get('Set-Cookie')).toBeNull()
  },
)

test.each([
  new Response('private', {
    status: 302,
    headers: { Location: 'https://attacker.test' },
  }),
  new Response('private', { headers: { 'Content-Type': 'text/html' } }),
  new Response('private', { headers: { 'Content-Type': 'application/json' } }),
  Response.json({ error: 'private' }, { status: 500 }),
  Response.json({ message: 'private', result: null }),
])(
  'sanitizes unexpected responses and redirects',
  async (productionResponse) => {
    fetchProduction.mockResolvedValue(productionResponse)
    const response = await worker.fetch(
      new Request(`https://preview.test${prefectures}`),
    )
    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({ error: 'UPSTREAM_ERROR' })
    expect(response.headers.get('Location')).toBeNull()
  },
)

test('sanitizes a network exception', async () => {
  fetchProduction.mockRejectedValue(new Error('private'))
  const response = await worker.fetch(
    new Request(`https://preview.test${prefectures}`),
  )
  expect(response.status).toBe(502)
  expect(await response.json()).toEqual({ error: 'UPSTREAM_ERROR' })
})

test.each(['headers', 'body'])(
  'bounds a stalled production %s request',
  async (phase) => {
    const controller = new AbortController()
    const timeout = vi
      .spyOn(AbortSignal, 'timeout')
      .mockReturnValue(controller.signal)
    if (phase === 'headers') {
      fetchProduction.mockImplementation(
        (_url, options) =>
          new Promise((_resolve, reject) => {
            options?.signal?.addEventListener('abort', () =>
              reject(new Error('private')),
            )
          }),
      )
    } else {
      fetchProduction.mockResolvedValue(
        new Response(
          new ReadableStream({
            start(stream) {
              controller.signal.addEventListener('abort', () =>
                stream.error(new Error('private')),
              )
            },
          }),
          { headers: { 'Content-Type': 'application/json' } },
        ),
      )
    }
    const pending = worker.fetch(
      new Request(`https://preview.test${prefectures}`),
    )
    await Promise.resolve()
    controller.abort()
    const response = await pending
    expect(timeout).toHaveBeenCalledWith(12_000)
    expect(response.status).toBe(504)
    expect(await response.json()).toEqual({ error: 'UPSTREAM_TIMEOUT' })
  },
)
