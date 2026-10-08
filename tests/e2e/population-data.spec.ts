import { expect, test, type Page } from '@playwright/test'
import { expectNoHorizontalOverflow } from './layout'
import { populationResponse } from '../fixtures/population'
import { captureScreenshot } from './screenshot'
import { gate, populationApi, serviceUnavailable } from './apiMock'
import {
  emptyStatus,
  populationErrorAlert,
  populationLoadingStatus,
  retryButton,
} from './app'

// 確認ページのslotに出る、後続表示へ渡したデータ（区分と系列のJSON）。
const output = (page: Page) => page.getByLabel('後続表示へのデータ')
const radio = (page: Page, name: string) =>
  page.getByRole('radio', { name, exact: true })
const checkbox = (page: Page, name: string) =>
  page.getByRole('checkbox', { name })

test.describe('PopulationDataPanel（確認ページ・APIモック）', () => {
  let requests: string[]
  test.beforeEach(async ({ page }) => {
    requests = []
    await page.route(populationApi, (route) => {
      requests.push(route.request().url())
      return route.fulfill({ json: populationResponse() })
    })
    await page.goto('/tests/preview/population-data.html?mode=proxy')
  })

  test('未選択では区分を切り替えても通信しない', async ({ page }) => {
    await expect(radio(page, '総人口')).toBeChecked()
    await radio(page, '総人口').focus()
    await page.keyboard.press('ArrowRight')
    await expect(radio(page, '年少人口')).toBeChecked()
    await expect(emptyStatus(page)).toBeVisible()
    expect(requests).toHaveLength(0)
  })

  test('県を選ぶと1回だけ取得し、区分の切替は取得済みデータから表示する', async ({
    page,
  }) => {
    await radio(page, '年少人口').check()
    await checkbox(page, '北海道').check()
    await expect(output(page)).toContainText('"value":101')
    for (const [label, value] of [
      ['総人口', 100],
      ['生産年齢人口', 102],
      ['老年人口', 103],
    ] as const) {
      await radio(page, label).check()
      await expect(output(page)).toContainText(`"value":${value}`)
    }
    await expect(checkbox(page, '北海道')).toBeChecked()
    expect(requests).toHaveLength(1)
    expect(new URL(requests[0] ?? '').search).toBe('?prefCode=1')
  })

  test('県の追加・解除・再選択ではキャッシュを使い、県ごとに1回しか取得しない', async ({
    page,
  }) => {
    await checkbox(page, '北海道').check()
    await expect(output(page)).toContainText('北海道')
    await checkbox(page, '東京都').check()
    await expect(output(page)).toContainText('東京都')
    await checkbox(page, '北海道').uncheck()
    await expect(output(page)).not.toContainText('北海道')
    await checkbox(page, '北海道').check()
    await expect(output(page)).toContainText('北海道')
    expect(requests).toHaveLength(2)
  })

  test('全県を解除しても区分の選択を保ち、未選択の案内へ戻る', async ({
    page,
  }) => {
    await radio(page, '老年人口').check()
    await checkbox(page, '北海道').check()
    await expect(output(page)).toContainText('北海道')
    await checkbox(page, '北海道').uncheck()
    await expect(radio(page, '老年人口')).toBeChecked()
    await expect(emptyStatus(page)).toBeVisible()
  })

  test('取得失敗の後、再読み込みで現在の区分のデータへ復帰する', async ({
    page,
  }, testInfo) => {
    let count = 0
    await page.route(populationApi, (route) =>
      ++count === 1
        ? route.fulfill(serviceUnavailable)
        : route.fulfill({ json: populationResponse() }),
    )
    await checkbox(page, '北海道').check()
    await expect(populationErrorAlert(page)).toBeVisible()
    await radio(page, '年少人口').check()
    await captureScreenshot(page, testInfo, 'population-error.png', true)
    await retryButton(page).click()
    await expect(output(page)).toContainText('"value":101')
    await expect(page.getByRole('alert')).toHaveCount(0)
    expect(count).toBe(2)
  })

  test('解除した県の応答が遅れて届いても、その県を表示に戻さない', async ({
    page,
  }, testInfo) => {
    const pending = gate()
    await page.route(populationApi, async (route) => {
      await pending.wait()
      await route.fulfill({ json: populationResponse() })
    })
    await checkbox(page, '北海道').check()
    await expect(populationLoadingStatus(page)).toBeVisible()
    await captureScreenshot(page, testInfo, 'population-loading.png', true)
    await checkbox(page, '北海道').uncheck()
    const response = page.waitForResponse((r) =>
      r.url().includes('/api/v1/population/'),
    )
    pending.release()
    await response
    await expect(output(page)).toHaveCount(0)
    await expect(emptyStatus(page)).toBeVisible()
  })

  for (const width of [1440, 390]) {
    test(`${width}px: 2県を表示しても横に溢れない`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height: 1000 })
      await checkbox(page, '北海道').check()
      await checkbox(page, '東京都').check()
      await expect(output(page)).toContainText('東京都')
      await expectNoHorizontalOverflow(page)
      await captureScreenshot(
        page,
        testInfo,
        `population-data-${width}.png`,
        true,
      )
    })
  }
})

test('合成データの確認ページは、失敗・再試行・遅延応答を実APIなしで再現できる', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  const apiRequests: string[] = []
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/'))
      apiRequests.push(request.url())
  })
  await page.goto('/tests/preview/population-data.html')
  await expect(
    page.getByText('合成データによる確認画面です。実APIは使用しません。'),
  ).toBeVisible()

  await page
    .getByRole('button', { name: '次の取得を失敗させる', exact: true })
    .click()
  await checkbox(page, '北海道').check()
  await expect(populationErrorAlert(page)).toBeVisible()
  await retryButton(page).click()
  await expect(output(page)).toContainText('"value":100')

  await page
    .getByRole('button', { name: '次の取得を遅延させる', exact: true })
    .click()
  await checkbox(page, '東京都').check()
  await expect(populationLoadingStatus(page)).toBeVisible()
  await checkbox(page, '東京都').uncheck()
  await page
    .getByRole('button', { name: '遅延応答を返す', exact: true })
    .click()
  await expect(output(page)).not.toContainText('東京都')
  await expect(page.getByLabel('合成データ取得回数')).toHaveText('3')
  expect(apiRequests).toEqual([])

  await captureScreenshot(
    page,
    testInfo,
    'population-synthetic-desktop.png',
    true,
  )
  await page.setViewportSize({ width: 390, height: 1000 })
  await expectNoHorizontalOverflow(page)
  await captureScreenshot(
    page,
    testInfo,
    'population-synthetic-mobile.png',
    true,
  )
})
