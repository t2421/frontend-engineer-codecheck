import { expect, test } from 'vitest'
import {
  createPopulationChartData,
  seriesStyle,
  yearTicks,
} from '../../src/components/population/populationChartData'
import { series } from '../fixtures/populationChart'

const withYears = (years: number[]) => [
  { ...series[0]!, data: years.map((year) => ({ year, value: 100 })) },
]
test.each([[2024], [1963, 2057], [1963, 1964, 1979, 2020, 2057]])(
  '最初と最新の年を含め、不均一年も元データを変更しない: %j',
  (...years) => {
    const input = withYears(years)
    const original = structuredClone(input)
    const ticks = yearTicks(input, 240, 32)
    expect(ticks[0]).toBe(Math.min(...years))
    expect(ticks.at(-1)).toBe(Math.max(...years))
    expect(new Set(ticks).size).toBe(ticks.length)
    expect(input).toEqual(original)
  },
)
test('幅とラベルサイズで間引き、端の推計年を残し、全データ点を保持する', () => {
  const years = Array.from({ length: 101 }, (_, i) => 1963 + i)
  const input = withYears(years)
  for (const [width, labelWidth] of [
    [240, 32],
    [640, 32],
    [240, 60],
  ]) {
    const ticks = yearTicks(input, width!, labelWidth!)
    expect(ticks[0]).toBe(1963)
    expect(ticks.at(-1)).toBe(2063)
    for (let i = 1; i < ticks.length; i++)
      expect(
        ((ticks[i]! - ticks[i - 1]!) / 100) * (width! - labelWidth!),
      ).toBeGreaterThanOrEqual(labelWidth! + 16)
  }
  expect(yearTicks(input, 640, 32).length).toBeGreaterThan(
    yearTicks(input, 240, 32).length,
  )
  expect(yearTicks(input, 240, 60).length).toBeLessThan(
    yearTicks(input, 240, 32).length,
  )
  expect(createPopulationChartData(input, []).datasets[0]!.data).toHaveLength(
    101,
  )
  expect(yearTicks([], 240, 32)).toEqual([])
})
test('県変更で範囲の端を再計算する', () => {
  const input = [...withYears([1985, 2025]), ...withYears([1963, 2057])]
  expect(yearTicks(input, 240, 32)).toEqual(
    expect.arrayContaining([1963, 2057]),
  )
  expect(yearTicks(input.slice(0, 1), 240, 32)).toEqual([1985, 2025])
})

test('異なる年の県も数値座標で正しい年・人数を保持し入力を変更しない', () => {
  const original = structuredClone(series)
  const data = createPopulationChartData(series, ['blue', 'green', 'orange'])
  expect(data.datasets.map((d) => ({ label: d.label, data: d.data }))).toEqual([
    {
      label: '東京都',
      data: [
        { x: 1960, y: 9000000 },
        { x: 2020, y: 14000000 },
      ],
    },
    {
      label: '北海道',
      data: [
        { x: 1970, y: 5000000 },
        { x: 2020, y: 5200000 },
      ],
    },
  ])
  data.datasets[0]!.data[0]!.y = 0
  expect(series).toEqual(original)
  expect(createPopulationChartData([], []).datasets).toEqual([])
})
test('47県で色の割当が固有かつ選択順や解除によらず固定', () => {
  expect(
    Array.from({ length: 47 }, (_, i) => seriesStyle(i + 1).colorIndex),
  ).toEqual(Array.from({ length: 47 }, (_, i) => i))
  const styles = Array.from({ length: 47 }, (_, i) => seriesStyle(i + 1))
  expect(new Set(styles.map((s) => JSON.stringify(s))).size).toBe(47)
  const forward = createPopulationChartData(series, [
    'blue',
    'green',
    'orange',
  ]).datasets
  const reversed = createPopulationChartData([...series].reverse(), [
    'blue',
    'green',
    'orange',
  ]).datasets
  expect(reversed[0]).toEqual(forward[1])
  expect(
    createPopulationChartData(series.slice(1), ['blue', 'green', 'orange'])
      .datasets[0],
  ).toEqual(forward[1])
})

test('47県は固有の固定色、実線、直線補間で描き選択順で色が変わらない', () => {
  const colors = Array.from({ length: 47 }, (_, i) => `color-${i}`)
  const input = Array.from({ length: 47 }, (_, i) => ({
    ...series[0]!,
    prefCode: i + 1,
    prefName: `県${i + 1}`,
  }))
  const forward = createPopulationChartData(input, colors).datasets
  expect(new Set(forward.map((d) => d.borderColor)).size).toBe(47)
  for (const dataset of forward) {
    expect(dataset.borderDash).toEqual([])
    expect(dataset.pointStyle).toBe('circle')
    expect(dataset.tension).toBe(0)
  }
  expect(
    createPopulationChartData([...input].reverse(), colors).datasets,
  ).toEqual([...forward].reverse())
  expect(
    createPopulationChartData(input.slice(10, 11), colors).datasets[0],
  ).toEqual(forward[10])
})

test('18点の端年を含め、ラベルの区間数をほぼ均等に分割する', () => {
  const years = Array.from({ length: 18 }, (_, i) => 1960 + i * 5)
  for (const width of [240, 320, 640, 1200]) {
    const ticks = yearTicks(withYears(years), width, 32)
    const indexes = ticks.map((year) => years.indexOf(year))
    const intervals = indexes
      .slice(1)
      .map((index, i) => index - (indexes[i] ?? index))
    expect(indexes[0]).toBe(0)
    expect(indexes.at(-1)).toBe(17)
    expect(Math.max(...intervals) - Math.min(...intervals)).toBeLessThanOrEqual(
      1,
    )
  }
})

test('非PCでは描画幅にかかわらず実年範囲の両端だけを表示する', () => {
  const years = Array.from({ length: 18 }, (_, i) => 1960 + i * 5)
  for (const width of [240, 640, 1200]) {
    expect(yearTicks(withYears(years), width, 32, true)).toEqual([1960, 2045])
  }
  expect(yearTicks(withYears([2024]), 240, 32, true)).toEqual([2024])
  expect(
    yearTicks(withYears([1963, 1964, 1979, 2020, 2057]), 240, 32, true),
  ).toEqual([1963, 2057])
})
