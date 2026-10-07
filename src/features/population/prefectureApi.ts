export interface Prefecture {
  prefCode: number
  prefName: string
}
export const prefectureFailure = '都道府県一覧を取得できませんでした'
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
export function parsePrefectures(body: unknown): Prefecture[] {
  if (
    !record(body) ||
    body.message !== null ||
    !Array.isArray(body.result) ||
    !body.result.length
  )
    throw new Error(prefectureFailure)
  const codes = new Set<number>()
  return body.result.map((value: unknown) => {
    if (
      !record(value) ||
      typeof value.prefCode !== 'number' ||
      !Number.isInteger(value.prefCode) ||
      value.prefCode < 1 ||
      value.prefCode > 47 ||
      codes.has(value.prefCode) ||
      typeof value.prefName !== 'string' ||
      !value.prefName.trim()
    )
      throw new Error(prefectureFailure)
    codes.add(value.prefCode)
    return { prefCode: value.prefCode, prefName: value.prefName }
  })
}
export async function fetchPrefectures(
  signal?: AbortSignal,
): Promise<Prefecture[]> {
  try {
    const response = await fetch('/api/v1/prefectures', {
      method: 'GET',
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(15000)])
        : AbortSignal.timeout(15000),
    })
    if (!response.ok) throw new Error(prefectureFailure)
    return parsePrefectures(await response.json())
  } catch {
    throw new Error(prefectureFailure)
  }
}
