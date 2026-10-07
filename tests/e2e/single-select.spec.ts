import { expect, test } from '@playwright/test'

for (const width of [1440, 390]) {
  test(`${width}pxでラベル・単一選択・キーボード操作を利用できる`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/tests/e2e/fixtures/single-select.html')
    const group = page.getByRole('radiogroup', {
      name: '人口区分',
      exact: true,
    })
    const total = group.getByRole('radio', { name: '総人口', exact: true })
    const young = group.getByRole('radio', { name: '年少人口', exact: true })
    const working = group.getByRole('radio', {
      name: '生産年齢人口',
      exact: true,
    })
    const elder = group.getByRole('radio', { name: '老年人口', exact: true })

    await expect(total).toBeChecked()
    await page.keyboard.press('Tab')
    await expect(total).toBeFocused()
    await page.keyboard.press('ArrowRight')
    await expect(young).toBeChecked()
    await expect(young).toBeFocused()
    await expect(total).not.toBeChecked()
    await expect(page.getByLabel('選択値')).toHaveText('young')
    await page.keyboard.press('ArrowDown')
    await expect(working).toBeChecked()
    await page.keyboard.press('ArrowLeft')
    await expect(young).toBeChecked()
    await page.keyboard.press('ArrowUp')
    await expect(total).toBeChecked()
    await page.keyboard.press('ArrowLeft')
    await expect(elder).toBeChecked()
    await page.keyboard.press('ArrowRight')
    await expect(total).toBeChecked()

    await elder.focus()
    await page.keyboard.press('Space')
    await expect(elder).toBeChecked()
    await expect(page.getByLabel('選択値')).toHaveText('elder')
    await expect(group).toMatchAriaSnapshot(`
      - radiogroup "人口区分":
        - radio "総人口"
        - radio "年少人口"
        - radio "生産年齢人口"
        - radio "老年人口" [checked]
    `)
    await page.screenshot({
      path: `test-results/single-select-focus-${width}.png`,
    })
    await page.keyboard.press('Tab')
    await expect(
      page
        .getByRole('radiogroup', { name: '別のグループ' })
        .getByRole('radio', { name: '一', exact: true }),
    ).toBeFocused()
    await expect(elder).toBeChecked()
    await page.getByRole('button', { name: '先頭に戻す' }).click()
    await expect(total).toBeChecked()
    await expect(elder).not.toBeChecked()
    await working.click()
    await expect(working).toBeChecked()
    const otherGroup = page.getByRole('radiogroup', { name: '別のグループ' })
    await otherGroup.getByRole('radio', { name: '二', exact: true }).click()
    await expect(
      otherGroup.getByRole('radio', { name: '二', exact: true }),
    ).toBeChecked()
    await expect(
      otherGroup.getByRole('radio', { name: '一', exact: true }),
    ).not.toBeChecked()
    await expect(working).toBeChecked()
    await page.screenshot({ path: `test-results/single-select-${width}.png` })

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
    for (const label of await page.locator('.option-label').all()) {
      expect(
        await label.evaluate(
          (element) =>
            element.scrollWidth <= element.clientWidth &&
            element.scrollHeight <= element.clientHeight,
        ),
      ).toBe(true)
    }
  })
}
