import { expect, test, type Page } from '@playwright/test'
import { expectNoHorizontalOverflow } from './layout'
import { captureScreenshot } from './screenshot'

async function snapshot(page: Page) {
  return page.evaluate(async () => {
    // Inspect the actual Chart.js registry, not a replacement drawing engine.
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
    return {
      count: Object.keys(Chart.instances).length,
      id: chart?.id,
      datasets: chart?.data.datasets,
      axes: chart
        ? { x: chart.scales.x?.type, y: chart.scales.y?.type }
        : undefined,
      yTicks: chart?.scales.y?.ticks.map((t) => t.label),
      width: chart?.width,
      xTicks: chart?.scales.x?.ticks.map((t) => t.value),
      tickLabels: chart?.scales.x?.ticks.map((t) => {
        chart.ctx.save()
        chart.ctx.font = `${chart.options.font?.size ?? Chart.defaults.font.size}px ${chart.options.font?.family ?? Chart.defaults.font.family}`
        const width = chart.ctx.measureText(String(t.label)).width
        chart.ctx.restore()
        return { x: chart.scales.x?.getPixelForValue(t.value) ?? 0, width }
      }),
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
for (const width of [1440, 768, 390, 320]) {
  test(`${width}px: データ・4区分・解除・再表示・unmountと実描画`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1100 })
    await page.goto('/tests/preview/population-chart.html')
    await expect(page.getByRole('status')).toContainText('都道府県を選択すると')
    await expect.poll(async () => (await snapshot(page)).count).toBe(0)
    await page.getByRole('checkbox', { name: '東京都', exact: true }).check()
    await page.getByRole('checkbox', { name: '北海道', exact: true }).check()
    await expect(
      page.getByRole('img', { name: /総人口の人口推移/ }),
    ).toBeVisible()
    const initial = await snapshot(page)
    expect(initial.count).toBe(1)
    expect(initial.axes).toEqual({ x: 'linear', y: 'linear' })
    expect(initial.xTicks?.[0]).toBe(1960)
    expect(initial.xTicks?.at(-1)).toBe(2020)
    await expect(page.locator('figcaption')).toHaveCount(0)
    await expect(page.locator('.chart-description')).toHaveCSS(
      'clip-path',
      'inset(50%)',
    )
    await expect(page.locator('canvas')).toHaveAccessibleDescription(
      /横軸は年、縦軸は人口数/,
    )
    expect(initial.datasets?.map((d) => d.label)).toEqual(['東京都', '北海道'])
    expect(initial.datasets?.[0]?.data).toEqual(
      [1960, 1970, 1980, 1990, 2000, 2010, 2020].map((x, i) => ({
        x,
        y: [760, 980, 1140, 1230, 1330, 1410, 1430][i]! * 10000,
      })),
    )
    expect(
      initial.points?.every(
        (p: { x: number; y: number }) =>
          Number.isFinite(p.x) && Number.isFinite(p.y),
      ),
    ).toBe(true)
    const nonEmpty = await page.locator('canvas').evaluate((canvas) => {
      const element = canvas as HTMLCanvasElement
      const ctx = element.getContext('2d')!
      return ctx
        .getImageData(0, 0, element.width, element.height)
        .data.some((value) => value !== 0)
    })
    expect(nonEmpty).toBe(true)
    expect(initial.yTicks?.map(String)).toContain('0')
    expect(initial.yTicks?.map(String)).not.toContain('14000000')
    for (const [label, factor] of [
      ['年少人口', 0.12],
      ['生産年齢人口', 0.6],
      ['老年人口', 0.28],
      ['総人口', 1],
    ] as const) {
      await page.getByRole('radio', { name: label, exact: true }).check()
      await expect(page.locator('canvas')).toHaveAttribute(
        'aria-label',
        new RegExp(label),
      )
      const current = await snapshot(page)
      expect(current.count).toBe(1)
      expect(current.xTicks?.[0]).toBe(1960)
      expect(current.xTicks?.at(-1)).toBe(2020)
      for (let i = 1; i < current.tickLabels!.length; i++) {
        const previous = current.tickLabels![i - 1]!
        const next = current.tickLabels![i]!
        expect(next.x - previous.x).toBeGreaterThanOrEqual(
          (previous.width + next.width) / 2 + 8,
        )
      }
      for (const label of current.tickLabels!) {
        expect(label.x - label.width / 2).toBeGreaterThanOrEqual(0)
        expect(label.x + label.width / 2).toBeLessThanOrEqual(current.width!)
      }
      expect(current.id).toBe(initial.id)
      expect(current.datasets?.[0]?.data[0]?.y).toBe(
        Math.round(7600000 * factor),
      )
      await expect(
        page.getByRole('checkbox', { name: '東京都', exact: true }),
      ).toBeChecked()
    }
    await page.getByRole('checkbox', { name: '東京都', exact: true }).uncheck()
    await expect
      .poll(async () => (await snapshot(page)).datasets?.map((d) => d.label))
      .toEqual(['北海道'])
    await page.getByRole('checkbox', { name: '北海道', exact: true }).uncheck()
    await expect(page.getByRole('status')).toContainText('都道府県を選択すると')
    await expect.poll(async () => (await snapshot(page)).count).toBe(0)
    for (let i = 0; i < 3; i++) {
      await page.getByRole('checkbox', { name: '東京都', exact: true }).check()
      await expect(page.locator('canvas')).toBeVisible()
      await expect.poll(async () => (await snapshot(page)).count).toBe(1)
      await page
        .getByRole('checkbox', { name: '東京都', exact: true })
        .uncheck()
      await expect(page.locator('canvas')).toHaveCount(0)
      await expect.poll(async () => (await snapshot(page)).count).toBe(0)
    }
    await page.getByRole('checkbox', { name: '東京都', exact: true }).check()
    await expect(page.locator('canvas')).toBeVisible()
    await expect(
      page.getByRole('cell', { name: '7,600,000人', exact: true }),
    ).toHaveCount(1)
    await expectNoHorizontalOverflow(page)
    await page.getByRole('button', { name: 'グラフ領域の表示を切替' }).click()
    await expect.poll(async () => (await snapshot(page)).count).toBe(0)
  })
}

test('5年/1年刻みの全点とtooltipを保持し、PCは全年度、非PCは両端を表示する', async ({
  page,
}) => {
  for (const [mode, step] of [
    ['five-year', 5],
    ['annual', 1],
  ] as const) {
    await page.setViewportSize({ width: 768, height: 1100 })
    await page.goto(`/tests/preview/population-chart.html?years=${mode}`)
    await page.getByRole('checkbox', { name: '東京都', exact: true }).check()
    await expect(page.locator('canvas')).toBeVisible()
    const initial = await snapshot(page)
    const expected = Array.from({ length: 60 / step + 1 }, (_, i) => ({
      x: 1960 + i * step,
      y: 7600000 + i * 10000,
    }))
    expect(initial.datasets?.[0]?.data).toEqual(expected)
    expect(initial.xTicks?.[0]).toBe(1960)
    expect(initial.xTicks?.at(-1)).toBe(2020)
    for (const width of [639, 390, 320, 640, 768, 1440, 390]) {
      await page.setViewportSize({ width, height: 1100 })
      await expect
        .poll(async () =>
          page
            .locator('canvas')
            .evaluate((c) => Math.round(c.getBoundingClientRect().width)),
        )
        .toBe(
          width >= 1024 ? width - 210 : width >= 640 ? width - 114 : width - 66,
        )
      await expect
        .poll(async () => (await snapshot(page)).xTicks)
        .toEqual(
          width >= 1024 ? expected.map((point) => point.x) : [1960, 2020],
        )
      const current = await snapshot(page)
      expect(current.id).toBe(initial.id)
      expect(current.count).toBe(1)
      expect(current.datasets?.[0]?.data).toEqual(expected)
      expect(current.points).toHaveLength(expected.length)
      expect(current.xTicks).toEqual(
        width >= 1024 ? expected.map((point) => point.x) : [1960, 2020],
      )
    }
    const canvas = page.locator('canvas')
    await canvas.scrollIntoViewIfNeeded()
    const point = (await snapshot(page)).points![1]!
    const box = (await canvas.boundingBox())!
    await page.mouse.move(box.x + point.x, box.y + point.y)
    await expect
      .poll(async () => (await snapshot(page)).tooltip?.title)
      .toEqual([`${1960 + step}年`])
    await expect
      .poll(async () => (await snapshot(page)).tooltip?.body.flat())
      .toEqual(['東京都: 7,610,000人'])
  }
})

test('1年・2年・不均一年・推計年でも最初と最新の年、元の点を保持する', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 1100 })
  for (const [mode, years, ticks] of [
    ['partial', [1970, 1975, 1980, 1985, 1990], [1970, 1990]],
    ['gap', [2005, 2010, 2015], [2005, 2015]],
    ['single', [2024], [2024, 2024]],
    ['two', [1963, 2057], [1963, 2057]],
    ['irregular', [1963, 1964, 1979, 2020, 2057], [1963, 2057]],
  ] as const) {
    await page.goto(`/tests/preview/population-chart.html?years=${mode}`)
    await page.getByRole('checkbox', { name: '東京都', exact: true }).check()
    await expect(page.locator('canvas')).toBeVisible()
    const current = await snapshot(page)
    expect(current.xTicks?.[0]).toBe(ticks[0])
    expect(current.xTicks?.at(-1)).toBe(ticks[1])
    expect(current.datasets?.[0]?.data.map((p) => p.x)).toEqual(years)
    expect(current.points).toHaveLength(years.length)
    await expectNoHorizontalOverflow(page)
  }
})

