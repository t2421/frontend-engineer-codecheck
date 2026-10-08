import type { DOMWrapper, VueWrapper } from '@vue/test-utils'

type Wrapper = VueWrapper | DOMWrapper<Element>

// 役割・ラベル・テキストで要素を探す。見つからなければテストをその場で失敗させる。
export function buttonByLabel(wrapper: Wrapper, label: string) {
  const button = wrapper
    .findAll('button')
    .find((candidate) => candidate.text() === label)
  if (!button) throw new Error(`ボタン「${label}」がありません`)
  return button
}

export function checkboxByLabel(wrapper: Wrapper, label: string) {
  const target = wrapper
    .findAll('label')
    .find((candidate) => candidate.text() === label)
  if (!target) throw new Error(`ラベル「${label}」がありません`)
  return target.get<HTMLInputElement>('input[type="checkbox"]')
}

export function radioByValue(wrapper: Wrapper, value: string) {
  return wrapper.get<HTMLInputElement>(`input[type="radio"][value="${value}"]`)
}

export function checkedCheckboxes(wrapper: Wrapper): string[] {
  return wrapper
    .findAll('label')
    .filter((label) => label.find('input[type="checkbox"]:checked').exists())
    .map((label) => label.text())
}
