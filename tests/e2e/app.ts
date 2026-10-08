import { expect, type Page } from '@playwright/test'

export const MOBILE_MAX_WIDTH = 639

export const isMobileViewport = (page: Page) =>
  (page.viewportSize()?.width ?? 1280) <= MOBILE_MAX_WIDTH

// スマホ表示で画面下部に固定される「都道府県を選択 · N 選択中」ボタン。
export const floatingSelectionButton = (page: Page) =>
  page.getByRole('button', { name: /^都道府県を選択 · \d+ 選択中$/ })

export const selectionSheet = (page: Page) =>
  page.getByRole('dialog', { name: '都道府県を選択', exact: true })

export const sheetCheckbox = (page: Page, name: string) =>
  selectionSheet(page).getByRole('checkbox', { name, exact: true })

export const sheetApplyButton = (page: Page, count?: number) =>
  selectionSheet(page).getByRole('button', {
    name:
      count === undefined
        ? /^\d+ 都道府県をグラフに反映$/
        : `${count} 都道府県をグラフに反映`,
    exact: true,
  })

export const sheetCloseButton = (page: Page) =>
  selectionSheet(page).getByRole('button', { name: '閉じる', exact: true })

export async function applySheet(page: Page) {
  await sheetApplyButton(page).click()
  await expect(selectionSheet(page)).toBeHidden()
}

// PCは一覧のcheckbox、スマホはシートを開いて選び反映する。
export async function setPrefectureChecked(
  page: Page,
  name: string,
  checked: boolean,
) {
  const mobile = isMobileViewport(page)
  if (mobile) await floatingSelectionButton(page).click()
  await page.getByRole('checkbox', { name, exact: true }).setChecked(checked)
  if (mobile) await applySheet(page)
}

export const clearSelection = (page: Page) =>
  page.getByRole('button', { name: '選択を解除', exact: true }).click()

export const categoryRadio = (page: Page, label: string) =>
  page.getByRole('radio', { name: label, exact: true })

export const emptyStatus = (page: Page) =>
  page.getByRole('status').filter({ hasText: '都道府県を選択すると' })

export const populationLoadingStatus = (page: Page) =>
  page.getByRole('status').filter({ hasText: '人口データを読み込み中' })

export const populationErrorAlert = (page: Page) =>
  page.getByRole('alert').filter({ hasText: 'データを取得できませんでした' })

export const legendItems = (page: Page) =>
  page
    .getByRole('list', { name: '都道府県の凡例', exact: true })
    .getByRole('listitem')

export const retryButton = (page: Page) =>
  page.getByRole('button', { name: '再読み込み', exact: true })
