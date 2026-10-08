import { expect, test, type Page } from '@playwright/test'
import { expectNoHorizontalOverflow } from './layout'
import { captureScreenshot } from './screenshot'
import { gate, prefecturesApi, serviceUnavailable } from './apiMock'
import { floatingSelectionButton, retryButton } from './app'

const twoPrefectures = {
  message: null,
  result: [
    { prefCode: 13, prefName: 'API東京都' },
    { prefCode: 1, prefName: 'API北海道' },
  ],
}
const selectionCount = (page: Page) =>
  page.getByRole('status', { name: '選択件数' })
const skeletons = (page: Page) => page.locator('.checkbox-skeleton')

test.describe('都道府県の選択（実画面・routeモック）', () => {
  test('API順の一覧をキーボードで選択・解除でき、画面幅を変えても再取得しない', async ({
    page,
  }) => {
    let requests = 0
    await page.route(prefecturesApi, async (route) => {
      requests++
      expect(route.request().method()).toBe('GET')
      await route.fulfill({ json: twoPrefectures })
    })
    await page.goto('/')
    const checkboxes = page.getByRole('checkbox')
    await expect(checkboxes).toHaveCount(2)
    await expect(checkboxes.nth(0)).toHaveAccessibleName('API東京都')

    await checkboxes.nth(0).focus()
    await page.keyboard.press('Space')
    await page.keyboard.press('Tab')
    await page.keyboard.press('Space')
    await expect(checkboxes.nth(0)).toBeChecked()
    await expect(checkboxes.nth(1)).toBeChecked()
    await checkboxes.nth(0).uncheck()
    await expect(checkboxes.nth(1)).toBeChecked()
    await page.getByRole('button', { name: '選択を解除' }).click()
    await expect(checkboxes.nth(1)).not.toBeChecked()

    await page.setViewportSize({ width: 390, height: 1000 })
    await expect(checkboxes).toHaveCount(0)
    await page.setViewportSize({ width: 640, height: 1000 })
    await expect(checkboxes).toHaveCount(2)
    expect(requests).toBe(1)
  })

  test('取得中はスケルトン、失敗は案内、再読み込みで再びスケルトンから一覧へ戻る', async ({
    page,
  }) => {
    let attempt = 0
    const pending = [gate(), gate()]
    await page.route(prefecturesApi, async (route) => {
      const current = attempt++
      await pending[current]?.wait()
      await route.fulfill(
        current === 0 ? serviceUnavailable : { json: twoPrefectures },
      )
    })
    await page.goto('/')
    await expect(skeletons(page)).toHaveCount(47)
    await expect(page.getByRole('checkbox')).toHaveCount(0)
    pending[0]?.release()
    await expect(page.getByRole('alert')).toContainText(
      '都道府県一覧を取得できませんでした',
    )

    await retryButton(page).focus()
    await page.keyboard.press('Enter')
    await expect(skeletons(page)).toHaveCount(47)
    await expect.poll(() => attempt).toBe(2)
    pending[1]?.release()
    await expect(page.getByRole('checkbox')).toHaveCount(2)
    await expect(page.getByRole('alert')).toHaveCount(0)
  })

  test('スマホ: 閉じたまま取得し、開いたシートで失敗と再試行を扱い、閉じている間の完了でも再取得しない', async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 1000 })
    let attempt = 0
    const pending = [gate(), gate()]
    await page.route(prefecturesApi, async (route) => {
      const current = attempt++
      await pending[current]?.wait()
      await route.fulfill(
        current === 0 ? serviceUnavailable : { json: twoPrefectures },
      )
    })
    await page.goto('/')
    const open = floatingSelectionButton(page)
    const close = page.getByRole('button', { name: '閉じる', exact: true })
    await expect(open).toHaveAttribute('aria-expanded', 'false')
    await expect.poll(() => attempt).toBe(1)
    await expect(skeletons(page).last()).not.toBeVisible()

    await open.click()
    await expect(skeletons(page).last()).toBeVisible()
    await captureScreenshot(
      page,
      testInfo,
      'mobile-prefectures-loading.png',
      true,
    )
    await close.click()
    pending[0]?.release()
    await open.click()
    await expect(page.getByRole('alert')).toContainText(
      '都道府県一覧を取得できませんでした',
    )

    await retryButton(page).click()
    await expect.poll(() => attempt).toBe(2)
    await expect(skeletons(page).last()).toBeVisible()
    await close.click()
    pending[1]?.release()
    await expect(page.locator('input[type=checkbox]')).toHaveCount(2)
    await expect(open).toHaveAttribute('aria-expanded', 'false')
    await open.click()
    await expect(page.getByRole('checkbox')).toHaveCount(2)
    await expect(
      page.getByRole('dialog').locator('.checkbox-skeleton'),
    ).toHaveCount(0)
    expect(attempt).toBe(2)
  })
})

