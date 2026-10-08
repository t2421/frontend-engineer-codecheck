import { expect, test, type Page } from '@playwright/test'
import { expectNoHorizontalOverflow } from './layout'
import { prefectureResponse, appPopulationResponse } from '../fixtures/appApi'
import { checkAccessibility } from './accessibility'
import { captureScreenshot } from './screenshot'
import { chartSnapshot, datasetLabels } from './chart'
import {
  gate,
  mockPopulation,
  mockPrefectures,
  populationApi,
  prefCodeOf,
  prefecturesApi,
  serviceUnavailable,
} from './apiMock'
import {
  applySheet,
  categoryRadio,
  clearSelection,
  emptyStatus,
  floatingSelectionButton,
  isMobileViewport,
  legendItems,
  populationErrorAlert,
  populationLoadingStatus,
  retryButton,
  setPrefectureChecked,
} from './app'

const canvas = (page: Page) => page.locator('canvas')

test.describe('実アプリの通し操作（APIモック）', () => {
  // 640px が PC とスマホの境界。各レイアウトを代表する幅で確かめる。
  for (const width of [1440, 390]) {
    test.describe(`${width}px`, () => {
      let requestedCodes: number[]
      test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width, height: 1100 })
        await mockPrefectures(page)
        requestedCodes = await mockPopulation(page)
        await page.goto('/')
      })

      test('県を選ぶと取得して描画し、区分の切替は同じグラフを更新して再取得しない', async ({
        page,
      }, testInfo) => {
        await expect(emptyStatus(page)).toBeVisible()
        await expect(categoryRadio(page, '総人口')).toBeChecked()
        await captureScreenshot(
          page,
          testInfo,
          `app-initial-${width}.png`,
          true,
        )

        if (isMobileViewport(page)) {
          await expect(floatingSelectionButton(page)).toHaveAttribute(
            'aria-expanded',
            'false',
          )
          await floatingSelectionButton(page).focus()
          await page.keyboard.press('Enter')
        }
        await expect(page.getByRole('checkbox')).toHaveCount(47)
        expect(requestedCodes).toEqual([])
        await page
          .getByRole('checkbox', { name: '北海道', exact: true })
          .focus()
        await page.keyboard.press('Space')
        await page
          .getByRole('checkbox', { name: '東京都', exact: true })
          .check()
        if (isMobileViewport(page)) await applySheet(page)

        await expect(canvas(page)).toHaveAttribute(
          'aria-label',
          /北海道、東京都/,
        )
        const initial = await chartSnapshot(page)
        expect(initial.count).toBe(1)
        expect(initial.datasets?.map((d) => d.label)).toEqual([
          '北海道',
          '東京都',
        ])
        expect([initial.xTicks?.[0], initial.xTicks?.at(-1)]).toEqual([
          1960, 2020,
        ])
        await expect(
          page.getByRole('cell', { name: '100,000人', exact: true }),
        ).toHaveCount(1)

        for (const [label, offset] of [
          ['年少人口', 10000],
          ['生産年齢人口', 20000],
          ['老年人口', 30000],
          ['総人口', 0],
        ] as const) {
          await categoryRadio(page, label).check()
          await expect(canvas(page)).toHaveAttribute(
            'aria-label',
            new RegExp(label),
          )
          const current = await chartSnapshot(page)
          expect(current.id).toBe(initial.id)
          expect(current.datasets?.[0]?.data[0]).toEqual({
            x: 1960,
            y: 100000 + offset,
          })
        }
        expect(requestedCodes).toEqual([1, 13])
        await checkAccessibility(page, testInfo)
        await captureScreenshot(
          page,
          testInfo,
          `app-selected-${width}.png`,
          true,
        )
      })

      test('解除・再選択はキャッシュを使い、全解除でグラフを破棄する', async ({
        page,
      }, testInfo) => {
        await setPrefectureChecked(page, '北海道', true)
        await setPrefectureChecked(page, '東京都', true)
        await expect(canvas(page)).toHaveAttribute(
          'aria-label',
          /北海道、東京都/,
        )
        const { id } = await chartSnapshot(page)

        await setPrefectureChecked(page, '北海道', false)
        await expect.poll(() => datasetLabels(page)).toEqual(['東京都'])
        await setPrefectureChecked(page, '北海道', true)
        await expect
          .poll(() => datasetLabels(page))
          .toEqual(['北海道', '東京都'])
        expect(requestedCodes).toEqual([1, 13])
        await expect.poll(async () => (await chartSnapshot(page)).id).toBe(id)

        if (isMobileViewport(page)) {
          await floatingSelectionButton(page).click()
          for (const checkbox of await page.getByRole('checkbox').all())
            await checkbox.uncheck()
          await applySheet(page)
        } else {
          await clearSelection(page)
        }
        await expect(canvas(page)).toHaveCount(0)
        await expect(emptyStatus(page)).toBeVisible()
        await expect.poll(async () => (await chartSnapshot(page)).count).toBe(0)
        await checkAccessibility(page, testInfo)
      })
    })
  }

  test('47県すべてを選んでも1つのグラフに描き、横に溢れない', async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 1100 })
    await mockPrefectures(page)
    const requestedCodes = await mockPopulation(page)
    await page.goto('/')
    await setPrefectureChecked(page, '北海道', true)
    await expect(canvas(page)).toHaveAttribute('aria-label', /北海道/)
    const { id } = await chartSnapshot(page)

    for (const checkbox of await page.getByRole('checkbox').all())
      await checkbox.check()
    await expect(legendItems(page)).toHaveCount(47)
    expect(requestedCodes).toHaveLength(47)
    await expect.poll(async () => (await chartSnapshot(page)).id).toBe(id)
    await expect.poll(async () => (await chartSnapshot(page)).count).toBe(1)
    await expectNoHorizontalOverflow(page)
    await captureScreenshot(page, testInfo, 'app-47.png', true)
  })

  test('一覧と人口の取得失敗から再試行でき、解除した県の遅い応答は表示に戻さない', async ({
    page,
  }, testInfo) => {
    let listAttempts = 0
    let populationAttempts = 0
    const pending = gate()
    await page.route(prefecturesApi, (route) =>
      ++listAttempts === 1
        ? route.fulfill(serviceUnavailable)
        : route.fulfill({ json: prefectureResponse }),
    )
    await page.route(populationApi, async (route) => {
      const attempt = ++populationAttempts
      if (attempt === 1) return route.fulfill(serviceUnavailable)
      if (attempt === 3) await pending.wait()
      return route.fulfill({ json: appPopulationResponse(prefCodeOf(route)) })
    })
    await page.goto('/')

    await expect(page.getByRole('alert')).toContainText(
      '都道府県一覧を取得できませんでした',
    )
    await checkAccessibility(page, testInfo)
    await retryButton(page).click()

    await setPrefectureChecked(page, '北海道', true)
    await expect(populationErrorAlert(page)).toBeVisible()
    await categoryRadio(page, '老年人口').check()
    await captureScreenshot(page, testInfo, 'app-error.png', true)
    await checkAccessibility(page, testInfo)
    await retryButton(page).click()
    await expect(canvas(page)).toHaveAttribute('aria-label', /老年人口/)

    await setPrefectureChecked(page, '東京都', true)
    await expect(populationLoadingStatus(page)).toBeVisible()
    await captureScreenshot(page, testInfo, 'app-loading.png', true)
    await checkAccessibility(page, testInfo)
    await setPrefectureChecked(page, '東京都', false)
    await setPrefectureChecked(page, '東京都', true)
    expect(populationAttempts).toBe(3)

    await setPrefectureChecked(page, '東京都', false)
    const response = page.waitForResponse((r) =>
      r.url().includes('prefCode=13'),
    )
    pending.release()
    await response
    await expect(legendItems(page)).toHaveText(['北海道'])
    await setPrefectureChecked(page, '東京都', true)
    await expect(legendItems(page)).toHaveCount(2)
    expect(populationAttempts).toBe(3)
    expect(listAttempts).toBe(2)
  })

  test('一覧の取得中は47個の操作できないスケルトンと案内を表示する', async ({
    page,
  }, testInfo) => {
    const pending = gate()
    await page.route(prefecturesApi, async (route) => {
      await pending.wait()
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
    pending.release()
    await expect(page.getByRole('checkbox')).toHaveCount(47)
  })

  for (const width of [1440, 320]) {
    test(`${width}px: 一部の県が失敗・取得中でも既存のグラフを保ち、案内はコンパクトに出す`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height: 1100 })
      const requestedCodes: number[] = []
      let tokyoAttempts = 0
      const pending = gate()
      await mockPrefectures(page)
      await page.route(populationApi, async (route) => {
        const code = prefCodeOf(route)
        requestedCodes.push(code)
        if (code === 13 && ++tokyoAttempts === 1)
          return route.fulfill(serviceUnavailable)
        if (code === 27) await pending.wait()
        return route.fulfill({ json: appPopulationResponse(code) })
      })
      try {
        await page.goto('/')
        await setPrefectureChecked(page, '北海道', true)
        await expect(canvas(page)).toBeVisible()
        const { id } = await chartSnapshot(page)
        const dataBox = await page.locator('.chart-data').boundingBox()
        expect(dataBox).toMatchObject({ width: 1, height: 1 })

        await setPrefectureChecked(page, '東京都', true)
        await expect(populationErrorAlert(page)).toBeVisible()
        await setPrefectureChecked(page, '大阪府', true)
        await expect(retryButton(page)).toBeVisible()
        await expect(populationErrorAlert(page)).toBeVisible()
        const compactBox = await page
          .locator('.status-message-compact')
          .boundingBox()
        expect(compactBox?.height).toBeLessThan(300)
        await expect.poll(async () => (await chartSnapshot(page)).id).toBe(id)
        await checkAccessibility(page, testInfo)

        await setPrefectureChecked(page, '東京都', false)
        await expect(populationLoadingStatus(page)).toBeVisible()
        await checkAccessibility(page, testInfo)
        await setPrefectureChecked(page, '東京都', true)
        await expect(legendItems(page)).toHaveText(['北海道', '東京都'])
        expect(requestedCodes).toEqual([1, 13, 27, 13])

        pending.release()
        await expect(legendItems(page)).toHaveText([
          '北海道',
          '東京都',
          '大阪府',
        ])
        await expect.poll(async () => (await chartSnapshot(page)).id).toBe(id)
        await captureScreenshot(
          page,
          testInfo,
          `app-common-state-${width}.png`,
          true,
        )
        await checkAccessibility(page, testInfo)
      } finally {
        pending.release()
      }
    })
  }
})

test('全体確認ページはPopulationPageを合成loaderで動かし、APIへ通信しない', async ({
  page,
}) => {
  const apiRequests: string[] = []
  await page.route('**/api/**', (route) => {
    apiRequests.push(route.request().url())
    return route.abort()
  })
  await page.goto('/tests/preview/app-integration.html')
  await setPrefectureChecked(page, '東京都', true)
  await expect(canvas(page)).toBeVisible()
  await expect(
    page.getByRole('cell', { name: '1,300,000人', exact: true }),
  ).toHaveCount(1)
  expect(apiRequests).toEqual([])
})
