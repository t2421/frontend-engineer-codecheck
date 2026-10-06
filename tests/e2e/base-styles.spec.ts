import { expect, test } from '@playwright/test'

for (const width of [1440, 768, 390, 320]) {
  test(`${width}pxで共通の文字・背景と横幅を保つ`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto('/')
    await expect(page.locator('body')).toHaveCSS('color', 'rgb(23, 43, 58)')
    await expect(page.locator('body')).toHaveCSS(
      'background-color',
      'rgb(245, 247, 250)',
    )
    await expect(page.locator('body')).toHaveCSS('font-size', '14px')
    await expect(page.locator('body')).toHaveCSS('font-weight', '400')
    await expect(page.locator('body')).toHaveCSS('line-height', '22px')
    // Chrome normalizes zero letter-spacing to "normal" in computed style.
    await expect(page.locator('body')).toHaveCSS('letter-spacing', 'normal')
    await expect(page.locator('body')).toHaveCSS(
      'font-family',
      '"Noto Sans JP", sans-serif',
    )
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
    await page.screenshot({ path: testInfo.outputPath('app.png') })
  })
}

test('scoped CSSで継承し、フォーム文字とキーボード操作を保つ', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 1000 })
  await page.goto('/tests/fixtures/base-styles.html')
  const sample = page.locator('main')
  await expect(sample).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  await expect(sample).toHaveCSS('padding', '24px')
  await expect(sample).toHaveCSS('gap', '16px')
  await expect(sample).toHaveCSS('border-radius', '12px')
  await expect(sample).toHaveCSS('box-sizing', 'border-box')
  await expect(page.locator('h1')).toHaveCSS('margin-top', '0px')
  for (const selector of ['button', 'input', 'select', 'textarea']) {
    const control = page.locator(selector).first()
    await expect(control).toHaveCSS('font-size', '14px')
    // Chrome's native select keeps a platform line-height with appearance: auto.
    await expect(control).toHaveCSS(
      'line-height',
      selector === 'select' ? 'normal' : '22px',
    )
    await expect(control).toHaveCSS('font-family', '"Noto Sans JP", sans-serif')
  }
  const controls = [
    page.getByRole('button', { name: '確認', exact: true }),
    page.getByRole('textbox', { name: '入力', exact: true }),
    page.getByRole('combobox'),
    page.getByRole('textbox', { name: 'メモ' }),
    page.getByRole('checkbox'),
    page.getByRole('link'),
  ]
  for (const control of controls) {
    await page.keyboard.press('Tab')
    await expect(control).toBeFocused()
    await expect(control).toHaveCSS('outline-style', 'solid')
    await expect(control).toHaveCSS('outline-width', '2px')
    await expect(control).toHaveCSS('outline-color', 'rgb(21, 88, 214)')
    await expect(control).toHaveCSS('outline-offset', '4px')
  }
  await page.getByRole('checkbox').focus()
  await page.keyboard.press('Space')
  await expect(page.getByRole('checkbox')).toBeChecked()
  await page.screenshot({ path: testInfo.outputPath('focus.png') })
  await expect(page.getByRole('button', { name: '無効' })).toBeDisabled()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
})
