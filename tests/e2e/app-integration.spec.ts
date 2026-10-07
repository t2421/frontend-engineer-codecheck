import { expect, test, type Page } from '@playwright/test'
import { expectNoHorizontalOverflow } from './layout'
import { prefectureResponse, appPopulationResponse } from '../fixtures/appApi'
import { checkAccessibility } from './accessibility'
import { captureScreenshot } from './screenshot'

async function chartState(page: Page) {
  return page.evaluate(async () => {
    const moduleUrl = performance
      .getEntriesByType('resource')
      .map((e) => e.name)
      .find((name) => new URL(name).pathname.endsWith('/chart__js.js'))
    if (!moduleUrl) throw new Error('Chart.js module was not loaded')
    const { Chart } = (await import(moduleUrl)) as typeof import('chart.js')
    const canvas = document.querySelector('canvas')
    const chart = canvas ? Chart.getChart(canvas) : undefined
    return {
      count: Object.keys(Chart.instances).length,
      id: chart?.id,
      data: chart?.data.datasets.map((d) => ({ label: d.label, data: d.data })),
      ticks: chart?.scales.x?.ticks.map((t) => t.value),
    }
  })
}

for (const width of [1440, 768, 390, 320]) {
  test(`${width}px: 実アプリ全体の47県・4区分・cache・描画・a11y（APIモック）`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 1100 })
    const requests: number[] = []
    await page.route('**/api/v1/prefectures', (route) =>
      route.fulfill({ json: prefectureResponse }),
    )
    await page.route('**/api/v1/population/composition/perYear?*', (route) => {
      const code = Number(
        new URL(route.request().url()).searchParams.get('prefCode'),
      )
      expect(route.request().method()).toBe('GET')
      expect(new URL(route.request().url()).search).toBe(`?prefCode=${code}`)
      requests.push(code)
      return route.fulfill({ json: appPopulationResponse(code) })
    })
    await page.goto('/')
    await expect(
      page.getByRole('status').filter({ hasText: '都道府県を選択すると' }),
    ).toBeVisible()
    await expect(
      page.getByRole('radio', { name: '総人口', exact: true }),
    ).toBeChecked()
    await captureScreenshot(page, testInfo, `app-initial-${width}.png`, true)
    if (width < 640) {
      await expect(
        page.getByRole('button', { name: '都道府県を選ぶ', exact: true }),
      ).toHaveAttribute('aria-expanded', 'false')
      await page
        .getByRole('button', { name: '都道府県を選ぶ', exact: true })
        .focus()
      await page.keyboard.press('Enter')
    }
    await expect(page.getByRole('checkbox')).toHaveCount(47)
    expect(requests).toEqual([])
    await page.getByRole('checkbox', { name: '北海道', exact: true }).focus()
    await page.keyboard.press('Space')
    await page.getByRole('checkbox', { name: '東京都', exact: true }).check()
    await expect(page.locator('canvas')).toHaveAttribute(
      'aria-label',
      /北海道、東京都/,
    )
    const initial = await chartState(page)
    expect(initial.count).toBe(1)
    expect(initial.data?.map((d) => d.label)).toEqual(['北海道', '東京都'])
    expect(initial.ticks?.[0]).toBe(1960)
    expect(initial.ticks?.at(-1)).toBe(2020)
    await expect(
      page.getByRole('cell', { name: '100,000人', exact: true }),
    ).toHaveCount(1)
    for (const [label, offset] of [
      ['年少人口', 10000],
      ['生産年齢人口', 20000],
      ['老年人口', 30000],
      ['総人口', 0],
    ] as const) {
      await page.getByRole('radio', { name: label, exact: true }).check()
      await expect(page.locator('canvas')).toHaveAttribute(
        'aria-label',
        new RegExp(label),
      )
      const current = await chartState(page)
      expect(current.id).toBe(initial.id)
      expect(current.data?.[0]?.data[0]).toEqual({
        x: 1960,
        y: 100000 + offset,
      })
      await expect(
        page.getByRole('checkbox', { name: '北海道', exact: true }),
      ).toBeChecked()
    }
    expect(requests).toEqual([1, 13])
    await checkAccessibility(page, testInfo)
    await captureScreenshot(page, testInfo, `app-selected-${width}.png`, true)
    if (width < 640) {
      await page.getByRole('button', { name: '閉じる', exact: true }).click()
      await expect(page.locator('.selection-summary')).toHaveText(
        '北海道、東京都',
      )
      await expect(page.locator('canvas')).toBeVisible()
      await captureScreenshot(
        page,
        testInfo,
        `app-selected-collapsed-${width}.png`,
        true,
      )
      await page
        .getByRole('button', { name: '都道府県を選ぶ', exact: true })
        .click()
    }
    await page.getByRole('checkbox', { name: '北海道', exact: true }).uncheck()
    await expect
      .poll(async () => (await chartState(page)).data?.map((d) => d.label))
      .toEqual(['東京都'])
    await page.getByRole('checkbox', { name: '北海道', exact: true }).check()
    expect(requests).toEqual([1, 13])
    // Every API-derived checkbox can contribute a dataset, without recreating Chart.
    for (const checkbox of await page.getByRole('checkbox').all())
      await checkbox.check()
    await expect(page.locator('.chart-legend li')).toHaveCount(47)
    expect(requests).toHaveLength(47)
    await expect.poll(async () => (await chartState(page)).id).toBe(initial.id)
    await expect.poll(async () => (await chartState(page)).count).toBe(1)
    await expectNoHorizontalOverflow(page)
    await captureScreenshot(page, testInfo, `app-47-${width}.png`, true)
    await page
      .getByRole('button', { name: '選択を解除', exact: true })
      .filter({ visible: true })
      .click()
    await expect(page.locator('canvas')).toHaveCount(0)
    await expect.poll(async () => (await chartState(page)).count).toBe(0)
    await checkAccessibility(page, testInfo)
  })
}

