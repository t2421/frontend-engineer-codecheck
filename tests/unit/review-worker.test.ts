import { beforeEach, describe, expect, test, vi } from 'vitest'
import worker from '../../worker/review'

const productionOrigin = 'https://population-viewer.t2421-loop.workers.dev'
const prefecturesPath = '/api/v1/prefectures'
const populationPath = '/api/v1/population/composition/perYear'
const data = { message: null, result: [{ prefCode: 1, prefName: '北海道' }] }
const fetchProduction = vi.fn<typeof fetch>()

const previewRequest = (path = prefecturesPath, init?: RequestInit) =>
  worker.fetch(new Request(`https://preview.test${path}`, init))

beforeEach(() => {
  fetchProduction.mockReset().mockResolvedValue(Response.json(data))
  vi.stubGlobal('fetch', fetchProduction)
})

describe('PR Preview用Worker: 本番APIへの中継', () => {
  test.each([
    prefecturesPath,
    `${populationPath}?prefCode=1`,
    `${populationPath}?prefCode=47`,
  ])('%s を認証情報・IPを付けずに本番APIへGETで中継する', async (path) => {
    fetchProduction.mockResolvedValue(
      Response.json(data, {
        headers: { 'Set-Cookie': 'private', 'X-API-KEY': 'private' },
      }),
    )
    const response = await previewRequest(path, {
      headers: {
        Authorization: 'private',
        Cookie: 'private',
        'X-API-KEY': 'private',
        'CF-Connecting-IP': '192.0.2.1',
        'X-Forwarded-For': '192.0.2.2',
      },
    })
    expect(fetchProduction).toHaveBeenCalledExactlyOnceWith(
      `${productionOrigin}${path}`,
      {
        method: 'GET',
        headers: { Accept: 'application/json' },
        redirect: 'manual',
        signal: expect.any(AbortSignal),
      },
    )
    expect(await response.json()).toEqual(data)
    expect([...response.headers]).toEqual([
      ['cache-control', 'no-store'],
      ['content-type', 'application/json'],
    ])
  })

  test.each([
    [prefecturesPath, 'POST', 405],
    [prefecturesPath, 'HEAD', 405],
    ['/api/unknown', 'GET', 404],
    ['/', 'GET', 404],
    [`${prefecturesPath}?url=https://attacker.test`, 'GET', 400],
    [populationPath, 'GET', 400],
    [`${populationPath}?prefCode=48`, 'GET', 400],
    [`${populationPath}?prefCode=1&prefCode=2`, 'GET', 400],
    [`${populationPath}?prefCode=1&url=https://attacker.test`, 'GET', 400],
  ])(
    '不正な要求 %s（%s）を本番APIへ送らず %d で拒否する',
    async (path, method, status) => {
      const response = await previewRequest(path, { method })
      expect(response.status).toBe(status)
      if (status === 405) expect(response.headers.get('Allow')).toBe('GET')
      expect(fetchProduction).not.toHaveBeenCalled()
    },
  )
})

describe('PR Preview用Worker: 本番APIの失敗を安全に返す', () => {
  test.each([
    [429, 'RATE_LIMITED'],
    [503, 'SERVICE_UNAVAILABLE'],
    [502, 'UPSTREAM_ERROR'],
    [504, 'UPSTREAM_TIMEOUT'],
  ])(
    '本番APIの %d %s は固定コードと Retry-After だけを返す',
    async (status, error) => {
      fetchProduction.mockResolvedValue(
        Response.json(
          { error, detail: 'private' },
          { status, headers: { 'Retry-After': '10', 'Set-Cookie': 'private' } },
        ),
      )
      const response = await previewRequest()
      expect(response.status).toBe(status)
      expect(await response.json()).toEqual({ error })
      expect(response.headers.get('Retry-After')).toBe('10')
      expect(response.headers.get('Set-Cookie')).toBeNull()
    },
  )

  test.each([
    {
      name: 'リダイレクト',
      response: () =>
        new Response('private', {
          status: 302,
          headers: { Location: 'https://attacker.test' },
        }),
    },
    {
      name: 'HTMLの応答',
      response: () =>
        new Response('private', { headers: { 'Content-Type': 'text/html' } }),
    },
    {
      name: 'JSONでない本文',
      response: () =>
        new Response('private', {
          headers: { 'Content-Type': 'application/json' },
        }),
    },
    {
      name: '未知のエラーコード',
      response: () => Response.json({ error: 'private' }, { status: 500 }),
    },
    {
      name: '成功形式でない200',
      response: () => Response.json({ message: 'private', result: null }),
    },
  ])('想定外の応答（$name）は詳細を出さず 502 にする', async ({ response }) => {
    fetchProduction.mockResolvedValue(response())
    const result = await previewRequest()
    expect(result.status).toBe(502)
    expect(await result.json()).toEqual({ error: 'UPSTREAM_ERROR' })
    expect(result.headers.get('Location')).toBeNull()
  })

  test('通信例外は詳細を出さず 502 にする', async () => {
    fetchProduction.mockRejectedValue(new Error('private'))
    const response = await previewRequest()
    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({ error: 'UPSTREAM_ERROR' })
  })

  test.each([
    { phase: 'ヘッダー', stall: 'headers' },
    { phase: '本文', stall: 'body' },
  ])('本番APIの$phase待ちが止まっても12秒で 504 にする', async ({ stall }) => {
    const controller = new AbortController()
    const timeout = vi
      .spyOn(AbortSignal, 'timeout')
      .mockReturnValue(controller.signal)
    const abortsOnSignal = new Promise<never>((_, reject) =>
      controller.signal.addEventListener('abort', () =>
        reject(new Error('private')),
      ),
    )
    if (stall === 'headers') {
      fetchProduction.mockReturnValue(abortsOnSignal)
    } else {
      fetchProduction.mockResolvedValue(
        new Response(
          new ReadableStream({
            start(stream) {
              abortsOnSignal.catch((error) => stream.error(error))
            },
          }),
          { headers: { 'Content-Type': 'application/json' } },
        ),
      )
    }
    const pending = previewRequest()
    await Promise.resolve()
    controller.abort()
    const response = await pending
    expect(timeout).toHaveBeenCalledWith(12_000)
    expect(response.status).toBe(504)
    expect(await response.json()).toEqual({ error: 'UPSTREAM_TIMEOUT' })
  })
})
