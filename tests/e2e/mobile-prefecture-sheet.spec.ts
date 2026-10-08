import { expect, test, type Page } from '@playwright/test'
import { prefectureResponse, appPopulationResponse } from '../fixtures/appApi'
import { checkAccessibility } from './accessibility'
import { captureScreenshot } from './screenshot'
import { expectNoHorizontalOverflow } from './layout'

const floatingButton = (page: Page) =>
  page.getByRole('button', { name: /^都道府県を選択 · \d+ 選択中$/ })
const sheet = (page: Page) =>
  page.getByRole('dialog', { name: '都道府県を選択', exact: true })
const sheetCheckbox = (page: Page, name: string) =>
  sheet(page).getByRole('checkbox', { name, exact: true })
const applyButton = (page: Page, count: number) =>
  sheet(page).getByRole('button', {
    name: `${count} 都道府県をグラフに反映`,
    exact: true,
  })
const closeButton = (page: Page) =>
  sheet(page).getByRole('button', { name: '閉じる', exact: true })

async function selectAndScroll(page: Page) {
  await floatingButton(page).click()
  for (const name of ['北海道', '東京都', '大阪府'])
    await sheetCheckbox(page, name).check()
  await applyButton(page, 3).click()
  await expect(page.locator('canvas')).toHaveAttribute('aria-label', /大阪府/)
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
  await expect(floatingButton(page)).toBeVisible()
}

