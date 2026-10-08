import { describe, expect, test } from 'vitest'
import {
  createPopulationChartData,
  seriesStyle,
  yearTicks,
} from '../../src/components/population/populationChartData'
import { series } from '../fixtures/populationChart'

const colors = Array.from({ length: 47 }, (_, i) => `color-${i + 1}`)
const fiveYearSteps = (count: number) =>
  Array.from({ length: count }, (_, i) => 1960 + i * 5)
const seriesWithYears = (years: number[]) => ({
  ...series[0]!,
  data: years.map((year) => ({ year, value: 100 })),
})

describe('yearTicks', () => {
  test('複数県の年を重複なく昇順にまとめる', () => {
    const input = [seriesWithYears([1985, 2025]), seriesWithYears([1963, 1985])]
    expect(yearTicks(input)).toEqual([1963, 1985, 2025])
    expect(yearTicks([])).toEqual([])
  })

  test.each([1, 2, 18, 61])('768px以上は%d点すべての年を表示する', (count) => {
    const years = fiveYearSteps(count)
    expect(yearTicks([seriesWithYears(years)], 768)).toEqual(years)
  })

  test('450px未満は最初と最後の年だけを表示する', () => {
    expect(yearTicks([seriesWithYears(fiveYearSteps(18))], 449)).toEqual([
      1960, 2045,
    ])
    expect(yearTicks([seriesWithYears([1963, 1964, 1979, 2057])], 320)).toEqual(
      [1963, 2057],
    )
  })

  test('450〜767pxは1つおきの年に最後の年を加えて表示する', () => {
    const years = fiveYearSteps(18)
    const everyOther = years.filter((_, i) => i % 2 === 0)
    expect(yearTicks([seriesWithYears(years)], 450)).toEqual([
      ...everyOther,
      2045,
    ])
    expect(
      yearTicks([seriesWithYears([1963, 1979, 1991, 2031, 2057])], 600),
    ).toEqual([1963, 1991, 2057])
  })

  test('中間幅で最後の2つのラベルが重なるときは、手前の年だけを省く', () => {
    const input = [seriesWithYears(fiveYearSteps(18))]
    expect(yearTicks(input, 450, 320, 27)).toEqual([
      1960, 1970, 1980, 1990, 2000, 2010, 2020, 2030, 2045,
    ])
    expect(yearTicks(input, 767, 650, 27)).toEqual([
      1960, 1970, 1980, 1990, 2000, 2010, 2020, 2030, 2040, 2045,
    ])
  })

  test('年が1つか2つなら幅に関わらずそのまま表示する', () => {
    expect(yearTicks([seriesWithYears([2024])], 320)).toEqual([2024])
    expect(yearTicks([seriesWithYears([1963, 2057])], 600)).toEqual([
      1963, 2057,
    ])
  })

  test('入力の系列を変更しない', () => {
    const input = [seriesWithYears([1963, 1964, 1979, 2057])]
    const original = structuredClone(input)
    yearTicks(input, 449)
    yearTicks(input, 600, 320, 27)
    expect(input).toEqual(original)
  })
})

describe('createPopulationChartData', () => {
  test('県名をラベルに、年と人数をx/y座標にした系列を作る', () => {
    const { datasets } = createPopulationChartData(series, colors)
    expect(datasets.map((d) => ({ label: d.label, data: d.data }))).toEqual([
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
    expect(createPopulationChartData([], colors).datasets).toEqual([])
  })

  test('色は県コードで固定し、選択順や他県の解除では変わらない', () => {
    expect(seriesStyle(13).colorIndex).toBe(12)
    const forward = createPopulationChartData(series, colors).datasets
    const reversed = createPopulationChartData(
      [...series].reverse(),
      colors,
    ).datasets
    const alone = createPopulationChartData(series.slice(1), colors).datasets
    expect(forward[0]?.borderColor).toBe('color-13')
    expect(reversed[1]).toEqual(forward[0])
    expect(alone[0]).toEqual(forward[1])
  })

  test('47県すべてを固有の色・実線・円マーカー・直線で描く', () => {
    const all = Array.from({ length: 47 }, (_, i) => ({
      ...series[0]!,
      prefCode: i + 1,
      prefName: `県${i + 1}`,
    }))
    const { datasets } = createPopulationChartData(all, colors)
    expect(new Set(datasets.map((d) => d.borderColor)).size).toBe(47)
    for (const dataset of datasets) {
      expect(dataset).toMatchObject({
        borderDash: [],
        pointStyle: 'circle',
        tension: 0,
      })
    }
  })

  test('入力の系列を変更しない', () => {
    const original = structuredClone(series)
    const { datasets } = createPopulationChartData(series, colors)
    datasets[0]!.data[0]!.y = 0
    expect(series).toEqual(original)
  })
})
