import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/tests/e2e/fixtures/checkbox.html')
})

test('TabとSpaceで選択・解除し、無効項目をTab順序から除外する', async ({
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
  await expect(
    page.getByRole('checkbox', { name: '無効な項目', exact: true }),
  ).not.toBeChecked()
  await expect(
    page.getByRole('checkbox', { name: '選択済みの無効項目' }),
  ).toBeChecked()
})

test('ラベルクリックと無効項目への操作が選択と通知に正しく反映される', async ({
  page,
}) => {
  const checkbox = page.getByRole('checkbox', {
    name: '任意の項目',
    exact: true,
  })
  await page
    .locator('label')
    .filter({ hasText: /^任意の項目$/ })
    .click()
  await expect(checkbox).toBeChecked()
  await expect(page.getByLabel('変更回数')).toHaveText('1')
  await page
    .locator('label')
    .filter({ hasText: /^任意の項目$/ })
    .click()
  await expect(checkbox).not.toBeChecked()
  for (const name of ['無効な項目', '選択済みの無効項目']) {
    const bounds = await page
      .locator('label')
      .filter({ hasText: name })
      .boundingBox()
    if (!bounds) throw new Error('Checkbox label is not visible')
    await page.mouse.click(
      bounds.x + bounds.width / 2,
      bounds.y + bounds.height / 2,
    )
    await expect(
      page.getByRole('checkbox', { name, exact: true }),
    ).toBeDisabled()
  }
  await expect(page.getByLabel('変更回数')).toHaveText('2')
})