test('47県の凡例・表とリサイズで重なり/横溢れ/instance重複がなく、人数tooltipを描画する', async ({
  page,
}, testInfo) => {
  const errors: string[] = []
  const apiRequests: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/'))
      apiRequests.push(request.url())
  })
  await page.goto('/tests/preview/population-chart.html')
  await page.getByRole('button', { name: '全47県を選択' }).click()
  await expect(
    page.getByRole('img', { name: /総人口の人口推移/ }),
  ).toBeVisible()
  await expect(page.getByLabel('都道府県の凡例').locator('li')).toHaveCount(47)
  const initial = await snapshot(page)
  expect(initial.datasets).toHaveLength(47)
  const datasets = initial.datasets!
  expect(new Set(datasets.map((d) => d.borderColor)).size).toBe(47)
  for (const dataset of datasets) {
    expect(dataset.borderDash).toEqual([])
    expect(dataset.pointStyle).toBe('circle')
    expect(dataset.tension).toBe(0)
  }
  const legendColors = await page
    .locator('.chart-legend svg')
    .evaluateAll((icons) => icons.map((icon) => getComputedStyle(icon).color))
  const rgb = (hex: string) =>
    `rgb(${[1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16)).join(', ')})`
  expect(legendColors).toEqual(
    datasets.map((d) => rgb(d.borderColor as string)),
  )
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1600 })
    await captureScreenshot(
      page.locator('.population'),
      testInfo,
      `population-chart-solid-47-${width}.png`,
    )
  }
  await page.getByRole('checkbox', { name: '東京都', exact: true }).uncheck()
  await expect
    .poll(async () => (await snapshot(page)).datasets)
    .toEqual(datasets.filter((d) => d.label !== '東京都'))
  await page.getByRole('checkbox', { name: '東京都', exact: true }).check()
  await expect
    .poll(async () => (await snapshot(page)).datasets)
    .toEqual(datasets)

  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1100 })
    await expect
      .poll(async () =>
        page.locator('canvas').evaluate((c) => c.getBoundingClientRect().width),
      )
      .toBeLessThan(width)
    const current = await snapshot(page)
    expect(current.count).toBe(1)
    expect(current.id).toBe(initial.id)
    await expectNoHorizontalOverflow(page)
    await page.getByRole('radio', { name: '老年人口', exact: true }).check()
    await page.getByRole('radio', { name: '総人口', exact: true }).check()
    await expect.poll(async () => (await snapshot(page)).id).toBe(initial.id)
  }
  await page.getByRole('button', { name: '選択を解除', exact: true }).click()
  await expect.poll(async () => (await snapshot(page)).count).toBe(0)
  for (const name of ['東京都', '大阪府', '北海道'])
    await page.getByRole('checkbox', { name, exact: true }).check()
  await expect(page.locator('canvas')).toBeVisible()
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1100 })
    // Wait on the responsive Chart.js dimensions rather than a timed sleep.
    await expect
      .poll(async () =>
        page
          .locator('canvas')
          .evaluate((c) => Math.round(c.getBoundingClientRect().width)),
      )
      .toBe(
        width >= 1024 ? width - 210 : width >= 640 ? width - 114 : width - 66,
      )
    await captureScreenshot(
      page,
      testInfo,
      `population-chart-${width}.png`,
      true,
    )
    await captureScreenshot(
      page.locator('.population'),
      testInfo,
      `population-chart-panel-${width}.png`,
    )
    const icons = page.locator('.chart-legend svg')
    await expect(icons).toHaveCount(3)
    expect(
      await icons.evaluateAll((icons) =>
        icons.every(
          (i) =>
            i.getBoundingClientRect().width === 24 &&
            i.getBoundingClientRect().height === 16,
        ),
      ),
    ).toBe(true)
  }
  const canvas = page.locator('canvas')
  await canvas.scrollIntoViewIfNeeded()
  const point = (await snapshot(page)).points![0]!
  const box = (await canvas.boundingBox())!
  await page.mouse.move(box.x + point.x, box.y + point.y)
  await expect
    .poll(async () => (await snapshot(page)).tooltip?.body.flat())
    .toEqual(['東京都: 7,600,000人'])
  await expect
    .poll(async () => (await snapshot(page)).tooltip?.title)
    .toEqual(['1960年'])
  expect(errors).toEqual([])
  expect(apiRequests).toEqual([])
})