test.describe('スマホの都道府県選択シート（APIモック）', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.route('**/api/v1/prefectures', (route) =>
      route.fulfill({ json: prefectureResponse }),
    )
    await page.route('**/api/v1/population/composition/perYear?*', (route) =>
      route.fulfill({
        json: appPopulationResponse(
          Number(new URL(route.request().url()).searchParams.get('prefCode')),
        ),
      }),
    )
    await page.goto('/')
  })

  test('グラフ位置で仮選択し、反映時だけ確定して同じ位置で比較できる', async ({
    page,
  }, testInfo) => {
    await expect(floatingButton(page)).toBeVisible()
    await selectAndScroll(page)
    const scrollY = await page.evaluate(() => window.scrollY)
    await captureScreenshot(page, testInfo, 'mobile-graph.png')
    await floatingButton(page).click()
    await expect(sheet(page).getByRole('checkbox')).toHaveCount(47)
    await sheetCheckbox(page, '北海道').uncheck()
    await expect(sheet(page).getByRole('status')).toHaveText('2 / 47 選択中')
    await expect(page.locator('canvas')).toHaveAttribute('aria-label', /北海道/)
    await captureScreenshot(page, testInfo, 'mobile-sheet-draft.png')
    await checkAccessibility(page, testInfo)
    await applyButton(page, 2).click()
    await expect(sheet(page)).toBeHidden()
    await expect(page.locator('canvas')).not.toHaveAttribute(
      'aria-label',
      /北海道/,
    )
    await expect(floatingButton(page)).toHaveText('都道府県を選択 · 2 選択中')
    await expect(floatingButton(page)).toBeFocused()
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(scrollY)
    await captureScreenshot(page, testInfo, 'mobile-graph-applied.png')
    await checkAccessibility(page, testInfo)
    await floatingButton(page).click()
    await expect(sheetCheckbox(page, '北海道')).not.toBeChecked()
    await closeButton(page).click()
    await page.mouse.wheel(0, -3000)
    await expect(floatingButton(page)).toBeVisible()
    await page.setViewportSize({ width: 640, height: 844 })
    await expect(floatingButton(page)).toBeHidden()
    await expect(
      page.getByRole('checkbox', { name: '北海道', exact: true }),
    ).not.toBeChecked()
    await expect(
      page.getByRole('checkbox', { name: '東京都', exact: true }),
    ).toBeChecked()
  })

  test('閉じる・背景タップ・Escは未反映の変更を破棄しフォーカスを戻す', async ({
    page,
  }) => {
    await selectAndScroll(page)
    for (const cancel of ['close', 'backdrop', 'escape']) {
      await floatingButton(page).click()
      await sheetCheckbox(page, '東京都').uncheck()
      if (cancel === 'close') await closeButton(page).click()
      else if (cancel === 'backdrop') await page.mouse.click(8, 8)
      else await page.keyboard.press('Escape')
      await expect(sheet(page)).toBeHidden()
      await expect(floatingButton(page)).toBeFocused()
      await expect(floatingButton(page)).toHaveText('都道府県を選択 · 3 選択中')
      await floatingButton(page).click()
      await expect(sheetCheckbox(page, '東京都')).toBeChecked()
      await page.keyboard.press('Escape')
    }
  })

  test('Tabをシート内に保持し、一覧だけスクロールして47県を選択できる', async ({
    page,
  }, testInfo) => {
    await selectAndScroll(page)
    const before = await page
      .getByRole('region', { name: '人口推移', exact: true })
      .boundingBox()
    await floatingButton(page).click()
    const close = closeButton(page)
    await expect(close).toBeFocused()
    await page.keyboard.press('Shift+Tab')
    await expect(applyButton(page, 3)).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(close).toBeFocused()
    for (const checkbox of await sheet(page).getByRole('checkbox').all())
      await checkbox.check()
    await expect(sheetCheckbox(page, '沖縄県')).toBeInViewport()
    await expect(sheet(page).getByRole('status')).toHaveText('47 / 47 選択中')
    const after = await page
      .getByRole('region', { name: '人口推移', exact: true })
      .boundingBox()
    expect(after?.y).toBe(before?.y)
    await expectNoHorizontalOverflow(page)
    await captureScreenshot(page, testInfo, 'mobile-sheet-47.png')
    await applyButton(page, 47).click()
    await expect(page.locator('canvas')).toHaveAttribute('aria-label', /沖縄県/)
    await floatingButton(page).click()
    await expect(
      sheet(page).getByRole('checkbox', { checked: true }),
    ).toHaveCount(47)
    await page.keyboard.press('Escape')
  })

  test('全県を解除して反映し、空状態から再び選択できる', async ({
    page,
  }, testInfo) => {
    await selectAndScroll(page)
    await floatingButton(page).click()
    for (const name of ['北海道', '東京都', '大阪府'])
      await sheetCheckbox(page, name).uncheck()
    await applyButton(page, 0).click()
    await expect(page.locator('canvas')).toHaveCount(0)
    await expect(
      page.getByRole('status').filter({ hasText: '都道府県を選択すると' }),
    ).toBeVisible()
    await expect(floatingButton(page)).toBeFocused()
    await floatingButton(page).click()
    await expect(
      sheet(page).getByRole('checkbox', { checked: true }),
    ).toHaveCount(0)
    await sheetCheckbox(page, '沖縄県').check()
    await applyButton(page, 1).click()
    await expect(page.locator('canvas')).toHaveAttribute('aria-label', /沖縄県/)
    await checkAccessibility(page, testInfo)
  })

  test('resizeでシートとscroll lockを解除し、未反映の変更を破棄する', async ({
    page,
  }) => {
    await selectAndScroll(page)
    await floatingButton(page).click()
    await sheetCheckbox(page, '北海道').uncheck()
    await page.setViewportSize({ width: 640, height: 844 })
    await expect(sheet(page)).toBeHidden()
    await expect(floatingButton(page)).toBeHidden()
    await expect(
      page.getByRole('checkbox', { name: '北海道', exact: true }),
    ).toBeInViewport()
    await expect(
      page.getByRole('checkbox', { name: '北海道', exact: true }),
    ).toBeFocused()
    await expect(
      page.getByRole('checkbox', { name: '北海道', exact: true }),
    ).toBeChecked()
    await expect
      .poll(() => page.evaluate(() => document.body.style.position))
      .toBe('')
    await page.setViewportSize({ width: 390, height: 844 })
    await page.mouse.wheel(0, 3000)
    await expect(floatingButton(page)).toBeVisible()
    await floatingButton(page).click()
    await expect(sheetCheckbox(page, '北海道')).toBeChecked()
  })

  test('一覧取得中は反映を無効にし、失敗から再試行して同じ一覧を共有する', async ({
    page,
  }, testInfo) => {
    let release = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    let attempts = 0
    await page.route('**/api/v1/prefectures', async (route) => {
      attempts++
      if (attempts === 1) {
        await gate
        return route.fulfill({
          status: 503,
          json: { error: 'SERVICE_UNAVAILABLE' },
        })
      }
      return route.fulfill({ json: prefectureResponse })
    })
    await page.reload()
    await expect(floatingButton(page)).toBeVisible()
    await floatingButton(page).click()
    await expect(sheet(page).getByRole('status')).toContainText(
      '都道府県一覧を読み込んでいます',
    )
    await expect(sheet(page).getByRole('checkbox')).toHaveCount(0)
    await expect(applyButton(page, 0)).toBeDisabled()
    await checkAccessibility(page, testInfo)
    release()
    await expect(sheet(page).getByRole('alert')).toContainText(
      '都道府県一覧を取得できませんでした',
    )
    await checkAccessibility(page, testInfo)
    await sheet(page)
      .getByRole('button', { name: '再読み込み', exact: true })
      .click()
    await expect(sheet(page).getByRole('checkbox')).toHaveCount(47)
    expect(attempts).toBe(2)
    await page.keyboard.press('Escape')
    await floatingButton(page).click()
    expect(attempts).toBe(2)
    await expect(sheet(page).getByRole('checkbox')).toHaveCount(47)
  })

  test('反映を連打しても取得を重複せず、失敗後も選択を保持して再試行できる', async ({
    page,
  }, testInfo) => {
    await selectAndScroll(page)
    let release = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    let attempts = 0
    await page.route(
      '**/api/v1/population/composition/perYear?prefCode=47',
      async (route) => {
        attempts++
        if (attempts === 1) {
          await gate
          return route.fulfill({
            status: 503,
            json: { error: 'SERVICE_UNAVAILABLE' },
          })
        }
        return route.fulfill({ json: appPopulationResponse(47) })
      },
    )
    await floatingButton(page).dblclick()
    await sheetCheckbox(page, '沖縄県').check()
    await applyButton(page, 4).dblclick()
    await expect(sheet(page)).toBeHidden()
    await expect(
      page.getByRole('status').filter({ hasText: '人口データを読み込み中' }),
    ).toBeVisible()
    expect(attempts).toBe(1)
    await expect(page.locator('canvas')).toHaveAttribute('aria-label', /北海道/)
    await floatingButton(page).click()
    await expect(sheetCheckbox(page, '沖縄県')).toBeChecked()
    await page.keyboard.press('Escape')
    release()
    await expect(page.getByRole('alert')).toContainText(
      'データを取得できませんでした',
    )
    await expect(floatingButton(page)).toHaveText('都道府県を選択 · 4 選択中')
    await checkAccessibility(page, testInfo)
    await page.getByRole('button', { name: '再読み込み', exact: true }).click()
    await expect(page.locator('canvas')).toHaveAttribute('aria-label', /沖縄県/)
    expect(attempts).toBe(2)
    await checkAccessibility(page, testInfo)
  })

  test('320px・横向き相当でも操作が欠けず軸と凡例を固定ボタンに重ねない', async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 320, height: 700 })
    await selectAndScroll(page)
    const dock = await floatingButton(page).boundingBox()
    const canvas = await page.locator('canvas').boundingBox()
    const legend = await page
      .getByRole('list', { name: '都道府県の凡例', exact: true })
      .boundingBox()
    if (!dock || !canvas || !legend)
      throw new Error('グラフと操作領域が必要です')
    expect(canvas.y + canvas.height).toBeLessThanOrEqual(dock.y)
    expect(legend.y + legend.height).toBeLessThanOrEqual(dock.y)
    await floatingButton(page).click()
    await expectNoHorizontalOverflow(page)
    await captureScreenshot(page, testInfo, 'mobile-sheet-320.png')
    await page.setViewportSize({ width: 600, height: 320 })
    await sheetCheckbox(page, '沖縄県').check()
    await expect(applyButton(page, 4)).toBeInViewport()
    await expectNoHorizontalOverflow(page)
    await checkAccessibility(page, testInfo)
  })

  test('文字を200%に拡大しても軸を固定ボタンで隠さず操作できる', async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 320, height: 844 })
    await page.addStyleTag({ content: ':root { font-size: 200%; }' })
    await selectAndScroll(page)
    const dock = await floatingButton(page).boundingBox()
    const canvas = await page.locator('canvas').boundingBox()
    if (!dock || !canvas) throw new Error('グラフと操作領域が必要です')
    expect(canvas.y + canvas.height).toBeLessThanOrEqual(dock.y)
    await floatingButton(page).click()
    await sheetCheckbox(page, '沖縄県').check()
    await expect(applyButton(page, 4)).toBeInViewport()
    await expectNoHorizontalOverflow(page)
    await checkAccessibility(page, testInfo)
    await captureScreenshot(page, testInfo, 'mobile-sheet-large-text.png')
  })
})
