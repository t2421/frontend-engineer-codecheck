import { expect, test } from '@playwright/test'
import { captureScreenshot } from './screenshot'
import { checkAccessibility } from './accessibility'
import { prefectureResponse } from '../fixtures/appApi'
import { gate, mockPrefectures, prefecturesApi } from './apiMock'
import {
  floatingSelectionButton,
  selectionSheet,
  sheetApplyButton,
} from './app'

test.describe('スマホの都道府県選択の入口（APIモック）', () => {
  test.beforeEach(async ({ page }) => {
    await mockPrefectures(page)
  })

  // 639/640px が切り替えの境界。320px は最小幅、390px は記録用の代表幅。
  for (const width of [320, 390, 639, 640]) {
    test(`${width}px: ${width < 640 ? '下部ボタンからシートで選ぶ' : '上部の一覧で選ぶ'}`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height: 844 })
      await page.goto('/')
      const inline = page.getByRole('region', { name: '都道府県', exact: true })
      const button = floatingSelectionButton(page)
      if (width >= 640) {
        await expect(inline).toBeVisible()
        await expect(page.getByRole('checkbox')).toHaveCount(47)
        await expect(button).toBeHidden()
        return
      }
      await expect(inline).toBeHidden()
      await expect(
        page.getByRole('heading', { name: '都道府県', exact: true }),
      ).toHaveCount(0)
      await expect(page.getByRole('checkbox')).toHaveCount(0)
      await expect(button).toBeEnabled()

      // 一覧が無い分、説明文とグラフ領域の間を空けすぎない。
      const description = await page
        .getByText('都道府県と人口の区分を選んで、変化を比べられます。', {
          exact: true,
        })
        .boundingBox()
      const population = await page
        .getByRole('region', { name: '人口推移', exact: true })
        .boundingBox()
      if (!description || !population)
        throw new Error('見出しの説明とグラフ領域が必要です')
      expect(population.y - description.y - description.height).toBeLessThan(40)
      if (width === 390)
        await captureScreenshot(page, testInfo, 'mobile-initial.png')

      await button.click()
      await expect(selectionSheet(page).getByRole('checkbox')).toHaveCount(47)
      await expect(
        selectionSheet(page).getByRole('checkbox', { checked: true }),
      ).toHaveCount(0)
      await sheetApplyButton(page, 0).click()
      await expect(selectionSheet(page)).toBeHidden()
      await expect(button).toBeFocused()
      await expect(page.locator('canvas')).toHaveCount(0)
      if (width === 390) await checkAccessibility(page, testInfo)
    })
  }

  test('PCで選んだ状態からスマホ幅にすると、下部ボタンへフォーカスを移し選択を保つ', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 640, height: 844 })
    await page.route('**/api/v1/population/**', (route) =>
      route.fulfill({ status: 503, json: { error: 'SERVICE_UNAVAILABLE' } }),
    )
    await page.goto('/')
    const tokyo = page.getByRole('checkbox', { name: '東京都', exact: true })
    await tokyo.check()
    await tokyo.focus()

    await page.setViewportSize({ width: 639, height: 844 })
    const button = floatingSelectionButton(page)
    await expect(button).toHaveText('都道府県を選択 · 1 選択中')
    await expect(button).toBeFocused()
    await expect(page.getByRole('checkbox')).toHaveCount(0)
    await button.click()
    await expect(
      selectionSheet(page).getByRole('checkbox', {
        name: '東京都',
        exact: true,
      }),
    ).toBeChecked()
    await page.keyboard.press('Escape')
    await expect(button).toBeFocused()

    await page.setViewportSize({ width: 640, height: 844 })
    await expect(page.getByRole('checkbox').first()).toBeFocused()
    await expect(tokyo).toBeChecked()
    await expect(button).toBeHidden()
  })

  test('一覧を取得中のシートからPC幅にすると、シートを閉じてスクロール固定を解き、一覧へフォーカスを戻す', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const pending = gate()
    await page.route(prefecturesApi, async (route) => {
      await pending.wait()
      await route.fulfill({ json: prefectureResponse })
    })
    try {
      await page.goto('/')
      await floatingSelectionButton(page).click()
      await expect(selectionSheet(page).getByRole('status')).toContainText(
        '都道府県一覧を読み込んでいます',
      )
      await page.setViewportSize({ width: 640, height: 844 })
      await expect(page.getByRole('dialog')).toBeHidden()
      const inline = page.getByRole('region', { name: '都道府県', exact: true })
      await expect(inline).toBeVisible()
      await expect
        .poll(() =>
          inline.evaluate((el) => el.contains(document.activeElement)),
        )
        .toBe(true)
      await expect
        .poll(() => page.evaluate(() => document.body.style.position))
        .toBe('')
    } finally {
      pending.release()
    }
  })
})
