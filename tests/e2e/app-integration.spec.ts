import { expect, test, type Page } from '@playwright/test'
import { prefectureResponse, appPopulationResponse } from '../fixtures/appApi'
import { checkAccessibility } from './accessibility'

async function chartState(page: Page) {
  return page.evaluate(async () => {
    const moduleUrl = performance
      .getEntriesByType('resource')
      .map((e) => e.name)
      .find((name) => new URL(name).pathname.endsWith('/chart__js.js'))!
    const { Chart } = (await import(moduleUrl)) as typeof import('chart.js')
    const canvas = document.querySelector('canvas')
    const chart = canvas ? Chart.getChart(canvas) : undefined
    return {
      count: Object.keys(Chart.instances).length,
      id: chart?.id,
      data: chart?.data.datasets.map((d) => ({ label: d.label, data: d.data })),
      ticks: chart?.scales.x.ticks.map((t) => t.value),
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
    await page.screenshot({
      path: `test-results/app-initial-${width}.png`,
      fullPage: true,
    })
    if (width < 640) {
      await expect(
        page.getByRole('button', { name: '都道府県を選ぶ' }),
      ).toHaveAttribute('aria-expanded', 'false')
      await page.screenshot({
        path: `test-results/app-initial-${width}.png`,
        fullPage: true,
      })
      await page.getByRole('button', { name: '都道府県を選ぶ' }).focus()
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
    if (width < 640) expect(initial.ticks).toEqual([1960, 1980, 2000, 2020])
    await page.locator('summary').click()
    await expect(
      page.getByRole('cell', { name: '100,000人', exact: true }),
    ).toBeVisible()
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
    await page.locator('summary').click()
    await page.screenshot({
      path: `test-results/app-selected-${width}.png`,
      fullPage: true,
    })
    if (width < 640) {
      await page.getByRole('button', { name: '閉じる', exact: true }).click()
      await expect(page.locator('.selection-summary')).toHaveText(
        '北海道、東京都',
      )
      await expect(page.locator('canvas')).toBeVisible()
      await page.screenshot({
        path: `test-results/app-selected-collapsed-${width}.png`,
        fullPage: true,
      })
      await page.getByRole('button', { name: '都道府県を選ぶ' }).click()
    }
    await page.getByRole('checkbox', { name: '北海道', exact: true }).uncheck()
    expect((await chartState(page)).data?.map((d) => d.label)).toEqual([
      '東京都',
    ])
    await page.getByRole('checkbox', { name: '北海道', exact: true }).check()
    expect(requests).toEqual([1, 13])
    // Every API-derived checkbox can contribute a dataset, without recreating Chart.
    for (const checkbox of await page.getByRole('checkbox').all())
      await checkbox.check()
    await expect(page.locator('.chart-legend li')).toHaveCount(47)
    expect(requests).toHaveLength(47)
    expect((await chartState(page)).id).toBe(initial.id)
    expect((await chartState(page)).count).toBe(1)
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width)
    await page.screenshot({
      path: `test-results/app-47-${width}.png`,
      fullPage: true,
    })
    await page
      .getByRole('button', { name: '選択を解除', exact: true })
      .filter({ visible: true })
      .click()
    await expect(page.locator('canvas')).toHaveCount(0)
    expect((await chartState(page)).count).toBe(0)
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
  await page.screenshot({ path: 'test-results/app-error.png', fullPage: true })
  await checkAccessibility(page, testInfo)
  await page.getByRole('button', { name: '再読み込み' }).click()
  await expect(page.locator('canvas')).toHaveAttribute('aria-label', /老年人口/)
  await page.getByRole('checkbox', { name: '東京都', exact: true }).check()
  await expect(
    page.getByRole('status').filter({ hasText: '人口データを読み込み中' }),
  ).toBeVisible()
  await page.screenshot({
    path: 'test-results/app-loading.png',
    fullPage: true,
  })
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
  await page.screenshot({
    path: 'test-results/app-list-loading.png',
    fullPage: true,
  })
  await checkAccessibility(page, testInfo)
  release()
  await expect(page.getByRole('checkbox')).toHaveCount(47)
})

test('全体確認用fixtureは同じAppを使用しAPI通信せず人口値を描画する', async ({
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
  await page.locator('summary').click()
  await expect(
    page.getByRole('cell', { name: '1,300,000人', exact: true }),
  ).toBeVisible()
  expect(requests).toEqual([])
})