test('実アプリ: 一覧・人口の失敗、retry、loadingと解除後遅延応答（APIモック）', async ({
  page,
}, testInfo) => {
  let listCount = 0
  let populationCount = 0
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/api/v1/prefectures', (route) =>
    ++listCount === 1
      ? route.fulfill({ status: 503, json: { error: 'SERVICE_UNAVAILABLE' } })
      : route.fulfill({ json: prefectureResponse }),
  )
  await page.route(
    '**/api/v1/population/composition/perYear?*',
    async (route) => {
      const attempt = ++populationCount
      if (attempt === 1)
        return route.fulfill({
          status: 503,
          json: { error: 'SERVICE_UNAVAILABLE' },
        })
      if (attempt === 3) await gate
      return route.fulfill({
        json: appPopulationResponse(
          Number(new URL(route.request().url()).searchParams.get('prefCode')),
        ),
      })
    },
  )
  await page.goto('/')
  await expect(page.getByRole('alert')).toContainText(
    '都道府県一覧を取得できませんでした',
  )
  await checkAccessibility(page, testInfo)
  await page.getByRole('button', { name: '再読み込み' }).click()
  await page.getByRole('checkbox', { name: '北海道', exact: true }).check()
  await expect(page.getByRole('alert')).toContainText(
    'データを取得できませんでした',
  )
  await page.getByRole('radio', { name: '老年人口', exact: true }).check()
  await captureScreenshot(page, testInfo, 'app-error.png', true)
  await checkAccessibility(page, testInfo)
  await page.getByRole('button', { name: '再読み込み' }).click()
  await expect(page.locator('canvas')).toHaveAttribute('aria-label', /老年人口/)
  await page.getByRole('checkbox', { name: '東京都', exact: true }).check()
  await expect(
    page.getByRole('status').filter({ hasText: '人口データを読み込み中' }),
  ).toBeVisible()
  await captureScreenshot(page, testInfo, 'app-loading.png', true)
  await checkAccessibility(page, testInfo)
  await page.getByRole('checkbox', { name: '東京都', exact: true }).uncheck()
  await page.getByRole('checkbox', { name: '東京都', exact: true }).check()
  expect(populationCount).toBe(3)
  await page.getByRole('checkbox', { name: '東京都', exact: true }).uncheck()
  const response = page.waitForResponse((r) => r.url().includes('prefCode=13'))
  release()
  await response
  await expect(page.locator('.chart-legend li')).toHaveText(['北海道'])
  await page.getByRole('checkbox', { name: '東京都', exact: true }).check()
  await expect(page.locator('.chart-legend li')).toHaveCount(2)
  expect(populationCount).toBe(3)
  expect(listCount).toBe(2)
})

