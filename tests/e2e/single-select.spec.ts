import { expect, test, type Page } from '@playwright/test'
import { expectNoHorizontalOverflow } from './layout'
import { captureScreenshot } from './screenshot'

const group = (page: Page) =>
  page.getByRole('radiogroup', { name: '人口区分', exact: true })
const radio = (page: Page, name: string) =>
  group(page).getByRole('radio', { name, exact: true })

test.describe('SingleSelectGroup（確認ページ）', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/tests/preview/single-select.html')
  })

  test('矢印キーで前後に巡回して選択する', async ({ page }) => {
    await expect(radio(page, '総人口')).toBeChecked()
    await page.keyboard.press('Tab')
    await expect(radio(page, '総人口')).toBeFocused()
    await page.keyboard.press('ArrowRight')
    await expect(radio(page, '年少人口')).toBeChecked()
    await expect(radio(page, '年少人口')).toBeFocused()
    await expect(page.getByLabel('選択値')).toHaveText('young')
    await page.keyboard.press('ArrowDown')
    await expect(radio(page, '生産年齢人口')).toBeChecked()
    await page.keyboard.press('ArrowLeft')
    await expect(radio(page, '年少人口')).toBeChecked()
    await page.keyboard.press('ArrowUp')
    await expect(radio(page, '総人口')).toBeChecked()
    await page.keyboard.press('ArrowLeft')
    await expect(radio(page, '老年人口')).toBeChecked()
    await page.keyboard.press('ArrowRight')
    await expect(radio(page, '総人口')).toBeChecked()
  })

  test('Spaceで選択し、選択状態がアクセシビリティツリーに反映される', async ({
    page,
  }, testInfo) => {
    await radio(page, '老年人口').focus()
    await page.keyboard.press('Space')
    await expect(page.getByLabel('選択値')).toHaveText('elder')
    await expect(group(page)).toMatchAriaSnapshot(`
      - radiogroup "人口区分":
        - radio "総人口"
        - radio "年少人口"
        - radio "生産年齢人口"
        - radio "老年人口" [checked]
    `)
    await captureScreenshot(page, testInfo, 'single-select-focus.png')
  })

  test('別のグループへTabで移動して選んでも、元のグループの選択は変わらない', async ({
    page,
  }) => {
    await radio(page, '老年人口').focus()
    await page.keyboard.press('Space')
    await page.keyboard.press('Tab')
    const other = page.getByRole('radiogroup', { name: '別のグループ' })
    await expect(
      other.getByRole('radio', { name: '一', exact: true }),
    ).toBeFocused()
    await other.getByRole('radio', { name: '二', exact: true }).click()
    await expect(
      other.getByRole('radio', { name: '二', exact: true }),
    ).toBeChecked()
    await expect(radio(page, '老年人口')).toBeChecked()
  })

  test('親からの値の変更を反映し、その後も操作できる', async ({ page }) => {
    await radio(page, '老年人口').click()
    await page.getByRole('button', { name: '先頭に戻す' }).click()
    await expect(radio(page, '総人口')).toBeChecked()
    await expect(radio(page, '老年人口')).not.toBeChecked()
    await radio(page, '生産年齢人口').click()
    await expect(radio(page, '生産年齢人口')).toBeChecked()
  })

  for (const width of [1440, 390]) {
    test(`${width}px: 長いラベルも溢れず、ページも横に溢れない`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height: 900 })
      await radio(page, '生産年齢人口').click()
      await captureScreenshot(page, testInfo, `single-select-${width}.png`)
      await expectNoHorizontalOverflow(page)
      for (const label of await page.locator('.option-label').all()) {
        const fits = await label.evaluate(
          (element) =>
            element.scrollWidth <= element.clientWidth &&
            element.scrollHeight <= element.clientHeight,
        )
        expect(fits).toBe(true)
      }
    })
  }
})
