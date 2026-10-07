import { expect, test } from 'vitest'
import {
  createPopulationChartData,
  seriesStyle,
  mobileYearTicks,
} from '../../src/features/population/populationChartData'
import { series } from '../fixtures/populationChart'

test('スマホ目盛りは指定4年をデータ範囲内だけ返し、欠けた年のデータ点は追加しない', () => {
  const input = [
    {
      ...series[0]!,
      data: [
        { year: 1970, value: 100 },
        { year: 1990, value: 200 },
      ],
    },
  ]
  const original = structuredClone(input)
  expect(mobileYearTicks(series)).toEqual([1960, 1980, 2000, 2020])
  expect(mobileYearTicks(input)).toEqual([1980])
  expect(
    mobileYearTicks([
      {
        ...series[0]!,
        data: [
          { year: 2005, value: 100 },
          { year: 2015, value: 200 },
        ],
      },
    ]),
  ).toEqual([])
  expect(
    mobileYearTicks([{ ...series[0]!, data: [{ year: 2020, value: 100 }] }]),
  ).toEqual([2020])
  expect(mobileYearTicks([])).toEqual([])
  expect(input).toEqual(original)
})
test.each([1, 5])(
  '%i年刻みの全ての年・人数を目盛りと独立して保持する',
  (step) => {
    const input = [
      {
        ...series[0]!,
        data: Array.from({ length: 60 / step + 1 }, (_, i) => ({
          year: 1960 + i * step,
          value: 100 + i,
        })),
      },
    ]
    expect(mobileYearTicks(input)).toEqual([1960, 1980, 2000, 2020])
    expect(
      createPopulationChartData(input, ['blue', 'green', 'orange']).datasets[0]!
        .data,
    ).toEqual(input[0]!.data.map((p) => ({ x: p.year, y: p.value })))
  },
)

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
test('47県で色・線種・マーカーの組み合わせが固有かつ選択順や解除によらず固定', () => {
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
