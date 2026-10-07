import { afterEach, expect, test, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'
import PrefectureSelector from '../../src/features/population/PrefectureSelector.vue'
import PrefectureSelectionPanel from '../../src/features/population/PrefectureSelectionPanel.vue'
import type { Prefecture } from '../../src/features/population/prefectureApi'
const prefectures = [
  { prefCode: 13, prefName: '東京都' },
  { prefCode: 1, prefName: '北海道' },
]
afterEach(() => vi.unstubAllGlobals())
test('API順で動的表示し複数選択・個別解除・連続操作・全解除を親に伝える', async () => {
  const Host = defineComponent({
    components: { PrefectureSelector },
    setup: () => ({ selected: ref<number[]>([]), prefectures }),
    template:
      '<PrefectureSelector v-model="selected" :prefectures="prefectures" />',
  })
  const wrapper = mount(Host)
  expect(wrapper.findAll('label').map((x) => x.text())).toEqual([
    '東京都',
    '北海道',
  ])
  const inputs = wrapper.findAll('input')
  await inputs[0]!.setValue(true)
  await inputs[1]!.setValue(true)
  await inputs[0]!.setValue(false)
  await inputs[0]!.setValue(true)
  expect(wrapper.vm.selected).toEqual([13, 1])
  await wrapper.get('.desktop-clear').trigger('click')
  expect(wrapper.vm.selected).toEqual([])
  wrapper.unmount()
})
test('スマホは初期closed、開閉後も選択県・件数を保持する', async () => {
  const media = {
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => media),
  )
  const wrapper = mount(PrefectureSelector, {
    props: { prefectures, modelValue: [1] },
  })
  try {
    const toggle = wrapper.get('[aria-expanded]')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    expect(wrapper.get('.selection-summary').text()).toBe('北海道')
    expect(wrapper.get('[role="status"]').text()).toBe('1 / 2 選択中')
    await toggle.trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('true')
    expect(
      (wrapper.findAll('input')[1]!.element as HTMLInputElement).checked,
    ).toBe(true)
    await toggle.trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(wrapper.get('[role="status"]').text()).toBe('1 / 2 選択中')
  } finally {
    wrapper.unmount()
  }
})
test('読み込みskeletonから一覧へ戻り選択県code/nameを通知する', async () => {
  let resolve!: (value: Prefecture[]) => void
  const loader = vi.fn(
    () =>
      new Promise<Prefecture[]>((r) => {
        resolve = r
      }),
  )
  const wrapper = mount(PrefectureSelectionPanel, {
    props: { modelValue: [], loader },
  })
  expect(wrapper.findAll('.checkbox-skeleton')).toHaveLength(47)
  expect(wrapper.find('input').exists()).toBe(false)
  resolve(prefectures)
  await flushPromises()
  expect(wrapper.findAll('input')).toHaveLength(2)
  await wrapper.findAll('input')[1]!.setValue(true)
  expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([[prefectures[1]]])
  expect(loader).toHaveBeenCalledTimes(1)
  wrapper.unmount()
})
test('失敗→再試行→loading→成功。連打でも重複取得しない', async () => {
  let resolve!: (value: Prefecture[]) => void
  const loader = vi
    .fn()
    .mockRejectedValueOnce(new Error('internal details'))
    .mockImplementationOnce(
      () =>
        new Promise<Prefecture[]>((r) => {
          resolve = r
        }),
    )
  const wrapper = mount(PrefectureSelectionPanel, {
    props: { modelValue: [], loader },
  })
  await flushPromises()
  expect(wrapper.get('[role="alert"]').text()).toContain(
    '都道府県一覧を取得できませんでした',
  )
  expect(wrapper.text()).not.toContain('internal details')
  const retry = wrapper.get('button')
  await retry.trigger('click')
  await retry.trigger('click')
  expect(loader).toHaveBeenCalledTimes(2)
  expect(wrapper.findAll('.checkbox-skeleton')).toHaveLength(47)
  resolve(prefectures)
  await flushPromises()
  expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  expect(wrapper.findAll('input')).toHaveLength(2)
  wrapper.unmount()
})

test('47県すべてを選択でき、1県解除しても残り46県を維持する', async () => {
  const all = Array.from({ length: 47 }, (_, index) => ({
    prefCode: index + 1,
    prefName: `合成県${index + 1}`,
  }))
  const Host = defineComponent({
    components: { PrefectureSelector },
    setup: () => ({ selected: ref<number[]>([]), all }),
    template: '<PrefectureSelector v-model="selected" :prefectures="all" />',
  })
  const wrapper = mount(Host)
  for (const input of wrapper.findAll('input')) await input.setValue(true)
  expect(wrapper.vm.selected).toHaveLength(47)
  await wrapper.findAll('input')[12]!.setValue(false)
  expect(wrapper.vm.selected).toHaveLength(46)
  expect(wrapper.vm.selected).not.toContain(13)
  wrapper.unmount()
})
