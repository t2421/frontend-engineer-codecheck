import { expect, type Page } from '@playwright/test'

// Viteのdev chunkからChart.jsの実体を読み、実際に描画されたチャートの状態を取り出す。
// 代替の描画エンジンではなく本物のregistryを見るため、dev server前提である。
export function chartSnapshot(page: Page) {
  return page.evaluate(async () => {
    const moduleUrl = performance
      .getEntriesByType('resource')
      .map((entry) => entry.name)
      .find((name) => new URL(name).pathname.endsWith('/chart__js.js'))
    if (!moduleUrl) throw new Error('Chart.js module was not loaded')
    const { Chart } = (await import(moduleUrl)) as typeof import('chart.js')
    const canvas = document.querySelector('canvas')
    const chart = canvas
      ? (Chart.getChart(canvas) as
          | import('chart.js').Chart<'line', import('chart.js').Point[]>
          | undefined)
      : undefined
    const font = `${chart?.options.font?.size ?? Chart.defaults.font.size}px ${chart?.options.font?.family ?? Chart.defaults.font.family}`
    const measure = (text: string) => {
      if (!chart) return 0
      chart.ctx.save()
      chart.ctx.font = font
      const width = chart.ctx.measureText(text).width
      chart.ctx.restore()
      return width
    }
    return {
      count: Object.keys(Chart.instances).length,
      id: chart?.id,
      datasets: chart?.data.datasets,
      axes: chart
        ? { x: chart.scales.x?.type, y: chart.scales.y?.type }
        : undefined,
      width: chart?.width,
      xTicks: chart?.scales.x?.ticks.map((t) => t.value),
      yTicks: chart?.scales.y?.ticks.map((t) => t.label),
      tickLabels: chart?.scales.x?.ticks.map((t) => ({
        x: chart.scales.x?.getPixelForValue(t.value) ?? 0,
        width: measure(String(t.label)),
      })),
      tooltip: chart?.tooltip
        ? {
            title: chart.tooltip.title,
            body: (chart.tooltip.body ?? []).map((b) => b.lines),
          }
        : undefined,
      points: chart
        ?.getDatasetMeta(0)
        .data.map((p: { x: number; y: number }) => ({ x: p.x, y: p.y })),
    }
  })
}

export type ChartSnapshot = Awaited<ReturnType<typeof chartSnapshot>>

export const xTickRange = async (page: Page) => {
  const { xTicks } = await chartSnapshot(page)
  return [xTicks?.[0], xTicks?.at(-1)]
}

export const datasetLabels = async (page: Page) =>
  (await chartSnapshot(page)).datasets?.map((d) => d.label)

// Canvasに何かしら描かれていることを確認する（全画素が透明ではない）。
export async function expectCanvasDrawn(page: Page) {
  const drawn = await page.locator('canvas').evaluate((canvas) => {
    const element = canvas as HTMLCanvasElement
    const context = element.getContext('2d')
    if (!context) return false
    return context
      .getImageData(0, 0, element.width, element.height)
      .data.some((value) => value !== 0)
  })
  expect(drawn).toBe(true)
}

// Chart.jsのresponsive幅が整うのを待つ。幅ごとの余白はレイアウトの既知の値。
export function expectedCanvasWidth(viewportWidth: number) {
  if (viewportWidth >= 1024) return viewportWidth - 210
  if (viewportWidth >= 640) return viewportWidth - 114
  return viewportWidth - 66
}
export async function resizeAndWaitForChart(
  page: Page,
  width: number,
  height = 1100,
) {
  await page.setViewportSize({ width, height })
  await expect
    .poll(() =>
      page
        .locator('canvas')
        .evaluate((c) => Math.round(c.getBoundingClientRect().width)),
    )
    .toBe(expectedCanvasWidth(width))
}

// 隣り合う年ラベルが重ならず、末尾のラベルがプロット幅に収まっていることを確認する。
export function expectTickLabelsFit(snapshot: ChartSnapshot, minimumGap = 0) {
  const { tickLabels, width } = snapshot
  if (!tickLabels || width === undefined)
    throw new Error('グラフの目盛りがありません')
  for (let i = 1; i < tickLabels.length; i++) {
    const previous = tickLabels[i - 1]
    const next = tickLabels[i]
    if (!previous || !next) throw new Error('隣接するラベルがありません')
    expect(
      next.x - next.width / 2 - (previous.x + previous.width / 2),
    ).toBeGreaterThanOrEqual(minimumGap)
  }
  for (const label of tickLabels) {
    expect(label.x - label.width / 2).toBeGreaterThanOrEqual(0)
    expect(label.x + label.width / 2).toBeLessThanOrEqual(width)
  }
}
