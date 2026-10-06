import { expect, test } from '@playwright/test'

test('Chromeで最小画面を表示する', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    '都道府県別人口推移',
  )
})
