import { expect, test, type Page } from '@playwright/test'
import { expectNoHorizontalOverflow } from './layout'
import { captureScreenshot } from './screenshot'
import {
  chartSnapshot,
  datasetLabels,
  expectCanvasDrawn,
  expectTickLabelsFit,
  resizeAndWaitForChart,
  xTickRange,
} from './chart'
import { categoryRadio, clearSelection, emptyStatus, legendItems } from './app'
import { prefectureResponse, appPopulationResponse } from '../fixtures/appApi'

// 確認ページの合成データ。東京都の総人口は 1960年から10年刻みで 7,600,000 人から始まる。
const tokyoTotal = [760, 980, 1140, 1230, 1330, 1410, 1430].map((v, i) => ({
  x: 1960 + i * 10,
  y: v * 10000,
}))
const categoryFactors = [
  ['年少人口', 0.12],
  ['生産年齢人口', 0.6],
  ['老年人口', 0.28],
  ['総人口', 1],
] as const

async function openChartFixture(page: Page, width: number, years?: string) {
  await page.setViewportSize({ width, height: 1100 })
  await page.goto(
    `/tests/preview/population-chart.html${years ? `?years=${years}` : ''}`,
  )
}
const checkbox = (page: Page, name: string) =>
  page.getByRole('checkbox', { name, exact: true })
const chartImage = (page: Page) =>
  page.getByRole('img', { name: /総人口の人口推移/ })

async function hoverFirstPoints(page: Page, index: number) {
  const canvas = page.locator('canvas')
  await canvas.scrollIntoViewIfNeeded()
  const point = (await chartSnapshot(page)).points?.[index]
  const box = await canvas.boundingBox()
  if (!point || !box) throw new Error('グラフの点が見つかりません')
  await page.mouse.move(box.x + point.x, box.y + point.y)
}

