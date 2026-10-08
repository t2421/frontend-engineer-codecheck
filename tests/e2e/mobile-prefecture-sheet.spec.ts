import { expect, test, type Page } from '@playwright/test'
import { appPopulationResponse } from '../fixtures/appApi'
import { checkAccessibility } from './accessibility'
import { captureScreenshot } from './screenshot'
import { expectNoHorizontalOverflow } from './layout'
import {
  gate,
  mockPopulation,
  mockPrefectures,
  prefecturesApi,
  serviceUnavailable,
} from './apiMock'
import {
  emptyStatus,
  floatingSelectionButton,
  legendItems,
  populationErrorAlert,
  populationLoadingStatus,
  retryButton,
  selectionSheet,
  sheetApplyButton,
  sheetCheckbox,
  sheetCloseButton,
} from './app'
import { prefectureResponse } from '../fixtures/appApi'

const canvasLabel = (page: Page) => page.locator('canvas')
const scrollY = (page: Page) => page.evaluate(() => window.scrollY)

// 3県を反映してページ末尾までスクロールし、グラフを見ている位置から操作を始める。
async function selectThreeAndScrollToBottom(page: Page) {
  await floatingSelectionButton(page).click()
  for (const name of ['北海道', '東京都', '大阪府'])
    await sheetCheckbox(page, name).check()
  await sheetApplyButton(page, 3).click()
  await expect(canvasLabel(page)).toHaveAttribute('aria-label', /大阪府/)
  await page.mouse.wheel(0, 3000)
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.scrollY ===
          Math.max(
            0,
            document.documentElement.scrollHeight - window.innerHeight,
          ),
      ),
    )
    .toBe(true)
  await expect(floatingSelectionButton(page)).toBeVisible()
}

