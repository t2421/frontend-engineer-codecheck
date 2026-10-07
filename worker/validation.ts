import { populationPath, prefecturesPath } from './config'

type RequestValidation =
  | { ok: true; upstreamPath: string }
  | { ok: false; status: 400 | 404 | 405; code: string }

export function validateRequest(method: string, url: URL): RequestValidation {
  if (url.pathname !== prefecturesPath && url.pathname !== populationPath) {
    return { ok: false, status: 404, code: 'NOT_FOUND' }
  }
  if (method !== 'GET') {
    return { ok: false, status: 405, code: 'METHOD_NOT_ALLOWED' }
  }

  const parameters = url.searchParams
  if (url.pathname === prefecturesPath) {
    return parameters.size === 0
      ? { ok: true, upstreamPath: prefecturesPath }
      : { ok: false, status: 400, code: 'INVALID_REQUEST' }
  }

  const prefCode = parameters.get('prefCode') ?? ''
  if (
    parameters.size !== 1 ||
    !/^[1-9]\d?$/.test(prefCode) ||
    Number(prefCode) > 47
  ) {
    return { ok: false, status: 400, code: 'INVALID_REQUEST' }
  }
  // 入力URLを変更せず、許可済みの値から上流向けのパスを作る。
  return {
    ok: true,
    upstreamPath: `${populationPath}?prefCode=${prefCode}`,
  }
}

export function isSafeUpstreamResponse(
  responseData: unknown,
  apiKey: string,
): boolean {
  if (typeof responseData !== 'object' || responseData === null) return false
  const { message, result } = responseData as Record<string, unknown>
  if (message !== null || typeof result !== 'object' || result === null) {
    return false
  }

  // JSON解析後に同じ形式で直列化し、特殊文字やUnicode escapeによるSecret反射も検出する。
  const serializedResponse = JSON.stringify(responseData)
  const serializedApiKey = JSON.stringify(apiKey).slice(1, -1)
  return !serializedResponse.includes(serializedApiKey)
}