test('県・区分変更で実際の年範囲の端を更新し、推計年も表示する', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 1100 })
  await page.goto('/tests/preview/population-chart.html?years=changing')
  const tokyo = page.getByRole('checkbox', { name: '東京都', exact: true })
  const hokkaido = page.getByRole('checkbox', { name: '北海道', exact: true })
  const endpoints = async () => {
    const current = await snapshot(page)
    return [current.xTicks?.[0], current.xTicks?.at(-1)]
  }
  await tokyo.check()
  await expect.poll(endpoints).toEqual([1963, 2057])
  await hokkaido.check()
  await expect.poll(endpoints).toEqual([1951, 2073])
  await hokkaido.uncheck()
  await expect.poll(endpoints).toEqual([1963, 2057])
  await page.getByRole('radio', { name: '年少人口', exact: true }).check()
  await expect.poll(endpoints).toEqual([1964, 2020])
  expect((await snapshot(page)).datasets?.[0]?.data.map((p) => p.x)).toEqual([
    1964, 1979, 2020,
  ])
  await page.getByRole('radio', { name: '総人口', exact: true }).check()
  await expect.poll(endpoints).toEqual([1963, 2057])
  expect((await snapshot(page)).datasets?.[0]?.data).toHaveLength(5)
})

test('非PCは端年だけ、PCは全年度を表示し、実APIと同じ18点を保持する', async ({
  page,
}) => {
  const { prefectureResponse, appPopulationResponse } =
    await import('../fixtures/appApi')
  await page.setViewportSize({ width: 320, height: 1100 })
  await page.route('**/api/v1/prefectures', (route) =>
    route.fulfill({ json: prefectureResponse }),
  )
  await page.route('**/api/v1/population/composition/perYear?*', (route) => {
    const response = appPopulationResponse(1)
    for (const category of response.result.data) {
      category.data = Array.from({ length: 18 }, (_, i) => ({
        year: 1960 + i * 5,
        value: 5000000 + i * 1000,
      }))
    }
    return route.fulfill({ json: response })
  })
  await page.goto('/')
  await page.getByRole('button', { name: '都道府県を選ぶ' }).click()
  await page.getByRole('checkbox', { name: '北海道', exact: true }).check()
  await expect(page.locator('canvas')).toBeVisible()
  for (const width of [320, 375, 390, 768, 1023, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1100 })
    await expect
      .poll(async () => (await snapshot(page)).width)
      .toBe(
        width >= 1024 ? width - 210 : width >= 640 ? width - 114 : width - 66,
      )
    const current = await snapshot(page)
    expect(current.xTicks?.[0]).toBe(1960)
    expect(current.xTicks?.at(-1)).toBe(2045)
    expect(current.datasets?.[0]?.data).toHaveLength(18)
    const { xTicks, tickLabels, width: chartWidth } = current
    if (!xTicks || !tickLabels || chartWidth === undefined)
      throw new Error('グラフの目盛りがありません')
    expect(xTicks).toEqual(
      width < 1024
        ? [1960, 2045]
        : Array.from({ length: 18 }, (_, i) => 1960 + i * 5),
    )
    for (let i = 1; i < tickLabels.length; i++) {
      const previous = tickLabels[i - 1]
      const next = tickLabels[i]
      if (!previous || !next) throw new Error('隣接するラベルがありません')
      expect(
        next.x - next.width / 2 - (previous.x + previous.width / 2),
      ).toBeGreaterThanOrEqual(0)
    }
    const last = tickLabels.at(-1)
    if (!last) throw new Error('末尾のラベルがありません')
    expect(last.x + last.width / 2).toBeLessThanOrEqual(chartWidth)
  }
})
