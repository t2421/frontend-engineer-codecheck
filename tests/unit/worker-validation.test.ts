import { expect, test } from 'vitest'
import { isValidResponse, validateRequest } from '../../worker/validation'

const prefecturesPath = '/api/v1/prefectures'
const populationPath = '/api/v1/population/composition/perYear'

test.each([
  [prefecturesPath, prefecturesPath],
  [`${populationPath}?prefCode=1`, `${populationPath}?prefCode=1`],
  [`${populationPath}?prefCode=47`, `${populationPath}?prefCode=47`],
  [`${populationPath}?pref%43ode=%31`, `${populationPath}?prefCode=1`],
])(
  'validates and normalizes %s without changing its input URL',
  (input, path) => {
    const url = new URL(`https://untrusted.test${input}`)
    const original = url.href
    expect(validateRequest('GET', url)).toEqual({ ok: true, path })
    expect(url.href).toBe(original)
  },
)

test.each([
  ['/api/unknown', 'POST', 404, 'NOT_FOUND'],
  [prefecturesPath, 'POST', 405, 'METHOD_NOT_ALLOWED'],
  [
    `${prefecturesPath}?url=https://untrusted.test`,
    'GET',
    400,
    'INVALID_REQUEST',
  ],
  [populationPath, 'GET', 400, 'INVALID_REQUEST'],
  [`${populationPath}?prefCode=01`, 'GET', 400, 'INVALID_REQUEST'],
  [`${populationPath}?prefCode=48`, 'GET', 400, 'INVALID_REQUEST'],
  [`${populationPath}?prefCode=1&prefCode=2`, 'GET', 400, 'INVALID_REQUEST'],
  [`${populationPath}?prefCode=1&cityCode=-`, 'GET', 400, 'INVALID_REQUEST'],
])(
  'rejects %s (%s) without changing its input URL',
  (input, method, status, code) => {
    const url = new URL(`https://example.test${input}`)
    const original = url.href
    expect(validateRequest(method, url)).toEqual({ ok: false, status, code })
    expect(url.href).toBe(original)
  },
)

test.each([
  { message: null, result: [{ prefCode: 1, prefName: '北海道' }] },
  { message: null, result: { boundaryYear: 2020, data: [] } },
])('accepts a successful JSON envelope without changing the data', (data) => {
  const original = structuredClone(data)
  expect(isValidResponse(data, 'test-secret')).toBe(true)
  expect(data).toEqual(original)
})

test.each([
  undefined,
  null,
  [],
  {},
  { result: {} },
  { message: 'error', result: {} },
  { message: null, result: null },
  { message: null, result: 'invalid' },
])('rejects invalid envelope %j', (data) => {
  expect(isValidResponse(data, 'test-secret')).toBe(false)
})

test.each(['test-secret', 'test-"secret\\value'])(
  'rejects reflected Secret in data and field names (%s)',
  (secret) => {
    expect(
      isValidResponse({ message: null, result: { value: secret } }, secret),
    ).toBe(false)
    expect(
      isValidResponse({ message: null, result: { [secret]: true } }, secret),
    ).toBe(false)
  },
)
