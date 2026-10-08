import { withRequestTimeout } from '../../utils/apiRequest'
import { isRecord } from '../../utils/jsonRecord'
import { isPrefectureCode } from './prefectureCode'

export interface Prefecture {
  prefCode: number
  prefName: string
}
export const prefectureFailure = '都道府県一覧を取得できませんでした'

interface PrefectureListResponse {
  message: null
  result: unknown[]
}

function isPrefectureListResponse(
  body: unknown,
): body is PrefectureListResponse {
  return (
    isRecord(body) &&
    body.message === null &&
    Array.isArray(body.result) &&
    body.result.length > 0
  )
}
function isPrefectureName(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}
function isPrefecture(value: unknown): value is Prefecture {
  return (
    isRecord(value) &&
    isPrefectureCode(value.prefCode) &&
    isPrefectureName(value.prefName)
  )
}
function hasDuplicateCodes(prefectures: readonly Prefecture[]): boolean {
  const codes = new Set(prefectures.map((prefecture) => prefecture.prefCode))
  return codes.size !== prefectures.length
}
function toPrefecture(value: unknown): Prefecture {
  if (!isPrefecture(value)) throw new Error(prefectureFailure)
  return { prefCode: value.prefCode, prefName: value.prefName }
}
export function parsePrefectures(body: unknown): Prefecture[] {
  if (!isPrefectureListResponse(body)) throw new Error(prefectureFailure)
  const prefectures = body.result.map(toPrefecture)
  if (hasDuplicateCodes(prefectures)) throw new Error(prefectureFailure)
  return prefectures
}
export async function fetchPrefectures(
  signal?: AbortSignal,
): Promise<Prefecture[]> {
  try {
    const response = await fetch('/api/v1/prefectures', {
      method: 'GET',
      signal: withRequestTimeout(signal),
    })
    if (!response.ok) throw new Error(prefectureFailure)
    return parsePrefectures(await response.json())
  } catch {
    throw new Error(prefectureFailure)
  }
}
