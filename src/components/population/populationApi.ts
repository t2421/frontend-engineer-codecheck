export const populationCategories = [
  { value: 'total', label: '総人口' },
  { value: 'young', label: '年少人口' },
  { value: 'working', label: '生産年齢人口' },
  { value: 'elder', label: '老年人口' },
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

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
function nonnegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}
function assert(condition: unknown, reason: string): asserts condition {
  if (!condition) throw new PopulationDataError(reason)
}

function parsePoint(raw: unknown, seenYears: Set<number>): PopulationPoint {
  assert(record(raw), 'point is not an object')
  const { year, value, rate } = raw
  assert(nonnegativeInteger(year), 'year is not a nonnegative integer')
  assert(nonnegativeInteger(value), 'value is not a nonnegative integer')
  assert(!seenYears.has(year), 'year is duplicated')
  if (rate !== undefined) {
    assert(typeof rate === 'number', 'rate is not a number')
    assert(
      Number.isFinite(rate) && rate >= 0 && rate <= 100,
      'rate is out of range',
    )
  }
  seenYears.add(year)
  return { year, value, ...(rate === undefined ? {} : { rate }) }
}

function parseSeries(raw: unknown): readonly PopulationPoint[] {
  assert(record(raw), 'series is not an object')
  assert(
    Array.isArray(raw.data) && raw.data.length,
    'series data is empty or invalid',
  )
  const seenYears = new Set<number>()
  return raw.data
    .map((point: unknown) => parsePoint(point, seenYears))
    .sort((a, b) => a.year - b.year)
}

function findSeries(data: readonly unknown[], label: string): unknown {
  const matches = data.filter(
    (series) => record(series) && series.label === label,
  )
  assert(matches.length === 1, 'required label is missing or duplicated')
  return matches[0]
}

export function parsePopulation(body: unknown): PopulationComposition {
  assert(
    record(body) && body.message === null && record(body.result),
    'response envelope is invalid',
  )
  const { boundaryYear, data } = body.result
  assert(
    nonnegativeInteger(boundaryYear),
    'boundaryYear is not a nonnegative integer',
  )
  assert(Array.isArray(data), 'data is not an array')
  const categories = {} as PopulationComposition['categories']
  for (const { value, label } of populationCategories)
    categories[value] = parseSeries(findSeries(data, label))
  return { boundaryYear, categories }
}
export async function fetchPopulation(
  prefCode: number,
  fetcher: typeof fetch = fetch,
): Promise<PopulationComposition> {
  assert(
    Number.isInteger(prefCode) && prefCode >= 1 && prefCode <= 47,
    'prefecture code is invalid',
  )
  try {
    const response = await fetcher(
      `/api/v1/population/composition/perYear?prefCode=${prefCode}`,
      { method: 'GET', signal: AbortSignal.timeout(15000) },
    )
    assert(response.ok, 'HTTP request failed')
    return parsePopulation(await response.json())
  } catch (error) {
    if (error instanceof PopulationDataError) throw error
    throw new PopulationDataError('request failed', { cause: error })
  }
}
