import { expect, test } from '@playwright/test'
import { checkAccessibility } from './accessibility'
import { captureScreenshot } from './screenshot'

test.describe('共通ハーフシート', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
  })

  test('初期openでもモーダルを開きslotの内容を操作できる', async ({ page }) => {
    await page.goto('/tests/preview/bottom-sheet.html?open')
    const dialog = page.getByRole('dialog', {
      name: '確認用シート',
      exact: true,
    })
    await expect(dialog).toBeVisible()
    await expect(
      dialog.getByRole('button', { name: '閉じる', exact: true }),
    ).toBeFocused()
    await dialog
      .getByRole('textbox', { name: '名前', exact: true })
      .fill('確認')
    await dialog.getByRole('button', { name: '反映', exact: true }).click()
    await expect(dialog).toBeHidden()
    await expect
      .poll(() => page.evaluate(() => document.body.style.position))
      .toBe('')
  })

  test('開いているシートを除去してもscroll lockとフォーカスを復元する', async ({
    page,
  }) => {
    await page.goto('/tests/preview/bottom-sheet.html')
    const trigger = page.getByRole('button', {
      name: 'シートを開く',
      exact: true,
    })
    await trigger.click()
    await page
      .getByRole('button', { name: 'シートを除去', exact: true })
      .click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(trigger).toBeFocused()
    await expect
      .poll(() => page.evaluate(() => document.body.style.position))
      .toBe('')
  })

  test('閉じるはsecondary、反映はprimaryの色と44px以上の操作領域を持つ', async ({
    page,
  }, testInfo) => {
    await page.goto('/tests/preview/bottom-sheet.html')
    await page
      .getByRole('button', { name: 'シートを開く', exact: true })
      .click()
    const close = page.getByRole('button', { name: '閉じる', exact: true })
    const apply = page.getByRole('button', { name: '反映', exact: true })
    await expect(close).toHaveCSS('color', 'rgb(21, 88, 214)')
    await expect(close).toHaveCSS('background-color', 'rgb(255, 255, 255)')
    await expect(close).toHaveCSS('border-top-width', '1px')
    await expect(apply).toHaveCSS('color', 'rgb(255, 255, 255)')
    await expect(apply).toHaveCSS('background-color', 'rgb(21, 88, 214)')
    for (const button of [close, apply]) {
      const box = await button.boundingBox()
      expect(box?.height).toBeGreaterThanOrEqual(44)
    }
    await checkAccessibility(page, testInfo)
    await captureScreenshot(page, testInfo, 'shared-bottom-sheet.png')
  })
})
