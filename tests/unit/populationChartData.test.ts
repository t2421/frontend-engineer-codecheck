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
  '768px以上は全年度、450px未満は両端を表示し、不均一年も元データを変えない: %j',
  (...years) => {
    const input = withYears(years)
    const original = structuredClone(input)
    expect(yearTicks(input)).toEqual(years)
    expect(yearTicks(input, 449)).toEqual(
      years.length < 2 ? years : [years[0], years.at(-1)],
    )
    expect(input).toEqual(original)
  },
)
test.each([18, 61, 101])(
  'PCは%d点のすべての年を表示し、元の点を保持する',
  (count) => {
    const years = Array.from({ length: count }, (_, i) => 1960 + i * 5)
    const input = withYears(years)
    expect(yearTicks(input)).toEqual(years)
    expect(createPopulationChartData(input, []).datasets[0]?.data).toHaveLength(
      count,
    )
  },
)
test('県変更で年を重複なく並べ、狭い幅の両端も再計算する', () => {
  const input = [...withYears([1985, 2025]), ...withYears([1963, 1985, 2057])]
  expect(yearTicks(input)).toEqual([1963, 1985, 2025, 2057])
  expect(yearTicks(input, 449)).toEqual([1963, 2057])
  expect(yearTicks(input.slice(0, 1), 449)).toEqual([1985, 2025])
  expect(yearTicks([])).toEqual([])
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

test.each([449, 450, 767, 768])(
  '%dpxの境界で全年度・1つおき・両端を切り替える',
  (width) => {
    const years = Array.from({ length: 18 }, (_, i) => 1960 + i * 5)
    const expected =
      width < 450
        ? [1960, 2045]
        : width < 768
          ? [...years.filter((_, i) => i % 2 === 0), 2045]
          : years
    expect(yearTicks(withYears(years), width)).toEqual(expected)
  },
)
test('中間幅の末尾が近ければ直前だけを省き、最終年と元の18点を保持する', () => {
  const years = Array.from({ length: 18 }, (_, i) => 1960 + i * 5)
  const input = withYears(years)
  expect(yearTicks(input, 450, 320, 27)).toEqual([
    1960, 1970, 1980, 1990, 2000, 2010, 2020, 2030, 2045,
  ])
  expect(yearTicks(input, 767, 650, 27)).toEqual([
    1960, 1970, 1980, 1990, 2000, 2010, 2020, 2030, 2040, 2045,
  ])
  expect(input[0]?.data).toHaveLength(18)
})
test('中間幅は実年配列を使い、奇数個・1年・2年でも端年を重複させない', () => {
  expect(yearTicks(withYears([1963, 1979, 1991, 2031, 2057]), 600)).toEqual([
    1963, 1991, 2057,
  ])
  expect(yearTicks(withYears([2024]), 600)).toEqual([2024])
  expect(yearTicks(withYears([1963, 2057]), 600)).toEqual([1963, 2057])
})
