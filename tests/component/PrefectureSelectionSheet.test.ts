import { describe, expect, test } from 'vitest'
import { mount } from '@vue/test-utils'
import PrefectureSelectionSheet from '../../src/components/prefectures/PrefectureSelectionSheet.vue'
import { hokkaido, tokyo } from '../fixtures/prefectures'
import { buttonByLabel, checkboxByLabel } from './queries'

const prefectures = [tokyo, hokkaido]

// BottomSheetのdialog制御は専用テストで確かめるため、ここでは中身だけを描く。
function mountSheet(status: 'ready' | 'loading' | 'error' = 'ready') {
  return mount(PrefectureSelectionSheet, {
    props: { modelValue: true, prefectures, selectedCodes: [1], status },
    global: {
      stubs: { BottomSheet: { template: '<section><slot /></section>' } },
    },
  })
}
const applyButton = (wrapper: ReturnType<typeof mountSheet>, count: number) =>
  buttonByLabel(wrapper, `${count} 都道府県をグラフに反映`)

describe('PrefectureSelectionSheet', () => {
  test('シート内の選択は仮選択で、反映ボタンでAPI順のコードを1回だけ通知して閉じる', async () => {
    const wrapper = mountSheet()
    await checkboxByLabel(wrapper, '東京都').setValue(true)
    expect(wrapper.emitted('apply')).toBeUndefined()
    expect(wrapper.get('[role="status"]').text()).toBe('2 / 2 選択中')

    await applyButton(wrapper, 2).trigger('click')
    await applyButton(wrapper, 2).trigger('click')
    expect(wrapper.emitted('apply')).toEqual([[[13, 1]]])
    expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
  })

  test('全県を外した状態も反映できる', async () => {
    const wrapper = mountSheet()
    await checkboxByLabel(wrapper, '北海道').setValue(false)
    expect(wrapper.text()).toContain('都道府県は未選択です')
    await applyButton(wrapper, 0).trigger('click')
    expect(wrapper.emitted('apply')).toEqual([[[]]])
  })

  test('閉じて再び開くと、未反映の仮選択を捨てて確定済みの選択を表示する', async () => {
    const wrapper = mountSheet()
    await checkboxByLabel(wrapper, '東京都').setValue(true)
    await wrapper.setProps({ modelValue: false })
    await wrapper.setProps({ modelValue: true, selectedCodes: [13] })
    expect(checkboxByLabel(wrapper, '東京都').element.checked).toBe(true)
    expect(checkboxByLabel(wrapper, '北海道').element.checked).toBe(false)
    expect(wrapper.emitted('apply')).toBeUndefined()
  })

  test('一覧の取得中は反映を無効にする', async () => {
    const wrapper = mountSheet('loading')
    expect(wrapper.get('[role="status"]').text()).toContain(
      '都道府県一覧を読み込んでいます',
    )
    expect(wrapper.find('input').exists()).toBe(false)
    const apply = applyButton(wrapper, 1)
    expect(apply.element.disabled).toBe(true)
    await apply.trigger('click')
    expect(wrapper.emitted('apply')).toBeUndefined()
  })

  test('一覧の取得失敗は案内を出し、再読み込みを親へ伝え、反映は無効にする', async () => {
    const wrapper = mountSheet('error')
    expect(wrapper.get('[role="alert"]').text()).toContain(
      '都道府県一覧を取得できませんでした',
    )
    await buttonByLabel(wrapper, '再読み込み').trigger('click')
    expect(wrapper.emitted('retry')).toEqual([[]])
    expect(applyButton(wrapper, 1).element.disabled).toBe(true)
  })
})