test.describe('PopulationChart（確認ページ・合成データ）', () => {
  for (const width of [1440, 390]) {
    test(`${width}px: 県を選ぶとChart.jsで描画し、区分の切替は同じインスタンスを更新する`, async ({
      page,
    }) => {
      await openChartFixture(page, width)
      await expect(emptyStatus(page)).toBeVisible()
      await expect.poll(async () => (await chartSnapshot(page)).count).toBe(0)

      await checkbox(page, '東京都').check()
      await checkbox(page, '北海道').check()
      await expect(chartImage(page)).toBeVisible()
      const initial = await chartSnapshot(page)
      expect(initial.count).toBe(1)
      expect(initial.axes).toEqual({ x: 'linear', y: 'linear' })
      expect(initial.datasets?.map((d) => d.label)).toEqual([
        '東京都',
        '北海道',
      ])
      expect(initial.datasets?.[0]?.data).toEqual(tokyoTotal)
      expect(
        initial.points?.every(
          (p) => Number.isFinite(p.x) && Number.isFinite(p.y),
        ),
      ).toBe(true)
      expect(initial.yTicks?.map(String)).toContain('0')
      await expectCanvasDrawn(page)

      for (const [label, factor] of categoryFactors) {
        await categoryRadio(page, label).check()
        await expect(page.locator('canvas')).toHaveAttribute(
          'aria-label',
          new RegExp(label),
        )
        const current = await chartSnapshot(page)
        expect(current.id).toBe(initial.id)
        expect(current.count).toBe(1)
        expect(await xTickRange(page)).toEqual([1960, 2020])
        expect(current.datasets?.[0]?.data[0]?.y).toBe(
          Math.round(7600000 * factor),
        )
        expectTickLabelsFit(current, 8)
      }
      await expect(checkbox(page, '東京都')).toBeChecked()
    })
  }

  test('読み上げ向けの説明と年別の表は視覚的に隠し、canvasから説明を参照する', async ({
    page,
  }) => {
    await openChartFixture(page, 1440)
    await checkbox(page, '東京都').check()
    await expect(chartImage(page)).toBeVisible()
    await expect(page.locator('figcaption')).toHaveCount(0)
    await expect(page.locator('details, summary')).toHaveCount(0)
    await expect(page.locator('.chart-description')).toHaveCSS(
      'clip-path',
      'inset(50%)',
    )
    await expect(page.locator('canvas')).toHaveAccessibleDescription(
      /横軸は年、縦軸は人口数/,
    )
    await expect(
      page.getByRole('cell', { name: '7,600,000人', exact: true }),
    ).toHaveCount(1)
  })

  test('解除・全解除・再選択を繰り返してもインスタンスは常に1つ以下で、領域の除去で破棄する', async ({
    page,
  }) => {
    await openChartFixture(page, 1440)
    await checkbox(page, '東京都').check()
    await checkbox(page, '北海道').check()
    await expect(chartImage(page)).toBeVisible()
    await checkbox(page, '東京都').uncheck()
    await expect.poll(() => datasetLabels(page)).toEqual(['北海道'])
    await checkbox(page, '北海道').uncheck()
    await expect(emptyStatus(page)).toBeVisible()
    await expect.poll(async () => (await chartSnapshot(page)).count).toBe(0)

    for (let i = 0; i < 3; i++) {
      await checkbox(page, '東京都').check()
      await expect.poll(async () => (await chartSnapshot(page)).count).toBe(1)
      await checkbox(page, '東京都').uncheck()
      await expect(page.locator('canvas')).toHaveCount(0)
      await expect.poll(async () => (await chartSnapshot(page)).count).toBe(0)
    }
    await checkbox(page, '東京都').check()
    await expect(page.locator('canvas')).toBeVisible()
    await page.getByRole('button', { name: 'グラフ領域の表示を切替' }).click()
    await expect.poll(async () => (await chartSnapshot(page)).count).toBe(0)
  })

  for (const [mode, step] of [
    ['five-year', 5],
    ['annual', 1],
  ] as const) {
    test(`${step}年刻みの全点を幅を変えても保ち、tooltipに年と人数を出す`, async ({
      page,
    }) => {
      await openChartFixture(page, 768, mode)
      await checkbox(page, '東京都').check()
      await expect(page.locator('canvas')).toBeVisible()
      const expected = Array.from({ length: 60 / step + 1 }, (_, i) => ({
        x: 1960 + i * step,
        y: 7600000 + i * 10000,
      }))
      const initial = await chartSnapshot(page)
      expect(initial.datasets?.[0]?.data).toEqual(expected)

      for (const width of [639, 390, 320, 640, 768, 1440, 390]) {
        await resizeAndWaitForChart(page, width)
        const current = await chartSnapshot(page)
        expect(current.id).toBe(initial.id)
        expect(current.datasets?.[0]?.data).toEqual(expected)
        expect(current.points).toHaveLength(expected.length)
        expect(await xTickRange(page)).toEqual([1960, 2020])
      }

      await hoverFirstPoints(page, 1)
      await expect
        .poll(async () => (await chartSnapshot(page)).tooltip?.title)
        .toEqual([`${1960 + step}年`])
      await expect
        .poll(async () => (await chartSnapshot(page)).tooltip?.body.flat())
        .toEqual(['東京都: 7,610,000人'])
    })
  }

  for (const [mode, years, ticks] of [
    ['partial', [1970, 1975, 1980, 1985, 1990], [1970, 1990]],
    ['gap', [2005, 2010, 2015], [2005, 2015]],
    ['single', [2024], [2024, 2024]],
    ['two', [1963, 2057], [1963, 2057]],
    ['irregular', [1963, 1964, 1979, 2020, 2057], [1963, 2057]],
  ] as const) {
    test(`年列が ${mode} でも、最初と最後の年を目盛りにし元の点をすべて保つ`, async ({
      page,
    }) => {
      await openChartFixture(page, 390, mode)
      await checkbox(page, '東京都').check()
      await expect(page.locator('canvas')).toBeVisible()
      const current = await chartSnapshot(page)
      expect(await xTickRange(page)).toEqual(ticks)
      expect(current.datasets?.[0]?.data.map((p) => p.x)).toEqual(years)
      expect(current.points).toHaveLength(years.length)
      await expectNoHorizontalOverflow(page)
    })
  }

  test('47県を固有の色の実線で描き、凡例の色と一致させ、解除・再選択で同じ系列に戻る', async ({
    page,
  }, testInfo) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await openChartFixture(page, 1440)
    await page.getByRole('button', { name: '全47県を選択' }).click()
    await expect(chartImage(page)).toBeVisible()
    await expect(legendItems(page)).toHaveCount(47)

    const { datasets } = await chartSnapshot(page)
    if (!datasets) throw new Error('グラフが描画されていません')
    expect(datasets).toHaveLength(47)
    expect(new Set(datasets.map((d) => d.borderColor)).size).toBe(47)
    for (const dataset of datasets) {
      expect(dataset).toMatchObject({
        borderDash: [],
        pointStyle: 'circle',
        tension: 0,
      })
    }
    const toRgb = (hex: string) =>
      `rgb(${[1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16)).join(', ')})`
    const legendColors = await page
      .locator('.chart-legend svg')
      .evaluateAll((icons) => icons.map((icon) => getComputedStyle(icon).color))
    expect(legendColors).toEqual(
      datasets.map((d) => toRgb(String(d.borderColor))),
    )
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1600 })
      await captureScreenshot(
        page.locator('.population'),
        testInfo,
        `population-chart-solid-47-${width}.png`,
      )
    }

    await checkbox(page, '東京都').uncheck()
    await expect
      .poll(async () => (await chartSnapshot(page)).datasets)
      .toEqual(datasets.filter((d) => d.label !== '東京都'))
    await checkbox(page, '東京都').check()
    await expect
      .poll(async () => (await chartSnapshot(page)).datasets)
      .toEqual(datasets)
    expect(errors).toEqual([])
  })

  test('画面幅を変えてもインスタンスを作り直さず、凡例のアイコン寸法を保ち、横に溢れない', async ({
    page,
  }, testInfo) => {
    const apiRequests: string[] = []
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/'))
        apiRequests.push(request.url())
    })
    await openChartFixture(page, 1440)
    for (const name of ['東京都', '大阪府', '北海道'])
      await checkbox(page, name).check()
    await expect(page.locator('canvas')).toBeVisible()
    const { id } = await chartSnapshot(page)

    for (const width of [1440, 768, 390, 320]) {
      await resizeAndWaitForChart(page, width)
      const current = await chartSnapshot(page)
      expect(current.count).toBe(1)
      expect(current.id).toBe(id)
      await expectNoHorizontalOverflow(page)
      await categoryRadio(page, '老年人口').check()
      await categoryRadio(page, '総人口').check()
      await expect.poll(async () => (await chartSnapshot(page)).id).toBe(id)

      await captureScreenshot(
        page,
        testInfo,
        `population-chart-${width}.png`,
        true,
      )
      const icons = page.locator('.chart-legend svg')
      await expect(icons).toHaveCount(3)
      const sized = await icons.evaluateAll((elements) =>
        elements.every((element) => {
          const { width, height } = element.getBoundingClientRect()
          return width === 24 && height === 16
        }),
      )
      expect(sized).toBe(true)
    }
    await clearSelection(page)
    await expect.poll(async () => (await chartSnapshot(page)).count).toBe(0)
    expect(apiRequests).toEqual([])
  })

  test('県や区分の変更で年の範囲の端を更新し、推計年も目盛りに含める', async ({
    page,
  }) => {
    await openChartFixture(page, 320, 'changing')
    await checkbox(page, '東京都').check()
    await expect.poll(() => xTickRange(page)).toEqual([1963, 2057])
    await checkbox(page, '北海道').check()
    await expect.poll(() => xTickRange(page)).toEqual([1951, 2073])
    await checkbox(page, '北海道').uncheck()
    await expect.poll(() => xTickRange(page)).toEqual([1963, 2057])
    await categoryRadio(page, '年少人口').check()
    await expect.poll(() => xTickRange(page)).toEqual([1964, 2020])
    expect(
      (await chartSnapshot(page)).datasets?.[0]?.data.map((p) => p.x),
    ).toEqual([1964, 1979, 2020])
    await categoryRadio(page, '総人口').check()
    await expect.poll(() => xTickRange(page)).toEqual([1963, 2057])
    expect((await chartSnapshot(page)).datasets?.[0]?.data).toHaveLength(5)
  })
})

