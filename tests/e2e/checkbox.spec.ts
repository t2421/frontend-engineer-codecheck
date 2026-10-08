import { expect, test } from '@playwright/test'

test.describe('Checkbox（確認ページ）', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/tests/preview/checkbox.html')
  })

  test('TabとSpaceで選択・解除でき、無効な項目はTab順序から外れる', async ({
    page,
  }) => {
    const checkbox = page.getByRole('checkbox', {
      name: '任意の項目',
      exact: true,
    })
    await page.keyboard.press('Tab')
    await expect(checkbox).toBeFocused()
    await page.keyboard.press('Space')
    await expect(checkbox).toBeChecked()
    await expect(page.getByLabel('変更回数')).toHaveText('1')
    await page.keyboard.press('Space')
    await expect(checkbox).not.toBeChecked()
    await expect(page.getByLabel('変更回数')).toHaveText('2')
    await page.keyboard.press('Tab')
    await expect(page.getByRole('button', { name: '次の操作' })).toBeFocused()
  })

  test('ラベルのクリックで切り替わり、無効な項目はクリックしても状態が変わらない', async ({
    page,
  }) => {
    const checkbox = page.getByRole('checkbox', {
      name: '任意の項目',
      exact: true,
    })
    const label = page.locator('label').filter({ hasText: /^任意の項目$/ })
    await label.click()
    await expect(checkbox).toBeChecked()
    await label.click()
    await expect(checkbox).not.toBeChecked()
    await expect(page.getByLabel('変更回数')).toHaveText('2')

    for (const [name, checked] of [
      ['無効な項目', false],
      ['選択済みの無効項目', true],
    ] as const) {
      const bounds = await page
        .locator('label')
        .filter({ hasText: name })
        .boundingBox()
      if (!bounds) throw new Error(`${name} が表示されていません`)
      await page.mouse.click(
        bounds.x + bounds.width / 2,
        bounds.y + bounds.height / 2,
      )
      const disabled = page.getByRole('checkbox', { name, exact: true })
      await expect(disabled).toBeDisabled()
      await expect(disabled).toHaveJSProperty('checked', checked)
    }
    await expect(page.getByLabel('変更回数')).toHaveText('2')
  })
})
