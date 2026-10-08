import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import worker from '../../worker'

const secret = 'test-only-worker-secret'
const upstreamOrigin = 'https://frontend-engineer-codecheck-api.mirai.yumemi.io'
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

// ブラウザーが送りうる認証情報・偽装IPをすべて付けた要求。Workerはこれらを転送しない。
function browserRequest(path = prefecturesPath, method = 'GET') {
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
const proxy = (path?: string, method?: string, overrides = {}) =>
  worker.fetch(browserRequest(path, method), { ...env, ...overrides })

// 診断ログは {status, code} のJSON 1行だけで、Secret・URL・ヘッダー名を含まない。
function expectDiagnosticLog(status: number, code: string) {
  expect(diagnosticLog).toHaveBeenCalledTimes(1)
  const [line] = diagnosticLog.mock.calls[0] ?? []
  expect(typeof line).toBe('string')
  expect(JSON.parse(line)).toEqual({ status, code })
  for (const forbidden of [
    secret,
    'https://',
    'X-API-KEY',
    'browser-credential',
  ])
    expect(line).not.toContain(forbidden)
}
async function expectUpstreamError(response: Response) {
  expect(response.status).toBe(502)
  expect(await response.json()).toEqual({ error: 'UPSTREAM_ERROR' })
}

beforeEach(() => {
  diagnosticLog.mockReset()
  vi.spyOn(console, 'error').mockImplementation(diagnosticLog)
  limit.mockReset().mockResolvedValue({ success: true })
  upstream.mockReset().mockResolvedValue(Response.json(prefectures))
  vi.stubGlobal('fetch', upstream)
})
afterEach(() => vi.useRealTimers())

const invalidPrefCodes = [
  '',
  '0',
  '48',
  '-1',
  '01',
  '1.0',
  '1e0',
  'NaN',
  '%201',
  '1%20',
]
const invalidRequests: [path: string, method: string, status: number][] = [
  [prefecturesPath, 'POST', 405],
  [populationPath, 'HEAD', 405],
  [prefecturesPath, 'OPTIONS', 405],
  ['/api/unknown', 'GET', 404],
  [`${prefecturesPath}/`, 'GET', 404],
  [`${prefecturesPath}?url=https://attacker.test`, 'GET', 400],
  [`${prefecturesPath}?prefCode=1`, 'GET', 400],
  [populationPath, 'GET', 400],
  ...invalidPrefCodes.map((code): [string, string, number] => [
    `${populationPath}?prefCode=${code}`,
    'GET',
    400,
  ]),
  [`${populationPath}?prefCode=1&prefCode=2`, 'GET', 400],
  [`${populationPath}?prefCode=1&cityCode=-`, 'GET', 400],
  [`${populationPath}?prefCode=1&url=https://attacker.test`, 'GET', 400],
]

describe('本番Worker: 要求の検証', () => {
  test.each(invalidRequests)(
    '不正な要求 %s（%s）を上流へ送らず %d で拒否する',
    async (path, method, status) => {
      const response = await proxy(path, method)
      expect(response.status).toBe(status)
      expect(await response.json()).toEqual({ error: expect.any(String) })
      if (status === 405) expect(response.headers.get('Allow')).toBe('GET')
      expect(upstream).not.toHaveBeenCalled()
      expect(diagnosticLog).not.toHaveBeenCalled()
    },
  )

  test('API以外のパスは制限も中継もせず 404 にする', async () => {
    const response = await worker.fetch(
      new Request('https://example.test/'),
      env,
    )
    expect(response.status).toBe(404)
    expect(limit).not.toHaveBeenCalled()
    expect(upstream).not.toHaveBeenCalled()
  })
})

describe('本番Worker: レート制限', () => {
  test('一覧と人口のAPIは同じIPキーで制限する', async () => {
    await proxy()
    await proxy(`${populationPath}?prefCode=1`)
    expect(limit.mock.calls).toEqual([
      [{ key: 'ip:192.0.2.1' }],
      [{ key: 'ip:192.0.2.1' }],
    ])
  })

  test('制限超過は上流へ送らず 429 と Retry-After を返す', async () => {
    limit.mockResolvedValue({ success: false })
    const response = await proxy()
    expect(response.status).toBe(429)
    expect(await response.json()).toEqual({ error: 'RATE_LIMITED' })
    expect(response.headers.get('Retry-After')).toBe('10')
    expect(upstream).not.toHaveBeenCalled()
  })

  test('制限の判定はメソッド・query・Secretの検証より先に行う', async () => {
    limit.mockResolvedValue({ success: false })
    const response = await proxy(
      '/api/unknown?url=https://attacker.test',
      'POST',
      {
        YUMEMI_API_KEY: undefined,
      },
    )
    expect(response.status).toBe(429)
    expect(upstream).not.toHaveBeenCalled()
  })

  test('Cloudflareが付けるIPがない要求は 503 で閉じる', async () => {
    const response = await worker.fetch(
      new Request(`https://example.test${prefecturesPath}`),
      env,
    )
    expect(response.status).toBe(503)
    expect(limit).not.toHaveBeenCalled()
    expect(upstream).not.toHaveBeenCalled()
  })

  test('制限の判定自体が失敗したら 503 で閉じ、詳細を出さない', async () => {
    limit.mockRejectedValue(new Error(secret))
    const response = await proxy()
    expect(response.status).toBe(503)
    expect(await response.text()).not.toContain(secret)
    expect(upstream).not.toHaveBeenCalled()
  })
})

describe('本番Worker: 上流への中継', () => {
  test.each([
    [prefecturesPath, prefectures],
    [`${populationPath}?prefCode=1`, population],
    [`${populationPath}?prefCode=47`, population],
  ])(
    '%s を固定の上流へ Secret 付きGETで中継し、ブラウザーの情報を転送しない',
    async (path, body) => {
      vi.useFakeTimers()
      upstream.mockResolvedValue(
        Response.json(body, {
          headers: { 'X-API-KEY': secret, 'Set-Cookie': secret },
        }),
      )
      const response = await proxy(path)
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual(body)
      expect(response.headers.get('Content-Type')).toContain('application/json')
      expect(response.headers.get('Cache-Control')).toBe('no-store')
      expect(response.headers.get('X-API-KEY')).toBeNull()
      expect(response.headers.get('Set-Cookie')).toBeNull()
      expect(upstream).toHaveBeenCalledExactlyOnceWith(
        `${upstreamOrigin}${path}`,
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
    },
  )

  test.each([undefined, '', '   '])(
    'Secret が未設定（%j）なら上流へ送らず 503 で閉じる',
    async (key) => {
      const response = await proxy(undefined, undefined, {
        YUMEMI_API_KEY: key,
      })
      expect(response.status).toBe(503)
      expect(upstream).not.toHaveBeenCalled()
    },
  )
})

describe('本番Worker: 上流の失敗を安全な応答にする', () => {
  test.each([302, 400, 403, 404, 429, 500])(
    '上流のHTTP %d はリダイレクトを追わず、固定の 502 にする',
    async (status) => {
      upstream.mockResolvedValue(
        new Response(secret, {
          status,
          headers: { Location: 'https://attacker.test', 'X-API-KEY': secret },
        }),
      )
      const response = await proxy()
      await expectUpstreamError(response)
      expect([...response.headers].flat().join()).not.toContain(secret)
      expect(response.headers.get('Location')).toBeNull()
      expect(upstream).toHaveBeenCalledTimes(1)
      expectDiagnosticLog(status, 'UPSTREAM_HTTP_ERROR')
    },
  )

  test('HTTP失敗の本文は読まずに破棄する', async () => {
    const upstreamResponse = new Response(new ReadableStream({ start() {} }), {
      status: 403,
      headers: { 'X-API-KEY': secret, 'Content-Type': `text/html-${secret}` },
    })
    const cancel = vi.spyOn(upstreamResponse.body!, 'cancel')
    upstream.mockResolvedValue(upstreamResponse)
    await expectUpstreamError(await proxy())
    expect(cancel).toHaveBeenCalledTimes(1)
    expectDiagnosticLog(403, 'UPSTREAM_HTTP_ERROR')
  })

  test('本文の破棄に失敗しても、受け取ったHTTP statusの分類を保つ', async () => {
    const upstreamResponse = new Response(secret, { status: 403 })
    vi.spyOn(upstreamResponse.body!, 'cancel').mockRejectedValue(
      new TypeError(secret),
    )
    upstream.mockResolvedValue(upstreamResponse)
    await expectUpstreamError(await proxy())
    expectDiagnosticLog(403, 'UPSTREAM_HTTP_ERROR')
  })

  test.each([
    {
      name: '通信例外',
      status: 0,
      respond: () => Promise.reject(new Error(secret)),
    },
    {
      name: 'JSONでない本文',
      status: 200,
      respond: () => Promise.resolve(new Response(secret)),
    },
    {
      name: '成功形式でないenvelope',
      status: 200,
      respond: () =>
        Promise.resolve(Response.json({ message: secret, result: null })),
    },
    {
      name: 'Secretの反射',
      status: 200,
      respond: () =>
        Promise.resolve(Response.json({ message: null, result: { secret } })),
    },
    {
      name: 'Unicode escapeによるSecretの反射',
      status: 200,
      respond: () =>
        Promise.resolve(
          new Response(
            JSON.stringify({ message: null, result: { secret } }).replaceAll(
              't',
              '\\u0074',
            ),
          ),
        ),
    },
  ])(
    '$name は 502 にし、console.error 以外には何も出さない',
    async ({ status, respond }) => {
      const warn = vi.spyOn(console, 'warn')
      const log = vi.spyOn(console, 'log')
      upstream.mockImplementation(respond)
      const response = await proxy()
      await expectUpstreamError(response)
      expectDiagnosticLog(status, 'UNKNOWN')
      expect(warn).not.toHaveBeenCalled()
      expect(log).not.toHaveBeenCalled()
    },
  )

  test('本文の読み取りに失敗しても、受け取ったHTTP statusを記録し例外は出さない', async () => {
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
    await expectUpstreamError(await proxy())
    expectDiagnosticLog(201, 'UNKNOWN')
  })

  test.each([
    {
      name: 'URLとヘッダー名を含むTypeError',
      error: new TypeError(`${secret} https://private.test X-API-KEY`),
    },
    { name: 'AbortError', error: new DOMException(secret, 'AbortError') },
    {
      name: 'causeに認証情報を含むError',
      error: new Error(secret, {
        cause: { body: secret, headers: { Authorization: secret } },
      }),
    },
    { name: '文字列', error: secret },
    {
      name: 'プロパティ参照で例外を投げるオブジェクト',
      error: {
        get name() {
          throw new Error('must not inspect arbitrary exception properties')
        },
        message: secret,
      },
    },
  ])(
    '例外（$name）の中身を読まず、固定の 502 と分類だけを記録する',
    async ({ error }) => {
      upstream.mockRejectedValue(error)
      await expectUpstreamError(await proxy())
      expectDiagnosticLog(0, 'UNKNOWN')
    },
  )
})

describe('本番Worker: タイムアウト', () => {
  test.each([
    { phase: 'ヘッダー', stall: 'headers', status: 0 },
    { phase: '本文', stall: 'body', status: 200 },
  ])(
    '上流の$phase待ちが止まったら10秒で中断し 504 にする',
    async ({ stall, status }) => {
      vi.useFakeTimers()
      if (stall === 'headers')
        upstream.mockImplementation(() => new Promise(() => {}))
      else
        upstream.mockResolvedValue(
          new Response(new ReadableStream({ start() {} })),
        )
      const pending = proxy()
      await vi.advanceTimersByTimeAsync(10_000)
      const response = await pending
      expect(response.status).toBe(504)
      expect(await response.json()).toEqual({ error: 'UPSTREAM_TIMEOUT' })
      expect(upstream.mock.calls[0]?.[1]?.signal?.aborted).toBe(true)
      expect(vi.getTimerCount()).toBe(0)
      expectDiagnosticLog(status, 'UPSTREAM_TIMEOUT')
    },
  )
})
