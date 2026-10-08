import { describe, expect, test } from 'vitest'
import {
  isSafeUpstreamResponse,
  validateRequest,
} from '../../worker/validation'

const prefecturesPath = '/api/v1/prefectures'
const populationPath = '/api/v1/population/composition/perYear'
const url = (path: string) => new URL(`https://untrusted.test${path}`)

describe('validateRequest', () => {
  test.each([
    [prefecturesPath, prefecturesPath],
    [`${populationPath}?prefCode=1`, `${populationPath}?prefCode=1`],
    [`${populationPath}?prefCode=47`, `${populationPath}?prefCode=47`],
    // percent-encoded でも復号した値で検証し、上流には正規化したパスを渡す。
    [`${populationPath}?pref%43ode=%31`, `${populationPath}?prefCode=1`],
  ])('%s を許可し、上流パス %s に正規化する', (input, upstreamPath) => {
    expect(validateRequest('GET', url(input))).toEqual({
      ok: true,
      upstreamPath,
    })
  })

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
    [`${populationPath}?cityCode=1`, 'GET', 400, 'INVALID_REQUEST'],
    [`${populationPath}?prefCode=`, 'GET', 400, 'INVALID_REQUEST'],
    [`${populationPath}?prefCode=01`, 'GET', 400, 'INVALID_REQUEST'],
    [`${populationPath}?prefCode=48`, 'GET', 400, 'INVALID_REQUEST'],
    [`${populationPath}?prefCode=1&prefCode=2`, 'GET', 400, 'INVALID_REQUEST'],
    [`${populationPath}?prefCode=1&cityCode=-`, 'GET', 400, 'INVALID_REQUEST'],
  ])('%s（%s）を %d %s で拒否する', (input, method, status, code) => {
    expect(validateRequest(method, url(input))).toEqual({
      ok: false,
      status,
      code,
    })
  })
})

describe('isSafeUpstreamResponse', () => {
  const secret = 'test-secret'

  test.each([
    { message: null, result: [{ prefCode: 1, prefName: '北海道' }] },
    { message: null, result: { boundaryYear: 2020, data: [] } },
  ])('成功のenvelope %j を許可する', (data) => {
    expect(isSafeUpstreamResponse(data, secret)).toBe(true)
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
  ])('不正なenvelope %j を拒否する', (data) => {
    expect(isSafeUpstreamResponse(data, secret)).toBe(false)
  })

  test.each(['test-secret', 'test-"secret\\value'])(
    'Secret（%s）が値やキー名に反射した応答を拒否する',
    (reflected) => {
      expect(
        isSafeUpstreamResponse(
          { message: null, result: { value: reflected } },
          reflected,
        ),
      ).toBe(false)
      expect(
        isSafeUpstreamResponse(
          { message: null, result: { [reflected]: true } },
          reflected,
        ),
      ).toBe(false)
    },
  )

  test('Unicode escape で書かれたSecretの反射も、JSON解析後の値で検出する', () => {
    const data: unknown = JSON.parse(
      '{"message":null,"result":{"value":"test-\\u0073ecret"}}',
    )
    expect(isSafeUpstreamResponse(data, secret)).toBe(false)
  })
})
