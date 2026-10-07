import { expect, test } from '@playwright/test'
import { expectNoHorizontalOverflow } from './layout'

for (const width of [1440, 768, 390, 320]) {
  test(`${width}pxで見出しと領域を重ならずに表示する`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      '都道府県別の人口推移',
    )
    const prefectures = page.getByRole('region', {
      name: '都道府県',
      exact: true,
    })
    const population = page.getByRole('region', {
      name: '人口推移',
      exact: true,
    })
    await expect(prefectures).toBeVisible()
    await expect(population).toBeVisible()
    const first = await prefectures.boundingBox()
    const second = await population.boundingBox()
    expect(first).not.toBeNull()
    expect(second).not.toBeNull()
    expect(second!.y).toBeGreaterThan(first!.y + first!.height)
    expect(first!.x).toBeGreaterThanOrEqual(0)
    expect(first!.x + first!.width).toBeLessThanOrEqual(width)
    await expectNoHorizontalOverflow(page)
  })
}

test('キーボードでヘッダーから本文に移動できる', async ({ page }) => {
  await page.goto('/')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: '本文へ移動' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('main')).toBeFocused()
})
