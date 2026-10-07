import { expect, test } from 'vitest'
import { mount } from '@vue/test-utils'
import PrefectureSelectionSheet from '../../src/components/prefectures/PrefectureSelectionSheet.vue'

const prefectures = [
  { prefCode: 13, prefName: '東京都' },
  { prefCode: 1, prefName: '北海道' },
]
function mountSheet(status: 'ready' | 'loading' | 'error' = 'ready') {
  return mount(PrefectureSelectionSheet, {
    props: { modelValue: true, prefectures, selectedCodes: [1], status },
    global: {
      stubs: { BottomSheet: { template: '<section><slot /></section>' } },
    },
  })
}

test('仮選択は親に通知せず、反映でAPI順の選択を一度だけ通知する', async () => {
  const wrapper = mountSheet()
  expect(wrapper.findAll('label').map((label) => label.text())).toEqual([
    '東京都',
    '北海道',
  ])
  await wrapper.get('input').setValue(true)
  expect(wrapper.emitted('apply')).toBeUndefined()
  expect(wrapper.get('[role="status"]').text()).toBe('2 / 2 選択中')
  await wrapper.get('button').trigger('click')
  await wrapper.get('button').trigger('click')
  expect(wrapper.emitted('apply')).toEqual([[[13, 1]]])
  expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
})

test('空選択を反映できる', async () => {
  const wrapper = mountSheet()
  const input = wrapper.findAll('input')[1]
  if (!input) throw new Error('北海道が必要です')
  await input.setValue(false)
  expect(wrapper.text()).toContain('都道府県は未選択です')
  await wrapper.get('button').trigger('click')
  expect(wrapper.emitted('apply')).toEqual([[[]]])
})

test('再度開くと未反映の変更を破棄し最新の確定状態を表示する', async () => {
  const wrapper = mountSheet()
  await wrapper.get('input').setValue(true)
  await wrapper.setProps({ modelValue: false })
  await wrapper.setProps({ modelValue: true, selectedCodes: [13] })
  expect(wrapper.get('input').element).toHaveProperty('checked', true)
  const hokkaido = wrapper.findAll('input')[1]
  expect(hokkaido?.element).toHaveProperty('checked', false)
  expect(wrapper.emitted('apply')).toBeUndefined()
})

test('一覧取得中は操作不可の表示で反映を防ぐ', async () => {
  const wrapper = mountSheet('loading')
  expect(wrapper.get('[role="status"]').text()).toContain(
    '都道府県一覧を読み込んでいます',
  )
  expect(wrapper.find('input').exists()).toBe(false)
  expect(wrapper.get('button').element).toHaveProperty('disabled', true)
  await wrapper.get('button').trigger('click')
  expect(wrapper.emitted('apply')).toBeUndefined()
})

test('一覧失敗を通知し再試行を親へ渡す', async () => {
  const wrapper = mountSheet('error')
  expect(wrapper.get('[role="alert"]').text()).toContain(
    '都道府県一覧を取得できませんでした',
  )
  const buttons = wrapper.findAll('button')
  const retry = buttons.find((button) => button.text() === '再読み込み')
  if (!retry) throw new Error('再読み込みが必要です')
  await retry.trigger('click')
  expect(wrapper.emitted('retry')).toEqual([[]])
  const apply = buttons.find((button) => button.text().includes('グラフに反映'))
  expect(apply?.element).toHaveProperty('disabled', true)
})
