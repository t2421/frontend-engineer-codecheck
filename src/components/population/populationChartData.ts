import type { ChartData, Point } from 'chart.js'
import type { PopulationSeries } from './populationApi'
import { PREFECTURE_COUNT } from '../prefectures/prefectureCode'

const DESKTOP_MIN_WIDTH = 768
const NARROW_MAX_WIDTH = 450
const TICK_LABEL_GAP = 8

function uniqueSortedYears(series: readonly PopulationSeries[]): number[] {
  const years = series.flatMap((s) => s.data.map((point) => point.year))
  return [...new Set(years)].sort((a, b) => a - b)
}

function everyOtherYearPlusLast(years: readonly number[]): number[] {
  const everyOther = years.filter((_, index) => index % 2 === 0)
  const last = years.at(-1)
  if (last === undefined || everyOther.at(-1) === last) return everyOther
  return [...everyOther, last]
}

// 最終年だけ詰まらないよう、末尾2つのラベルの間隔だけを確かめる。
function lastTwoLabelsOverlap(
  ticks: readonly number[],
  firstYear: number,
  lastYear: number,
  plotWidth: number,
  labelWidth: number,
): boolean {
  const secondToLast = ticks.at(-2)
  if (ticks.length <= 2 || secondToLast === undefined) return false
  const yearSpan = lastYear - firstYear
  const usableWidth = Math.max(0, plotWidth - labelWidth)
  const gap = ((lastYear - secondToLast) / yearSpan) * usableWidth
  return gap < labelWidth + TICK_LABEL_GAP
}

function withoutSecondToLast<T>(items: readonly T[]): T[] {
  return items.filter((_, index) => index !== items.length - 2)
}

export function yearTicks(
  series: readonly PopulationSeries[],
  viewportWidth = DESKTOP_MIN_WIDTH,
  plotWidth = Infinity,
  labelWidth = 0,
) {
  const years = uniqueSortedYears(series)
  const first = years[0]
  const last = years.at(-1)
  const showsEveryYear = viewportWidth >= DESKTOP_MIN_WIDTH || years.length < 2
  if (showsEveryYear || first === undefined || last === undefined) return years
  if (viewportWidth < NARROW_MAX_WIDTH) return [first, last]
  const ticks = everyOtherYearPlusLast(years)
  return lastTwoLabelsOverlap(ticks, first, last, plotWidth, labelWidth)
    ? withoutSecondToLast(ticks)
    : ticks
}

// 選択順に関わらず都道府県ごとに固定の色トークンを割り当てる。
export const seriesColorTokens = Array.from(
  { length: PREFECTURE_COUNT },
  (_, index) => `--color-series-${index + 1}`,
)
export function seriesStyle(prefCode: number) {
  return {
    colorIndex: prefCode - 1,
    borderDash: [],
    pointStyle: 'circle' as const,
  }
}
export function createPopulationChartData(
  series: readonly PopulationSeries[],
  colors: readonly string[],
): ChartData<'line', Point[]> {
  return {
    datasets: series.map((entry) => {
      const style = seriesStyle(entry.prefCode)
      return {
        label: entry.prefName,
        data: entry.data.map((point) => ({ x: point.year, y: point.value })),
        borderColor: colors[style.colorIndex],
        backgroundColor: colors[style.colorIndex],
        borderDash: style.borderDash,
        pointStyle: style.pointStyle,
        borderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 5,
        tension: 0,
      }
    }),
  }
}
