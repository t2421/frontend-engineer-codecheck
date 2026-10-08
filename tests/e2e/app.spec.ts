import { expect, test } from '@playwright/test'
import { expectNoHorizontalOverflow } from './layout'
import { floatingSelectionButton } from './app'

test.describe('アプリの骨格', () => {
  for (const width of [1440, 768, 390, 320]) {
    test(`${width}px: 見出しと2つの領域を重ならず横に溢れずに表示する`, async ({
      page,
    }) => {
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
      await expect(population).toBeVisible()

      if (width < 640) {
        await expect(prefectures).toBeHidden()
        await expect(floatingSelectionButton(page)).toBeVisible()
      } else {
        await expect(prefectures).toBeVisible()
        const first = await prefectures.boundingBox()
        const second = await population.boundingBox()
        if (!first || !second) throw new Error('領域が表示されていません')
        expect(second.y).toBeGreaterThan(first.y + first.height)
        expect(first.x).toBeGreaterThanOrEqual(0)
        expect(first.x + first.width).toBeLessThanOrEqual(width)
      }
      await expectNoHorizontalOverflow(page)
    })
  }

  test('キーボードでスキップリンクから本文へ移動できる', async ({ page }) => {
    await page.goto('/')
    await page.keyboard.press('Tab')
    await expect(page.getByRole('link', { name: '本文へ移動' })).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('main')).toBeFocused()
  })
})
