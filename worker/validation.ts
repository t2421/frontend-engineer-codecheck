import { populationPath, prefecturesPath } from './config'

type RequestValidation =
  | { ok: true; path: string }
  | { ok: false; status: 400 | 404 | 405; code: string }

export function validateRequest(method: string, url: URL): RequestValidation {
  if (url.pathname !== prefecturesPath && url.pathname !== populationPath) {
    return { ok: false, status: 404, code: 'NOT_FOUND' }
  }
  if (method !== 'GET') {
    return { ok: false, status: 405, code: 'METHOD_NOT_ALLOWED' }
  }

  const parameters = [...url.searchParams]
  if (url.pathname === prefecturesPath) {
    if (parameters.length !== 0) {
      return { ok: false, status: 400, code: 'INVALID_REQUEST' }
    }
    return { ok: true, path: prefecturesPath }
  }

  const code = url.searchParams.get('prefCode') ?? ''
  if (
    parameters.length !== 1 ||
    parameters[0]?.[0] !== 'prefCode' ||
    !/^(?:[1-9]|[1-3][0-9]|4[0-7])$/.test(code)
  ) {
    return { ok: false, status: 400, code: 'INVALID_REQUEST' }
  }
  // 入力URLを変更せず、許可済みの値から上流向けのパスを作る。
  return {
    ok: true,
    path: `${populationPath}?${new URLSearchParams({ prefCode: code })}`,
  }
}

export function isValidResponse(data: unknown, key: string): boolean {
  // エラーenvelope・上流によるSecret反射をブラウザーへ返さない。
  return (
    typeof data === 'object' &&
    data !== null &&
    'message' in data &&
    data.message === null &&
    'result' in data &&
    typeof data.result === 'object' &&
    data.result !== null &&
    !JSON.stringify(data).includes(JSON.stringify(key).slice(1, -1))
  )
}