test.describe('都道府県の選択（確認ページ・合成データ）', () => {
  // 640px が PC と スマホ（折りたたみ）の境界。
  for (const width of [1440, 640, 639, 320]) {
    test(`${width}px: 47県を選べて選択を通知し、横に溢れず、APIへ通信しない`, async ({
      page,
    }) => {
      let apiRequests = 0
      page.on('request', (request) => {
        if (new URL(request.url()).pathname.startsWith('/api/')) apiRequests++
      })
      await page.setViewportSize({ width, height: 1000 })
      await page.goto('/tests/preview/prefecture-selection.html')
      const collapsed = width < 640
      if (collapsed) {
        await expect(page.getByRole('checkbox')).toHaveCount(0)
        const open = page.getByRole('button', {
          name: '都道府県を選ぶ',
          exact: true,
        })
        await expect(open).toHaveAttribute('aria-expanded', 'false')
        await open.focus()
        await page.keyboard.press('Enter')
        await expect(
          page.getByRole('button', { name: '閉じる', exact: true }),
        ).toHaveAttribute('aria-expanded', 'true')
      }
      await expect(page.getByRole('checkbox')).toHaveCount(47)
      await page.getByRole('checkbox', { name: '北海道', exact: true }).check()
      await page.getByRole('checkbox', { name: '東京都', exact: true }).check()
      await expect(selectionCount(page)).toHaveText('2 / 47 選択中')
      await expect(page.getByLabel('選択県')).toContainText('"prefCode":13')
      if (collapsed) {
        await page.getByRole('button', { name: '閉じる', exact: true }).focus()
        await page.keyboard.press('Space')
        await expect(page.getByRole('checkbox')).toHaveCount(0)
        await page
          .getByRole('button', { name: '都道府県を選ぶ', exact: true })
          .click()
        await expect(
          page.getByRole('checkbox', { name: '東京都', exact: true }),
        ).toBeChecked()
      }
      await expectNoHorizontalOverflow(page)
      expect(apiRequests).toBe(0)
    })
  }

  test('画面幅の切替で隠れるフォーカスを可視の操作へ移し、選択は保つ', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 768, height: 1000 })
    await page.goto('/tests/preview/prefecture-selection.html')
    const tokyo = page.getByRole('checkbox', { name: '東京都', exact: true })
    const open = page.getByRole('button', {
      name: '都道府県を選ぶ',
      exact: true,
    })
    const close = page.getByRole('button', { name: '閉じる', exact: true })
    await tokyo.check()
    await tokyo.focus()

    // PC → 折りたたみ: checkboxが隠れるので「都道府県を選ぶ」へ移す。
    await page.setViewportSize({ width: 639, height: 1000 })
    await expect(page.getByRole('checkbox')).toHaveCount(0)
    await expect(open).toBeFocused()
    await expect(selectionCount(page)).toHaveText('1 / 47 選択中')

    // 開いた状態なら、幅を変えてもcheckboxのフォーカスを保つ。
    await page.keyboard.press('Enter')
    await expect(tokyo).toBeChecked()
    await tokyo.focus()
    await page.setViewportSize({ width: 768, height: 1000 })
    await expect(tokyo).toBeFocused()
    await page.setViewportSize({ width: 320, height: 1000 })
    await expect(tokyo).toBeFocused()
    await expect(close).toHaveAttribute('aria-expanded', 'true')

    // 閉じた状態から PC へ: 先頭のcheckboxへ移す。
    await close.focus()
    await page.keyboard.press('Space')
    await page.setViewportSize({ width: 640, height: 1000 })
    await expect(page.getByRole('checkbox')).toHaveCount(47)
    await expect(page.getByRole('checkbox').first()).toBeFocused()
    await expect(tokyo).toBeChecked()
    await page.setViewportSize({ width: 390, height: 1000 })
    await expect(open).toBeFocused()
    await expect(page.getByLabel('選択県')).toContainText('"prefCode":13')

    // 選択領域の外にあるフォーカスは動かさない。
    const outside = page.getByRole('link', { name: '本文へ移動' })
    await outside.focus()
    await page.setViewportSize({ width: 768, height: 1000 })
    await expect(outside).toBeFocused()
    await page.setViewportSize({ width: 320, height: 1000 })
    await expect(outside).toBeFocused()
  })
})
