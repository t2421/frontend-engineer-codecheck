import { populationPath, prefectureCount, prefecturesPath } from './config'
import { isSuccessEnvelope } from './envelope'

type RequestValidation =
  | { ok: true; upstreamPath: string }
  | { ok: false; status: 400 | 404 | 405; code: string }

const invalidRequest: RequestValidation = {
  ok: false,
  status: 400,
  code: 'INVALID_REQUEST',
}

function isKnownPath(pathname: string): boolean {
  return pathname === prefecturesPath || pathname === populationPath
}

// 先頭ゼロや空文字を拒み、1〜47の整数表記だけを通す。
function isPrefectureCodeParameter(value: string): boolean {
  return /^[1-9]\d?$/.test(value) && Number(value) <= prefectureCount
}

function validatePopulationQuery(
  parameters: URLSearchParams,
): RequestValidation {
  const prefCode = parameters.get('prefCode') ?? ''
  const hasOnlyPrefCode = parameters.size === 1
  if (!hasOnlyPrefCode || !isPrefectureCodeParameter(prefCode))
    return invalidRequest
  // 入力URLを変更せず、許可済みの値から上流向けのパスを作る。
  return { ok: true, upstreamPath: `${populationPath}?prefCode=${prefCode}` }
}

export function validateRequest(method: string, url: URL): RequestValidation {
  if (!isKnownPath(url.pathname))
    return { ok: false, status: 404, code: 'NOT_FOUND' }
  if (method !== 'GET')
    return { ok: false, status: 405, code: 'METHOD_NOT_ALLOWED' }
  if (url.pathname === prefecturesPath) {
    const hasNoQuery = url.searchParams.size === 0
    return hasNoQuery
      ? { ok: true, upstreamPath: prefecturesPath }
      : invalidRequest
  }
  return validatePopulationQuery(url.searchParams)
}

// JSON解析後に同じ形式で直列化し、特殊文字やUnicode escapeによるSecret反射も検出する。
function containsApiKey(responseData: unknown, apiKey: string): boolean {
  const serializedResponse = JSON.stringify(responseData)
  const serializedApiKey = JSON.stringify(apiKey).slice(1, -1)
  return serializedResponse.includes(serializedApiKey)
}

export function isSafeUpstreamResponse(
  responseData: unknown,
  apiKey: string,
): boolean {
  return (
    isSuccessEnvelope(responseData) && !containsApiKey(responseData, apiKey)
  )
}
