import { withRequestTimeout } from '../shared/apiRequest'
import { isRecord } from '../shared/jsonRecord'
import { isPrefectureCode } from '../prefectures/prefectureCode'

export const populationCategories = [
  { value: 'total', label: '総人口', apiLabel: '総人口' },
  { value: 'young', label: '年少人口', apiLabel: '年少人口' },
  { value: 'working', label: '生産年齢人口', apiLabel: '生産年齢人口' },
  { value: 'elder', label: '老年人口', apiLabel: '老年人口' },
] as const
export type PopulationCategory = (typeof populationCategories)[number]['value']
export interface PopulationPoint {
  year: number
  value: number
  rate?: number
}
export interface PopulationComposition {
  boundaryYear: number
  categories: Record<PopulationCategory, readonly PopulationPoint[]>
}
export interface SelectedPrefecture {
  prefCode: number
  prefName: string
}
export interface PopulationSeries extends SelectedPrefecture {
  boundaryYear: number
  data: readonly PopulationPoint[]
}
export const POPULATION_FETCH_ERROR = '人口データを取得できませんでした'

export class PopulationDataError extends Error {
  constructor(reason: string, options?: { cause?: unknown }) {
    super(POPULATION_FETCH_ERROR, options)
    this.name = 'PopulationDataError'
    this.reason = reason
  }
  readonly reason: string
}

interface SuccessEnvelope {
  message: null
  result: Record<string, unknown>
}

function isNonnegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}
function isPercentage(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 100
}
function isSuccessEnvelope(body: unknown): body is SuccessEnvelope {
  return isRecord(body) && body.message === null && isRecord(body.result)
}
function assert(condition: unknown, reason: string): asserts condition {
  if (!condition) throw new PopulationDataError(reason)
}

function parseRate(raw: unknown): number | undefined {
  if (raw === undefined) return undefined
  assert(typeof raw === 'number', 'rate is not a number')
  assert(isPercentage(raw), 'rate is out of range')
  return raw
}

function parsePoint(raw: unknown, seenYears: Set<number>): PopulationPoint {
  assert(isRecord(raw), 'point is not an object')
  const { year, value } = raw
  assert(isNonnegativeInteger(year), 'year is not a nonnegative integer')
  assert(isNonnegativeInteger(value), 'value is not a nonnegative integer')
  assert(!seenYears.has(year), 'year is duplicated')
  const rate = parseRate(raw.rate)
  seenYears.add(year)
  return rate === undefined ? { year, value } : { year, value, rate }
}

function parseSeries(raw: unknown): readonly PopulationPoint[] {
  assert(isRecord(raw), 'series is not an object')
  assert(
    Array.isArray(raw.data) && raw.data.length,
    'series data is empty or invalid',
  )
  const seenYears = new Set<number>()
  return raw.data
    .map((point: unknown) => parsePoint(point, seenYears))
    .sort((a, b) => a.year - b.year)
}

function findSeriesByLabel(data: readonly unknown[], label: string): unknown {
  const matches = data.filter(
    (series) => isRecord(series) && series.label === label,
  )
  assert(matches.length === 1, 'required label is missing or duplicated')
  return matches[0]
}

function parseCategories(
  data: readonly unknown[],
): PopulationComposition['categories'] {
  const entries = populationCategories.map(({ value, apiLabel }) => [
    value,
    parseSeries(findSeriesByLabel(data, apiLabel)),
  ])
  return Object.fromEntries(entries) as PopulationComposition['categories']
}

export function parsePopulation(body: unknown): PopulationComposition {
  assert(isSuccessEnvelope(body), 'response envelope is invalid')
  const { boundaryYear, data } = body.result
  assert(
    isNonnegativeInteger(boundaryYear),
    'boundaryYear is not a nonnegative integer',
  )
  assert(Array.isArray(data), 'data is not an array')
  return { boundaryYear, categories: parseCategories(data) }
}
export async function fetchPopulation(
  prefCode: number,
  fetcher: typeof fetch = fetch,
): Promise<PopulationComposition> {
  assert(isPrefectureCode(prefCode), 'prefecture code is invalid')
  try {
    const response = await fetcher(
      `/api/v1/population/composition/perYear?prefCode=${prefCode}`,
      { method: 'GET', signal: withRequestTimeout() },
    )
    assert(response.ok, 'HTTP request failed')
    return parsePopulation(await response.json())
  } catch (error) {
    if (error instanceof PopulationDataError) throw error
    throw new PopulationDataError('request failed', { cause: error })
  }
}