test.describe('スマホの都道府県選択シート（APIモック）', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await mockPrefectures(page)
    await mockPopulation(page)
    await page.goto('/')
  })

  test('シート内は仮選択で、反映したときだけグラフに確定し、スクロール位置とフォーカスを戻す', async ({
    page,
  }, testInfo) => {
    await selectThreeAndScrollToBottom(page)
    const position = await scrollY(page)
    await captureScreenshot(page, testInfo, 'mobile-graph.png')

    await floatingSelectionButton(page).click()
    await expect(selectionSheet(page).getByRole('checkbox')).toHaveCount(47)
    await sheetCheckbox(page, '北海道').uncheck()
    await expect(selectionSheet(page).getByRole('status')).toHaveText(
      '2 / 47 選択中',
    )
    await expect(canvasLabel(page)).toHaveAttribute('aria-label', /北海道/)
    await captureScreenshot(page, testInfo, 'mobile-sheet-draft.png')
    await checkAccessibility(page, testInfo)

    await sheetApplyButton(page, 2).click()
    await expect(selectionSheet(page)).toBeHidden()
    await expect(canvasLabel(page)).not.toHaveAttribute('aria-label', /北海道/)
    await expect(floatingSelectionButton(page)).toHaveText(
      '都道府県を選択 · 2 選択中',
    )
    await expect(floatingSelectionButton(page)).toBeFocused()
    await expect.poll(() => scrollY(page)).toBe(position)
    await captureScreenshot(page, testInfo, 'mobile-graph-applied.png')
    await checkAccessibility(page, testInfo)

    // 確定した選択はPC幅の一覧にも引き継がれる。
    await page.setViewportSize({ width: 640, height: 844 })
    await expect(floatingSelectionButton(page)).toBeHidden()
    await expect(
      page.getByRole('checkbox', { name: '北海道', exact: true }),
    ).not.toBeChecked()
    await expect(
      page.getByRole('checkbox', { name: '東京都', exact: true }),
    ).toBeChecked()
  })

  test('閉じる・背景タップ・Escは未反映の変更を捨て、下部ボタンへフォーカスを戻す', async ({
    page,
  }) => {
    await selectThreeAndScrollToBottom(page)
    for (const cancel of ['close', 'backdrop', 'escape'] as const) {
      await floatingSelectionButton(page).click()
      await sheetCheckbox(page, '東京都').uncheck()
      if (cancel === 'close') await sheetCloseButton(page).click()
      else if (cancel === 'backdrop') await page.mouse.click(8, 8)
      else await page.keyboard.press('Escape')
      await expect(selectionSheet(page)).toBeHidden()
      await expect(floatingSelectionButton(page)).toBeFocused()
      await expect(floatingSelectionButton(page)).toHaveText(
        '都道府県を選択 · 3 選択中',
      )
      await floatingSelectionButton(page).click()
      await expect(sheetCheckbox(page, '東京都')).toBeChecked()
      await page.keyboard.press('Escape')
    }
  })

  test('Tabをシート内に閉じ込め、一覧だけをスクロールして47県を選んで反映できる', async ({
    page,
  }, testInfo) => {
    await selectThreeAndScrollToBottom(page)
    const populationRegion = page.getByRole('region', {
      name: '人口推移',
      exact: true,
    })
    const before = await populationRegion.boundingBox()

    await floatingSelectionButton(page).click()
    await expect(sheetCloseButton(page)).toBeFocused()
    await page.keyboard.press('Shift+Tab')
    await expect(sheetApplyButton(page, 3)).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(sheetCloseButton(page)).toBeFocused()

    for (const checkbox of await selectionSheet(page)
      .getByRole('checkbox')
      .all())
      await checkbox.check()
    await expect(sheetCheckbox(page, '沖縄県')).toBeInViewport()
    await expect(selectionSheet(page).getByRole('status')).toHaveText(
      '47 / 47 選択中',
    )
    expect((await populationRegion.boundingBox())?.y).toBe(before?.y)
    await expectNoHorizontalOverflow(page)
    await captureScreenshot(page, testInfo, 'mobile-sheet-47.png')

    await sheetApplyButton(page, 47).click()
    await expect(canvasLabel(page)).toHaveAttribute('aria-label', /沖縄県/)
    await floatingSelectionButton(page).click()
    await expect(
      selectionSheet(page).getByRole('checkbox', { checked: true }),
    ).toHaveCount(47)
  })

  test('全県を外して反映すると未選択に戻り、そこから再び選べる', async ({
    page,
  }, testInfo) => {
    await selectThreeAndScrollToBottom(page)
    await floatingSelectionButton(page).click()
    for (const name of ['北海道', '東京都', '大阪府'])
      await sheetCheckbox(page, name).uncheck()
    await sheetApplyButton(page, 0).click()
    await expect(canvasLabel(page)).toHaveCount(0)
    await expect(emptyStatus(page)).toBeVisible()
    await expect(floatingSelectionButton(page)).toBeFocused()

    await floatingSelectionButton(page).click()
    await expect(
      selectionSheet(page).getByRole('checkbox', { checked: true }),
    ).toHaveCount(0)
    await sheetCheckbox(page, '沖縄県').check()
    await sheetApplyButton(page, 1).click()
    await expect(canvasLabel(page)).toHaveAttribute('aria-label', /沖縄県/)
    await checkAccessibility(page, testInfo)
  })

  test('PC幅へのresizeでシートを閉じて未反映の変更を捨て、スクロール固定を解除し、一覧へフォーカスを移す', async ({
    page,
  }) => {
    await selectThreeAndScrollToBottom(page)
    await floatingSelectionButton(page).click()
    await sheetCheckbox(page, '北海道').uncheck()

    await page.setViewportSize({ width: 640, height: 844 })
    await expect(selectionSheet(page)).toBeHidden()
    await expect(floatingSelectionButton(page)).toBeHidden()
    const hokkaido = page.getByRole('checkbox', { name: '北海道', exact: true })
    await expect(hokkaido).toBeInViewport()
    await expect(hokkaido).toBeFocused()
    await expect(hokkaido).toBeChecked()
    await expect
      .poll(() => page.evaluate(() => document.body.style.position))
      .toBe('')

    await page.setViewportSize({ width: 390, height: 844 })
    await page.mouse.wheel(0, 3000)
    await floatingSelectionButton(page).click()
    await expect(sheetCheckbox(page, '北海道')).toBeChecked()
  })

  test('一覧の取得中は反映を無効にし、失敗からの再試行後は同じ一覧を再利用する', async ({
    page,
  }, testInfo) => {
    const pending = gate()
    let attempts = 0
    await page.route(prefecturesApi, async (route) => {
      attempts++
      if (attempts > 1) return route.fulfill({ json: prefectureResponse })
      await pending.wait()
      return route.fulfill(serviceUnavailable)
    })
    await page.reload()
    await floatingSelectionButton(page).click()
    await expect(selectionSheet(page).getByRole('status')).toContainText(
      '都道府県一覧を読み込んでいます',
    )
    await expect(selectionSheet(page).getByRole('checkbox')).toHaveCount(0)
    await expect(sheetApplyButton(page, 0)).toBeDisabled()
    await checkAccessibility(page, testInfo)

    pending.release()
    await expect(selectionSheet(page).getByRole('alert')).toContainText(
      '都道府県一覧を取得できませんでした',
    )
    await checkAccessibility(page, testInfo)
    await selectionSheet(page)
      .getByRole('button', { name: '再読み込み', exact: true })
      .click()
    await expect(selectionSheet(page).getByRole('checkbox')).toHaveCount(47)
    expect(attempts).toBe(2)

    await page.keyboard.press('Escape')
    await floatingSelectionButton(page).click()
    await expect(selectionSheet(page).getByRole('checkbox')).toHaveCount(47)
    expect(attempts).toBe(2)
  })

  test('反映ボタンの連打で重複取得せず、人口の取得失敗後も選択を保って再試行できる', async ({
    page,
  }, testInfo) => {
    await selectThreeAndScrollToBottom(page)
    const pending = gate()
    let attempts = 0
    await page.route(
      '**/api/v1/population/composition/perYear?prefCode=47',
      async (route) => {
        attempts++
        if (attempts > 1)
          return route.fulfill({ json: appPopulationResponse(47) })
        await pending.wait()
        return route.fulfill(serviceUnavailable)
      },
    )
    await floatingSelectionButton(page).dblclick()
    await sheetCheckbox(page, '沖縄県').check()
    await sheetApplyButton(page, 4).dblclick()
    await expect(selectionSheet(page)).toBeHidden()
    await expect(populationLoadingStatus(page)).toBeVisible()
    expect(attempts).toBe(1)
    await expect(canvasLabel(page)).toHaveAttribute('aria-label', /北海道/)
    await floatingSelectionButton(page).click()
    await expect(sheetCheckbox(page, '沖縄県')).toBeChecked()
    await page.keyboard.press('Escape')

    pending.release()
    await expect(populationErrorAlert(page)).toBeVisible()
    await expect(floatingSelectionButton(page)).toHaveText(
      '都道府県を選択 · 4 選択中',
    )
    await checkAccessibility(page, testInfo)
    await retryButton(page).click()
    await expect(canvasLabel(page)).toHaveAttribute('aria-label', /沖縄県/)
    expect(attempts).toBe(2)
    await checkAccessibility(page, testInfo)
  })

  for (const [name, viewport, style] of [
    ['320px', { width: 320, height: 700 }, undefined],
    [
      '文字サイズ200%',
      { width: 320, height: 844 },
      ':root { font-size: 200%; }',
    ],
  ] as const) {
    test(`${name}でも軸と凡例を下部ボタンで隠さず、シートの反映ボタンに届く`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize(viewport)
      if (style) await page.addStyleTag({ content: style })
      await selectThreeAndScrollToBottom(page)
      const dock = await floatingSelectionButton(page).boundingBox()
      const canvas = await canvasLabel(page).boundingBox()
      const legend = await legendItems(page).first().boundingBox()
      if (!dock || !canvas || !legend)
        throw new Error('グラフと操作領域が必要です')
      expect(canvas.y + canvas.height).toBeLessThanOrEqual(dock.y)
      expect(legend.y + legend.height).toBeLessThanOrEqual(dock.y)

      await floatingSelectionButton(page).click()
      await expectNoHorizontalOverflow(page)
      await captureScreenshot(
        page,
        testInfo,
        `mobile-sheet-${style ? 'large-text' : '320'}.png`,
      )
      if (!style) await page.setViewportSize({ width: 600, height: 320 })
      await sheetCheckbox(page, '沖縄県').check()
      await expect(sheetApplyButton(page, 4)).toBeInViewport()
      await expectNoHorizontalOverflow(page)
      await checkAccessibility(page, testInfo)
    })
  }
})