test('実アプリ: 449/450/767/768pxの境界で年ラベルの間引きを切り替え、18点のデータを保つ', async ({
  page,
}) => {
  const years = Array.from({ length: 18 }, (_, i) => 1960 + i * 5)
  await page.setViewportSize({ width: 320, height: 1100 })
  await page.route('**/api/v1/prefectures', (route) =>
    route.fulfill({ json: prefectureResponse }),
  )
  await page.route('**/api/v1/population/composition/perYear?*', (route) => {
    const response = appPopulationResponse(1)
    for (const category of response.result.data) {
      category.data = years.map((year, i) => ({
        year,
        value: 5000000 + i * 1000,
      }))
    }
    return route.fulfill({ json: response })
  })
  await page.goto('/')
  await page
    .getByRole('button', { name: '都道府県を選択 · 0 選択中', exact: true })
    .click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('checkbox', { name: '北海道', exact: true }).check()
  await dialog
    .getByRole('button', { name: '1 都道府県をグラフに反映', exact: true })
    .click()
  await expect(page.locator('canvas')).toBeVisible()

  for (const width of [320, 449, 450, 600, 767, 768, 1024, 1440]) {
    await resizeAndWaitForChart(page, width)
    const current = await chartSnapshot(page)
    expect(current.datasets?.[0]?.data).toHaveLength(18)
    expect(await xTickRange(page)).toEqual([1960, 2045])
    if (width < 450) expect(current.xTicks).toEqual([1960, 2045])
    else if (width >= 768) expect(current.xTicks).toEqual(years)
    else {
      // 1つおき+最終年。最終年と直前が重なる幅では直前（2040）だけを省く。
      const alternating = [...years.filter((_, i) => i % 2 === 0), 2045]
      expect([
        alternating,
        alternating.filter((year) => year !== 2040),
      ]).toContainEqual(current.xTicks)
    }
    expectTickLabelsFit(current)
  }
})
