import { expect, test, vi } from 'vitest'
import worker from '../../worker'

test('API routes share an IP key and allowed requests remain unimplemented', async () => {
  const limit = vi.fn().mockResolvedValue({ success: true })
  for (const path of ['/api/prefectures', '/api/population']) {
    const response = await worker.fetch(
      new Request(`https://example.test${path}`, {
        headers: { 'CF-Connecting-IP': '192.0.2.1' },
      }),
      { API_RATE_LIMITER: { limit } },
    )
    expect(response.status).toBe(404)
  }
  expect(limit.mock.calls).toEqual([
    [{ key: 'ip:192.0.2.1' }],
    [{ key: 'ip:192.0.2.1' }],
  ])
})

test('denied API requests return 429 with retry guidance', async () => {
  const limit = vi.fn().mockResolvedValue({ success: false })
  const response = await worker.fetch(
    new Request('https://example.test/api/prefectures', {
      headers: { 'CF-Connecting-IP': '192.0.2.2' },
    }),
    { API_RATE_LIMITER: { limit } },
  )
  expect(response.status).toBe(429)
  expect(response.headers.get('Retry-After')).toBe('10')
  expect(limit).toHaveBeenCalledWith({ key: 'ip:192.0.2.2' })
})

test('static routes bypass the limiter, missing API IP fails closed', async () => {
  const limit = vi.fn()
  const env = { API_RATE_LIMITER: { limit } }
  expect(
    (await worker.fetch(new Request('https://example.test/'), env)).status,
  ).toBe(404)
  expect(
    (
      await worker.fetch(
        new Request('https://example.test/api/prefectures'),
        env,
      )
    ).status,
  ).toBe(503)
  expect(limit).not.toHaveBeenCalled()
})