test('一覧取得中は47個の操作不可skeletonと案内を表示する（APIモック）', async ({
  page,
}, testInfo) => {
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/api/v1/prefectures', async (route) => {
    await gate
    await route.fulfill({ json: prefectureResponse })
  })
  await page.goto('/')
  await expect(page.locator('.checkbox-skeleton')).toHaveCount(47)
  await expect(page.getByRole('checkbox')).toHaveCount(0)
  await expect(
    page
      .getByRole('status')
      .filter({ hasText: '都道府県一覧を読み込んでいます' }),
  ).toBeVisible()
  await captureScreenshot(page, testInfo, 'app-list-loading.png', true)
  await checkAccessibility(page, testInfo)
  release()
  await expect(page.getByRole('checkbox')).toHaveCount(47)
})

test('全体確認用fixtureはPopulationPageを使用しAPI通信せず人口値を描画する', async ({
  page,
}) => {
  const requests: string[] = []
  await page.route('**/api/**', (route) => {
    requests.push(route.request().url())
    return route.abort()
  })
  await page.goto('/tests/preview/app-integration.html')
  await page.getByRole('checkbox', { name: '東京都', exact: true }).check()
  await expect(page.locator('canvas')).toBeVisible()
  await expect(
    page.getByRole('cell', { name: '1,300,000人', exact: true }),
  ).toHaveCount(1)
  expect(requests).toEqual([])
})

for (const width of [1440, 320]) {
  test(`${width}px: 既存グラフとcompact案内を維持し、失敗県の再選択で再取得する`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 1100 })
    const calls: number[] = []
    let tokyoAttempt = 0
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    await page.route('**/api/v1/prefectures', (route) =>
      route.fulfill({ json: prefectureResponse }),
    )
    await page.route(
      '**/api/v1/population/composition/perYear?*',
      async (route) => {
        const code = Number(
          new URL(route.request().url()).searchParams.get('prefCode'),
        )
        calls.push(code)
        if (code === 13 && ++tokyoAttempt === 1)
          return route.fulfill({
            status: 503,
            json: { error: 'SERVICE_UNAVAILABLE' },
          })
        if (code === 27) await gate
        return route.fulfill({ json: appPopulationResponse(code) })
      },
    )
    try {
      await page.goto('/')
      if (width < 640)
        await page
          .getByRole('button', { name: '都道府県を選ぶ', exact: true })
          .click()
      await page.getByRole('checkbox', { name: '北海道', exact: true }).check()
      await expect(page.locator('canvas')).toBeVisible()
      const initial = await chartState(page)
      await expect(page.locator('details, summary')).toHaveCount(0)
      const dataBox = await page.locator('.chart-data').boundingBox()
      expect(dataBox!.width).toBe(1)
      expect(dataBox!.height).toBe(1)
      await page.getByRole('checkbox', { name: '東京都', exact: true }).check()
      await expect(page.getByRole('alert')).toContainText(
        'データを取得できませんでした',
      )
      await page.getByRole('checkbox', { name: '大阪府', exact: true }).check()
      await expect(
        page.getByRole('button', { name: '再読み込み' }),
      ).toBeVisible()
      await expect(page.getByRole('alert')).toContainText(
        'データを取得できませんでした',
      )
      expect(
        (await page.locator('.status-message-compact').boundingBox())!.height,
      ).toBeLessThan(300)
      await expect
        .poll(async () => (await chartState(page)).id)
        .toBe(initial.id)
      await checkAccessibility(page, testInfo)
      await page
        .getByRole('checkbox', { name: '東京都', exact: true })
        .uncheck()
      await expect(
        page.getByRole('status').filter({ hasText: '人口データを読み込み中' }),
      ).toBeVisible()
      await checkAccessibility(page, testInfo)
      await page.getByRole('checkbox', { name: '東京都', exact: true }).check()
      await expect(page.locator('.chart-legend li')).toHaveText([
        '北海道',
        '東京都',
      ])
      expect(calls).toEqual([1, 13, 27, 13])
      release()
      await expect(page.locator('.chart-legend li')).toHaveText([
        '北海道',
        '東京都',
        '大阪府',
      ])
      await expect
        .poll(async () => (await chartState(page)).id)
        .toBe(initial.id)
      await captureScreenshot(
        page,
        testInfo,
        `app-common-state-${width}.png`,
        true,
      )
      await checkAccessibility(page, testInfo)
    } finally {
      release()
    }
  })
}
