import { expect, test, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'
import PrefectureSelector from '../../src/components/prefectures/PrefectureSelector.vue'
import PrefectureSelectionPanel from '../../src/components/prefectures/PrefectureSelectionPanel.vue'
import type { Prefecture } from '../../src/components/prefectures/prefectureApi'
// ホストが描画した選択値を読む。部品内部ではなく表示結果で確認する。
function selected(wrapper: ReturnType<typeof mount>): number[] {
  const text = wrapper.get('output').text()
  return text === '' ? [] : text.split(',').map(Number)
}
const prefectures = [
  { prefCode: 13, prefName: '東京都' },
  { prefCode: 1, prefName: '北海道' },
]
test.each([
  {
    scenario: '一覧取得中で未選択',
    status: 'loading',
    modelValue: [],
    expected: '都道府県一覧を読み込んでいます…',
  },
  {
    scenario: '一覧取得失敗で未選択',
    status: 'error',
    modelValue: [],
    expected: '都道府県一覧を取得できませんでした',
  },
  {
    scenario: '一覧取得済みで未選択',
    status: 'ready',
    modelValue: [],
    expected: '都道府県は未選択です',
  },
  {
    scenario: '取得状態の指定がなく未選択',
    status: undefined,
    modelValue: [],
    expected: '都道府県は未選択です',
  },
  {
    scenario: '一覧取得中でも選択済み',
    status: 'loading',
    modelValue: [1, 13],
    expected: '東京都、北海道',
  },
  {
    scenario: '一覧取得失敗でも選択済み',
    status: 'error',
    modelValue: [1, 13],
    expected: '東京都、北海道',
  },
] as const)('スマホで$scenarioの場合は「$expected」を案内する', (example) => {
  const wrapper = mount(PrefectureSelector, {
    props: {
      prefectures,
      status: example.status,
      modelValue: example.modelValue,
      mobile: true,
    },
  })
  expect(wrapper.text()).toContain(example.expected)
})
test('API順で動的表示し複数選択・個別解除・連続操作・全解除を親に伝える', async () => {
  const Host = defineComponent({
    components: { PrefectureSelector },
    setup: () => ({ selected: ref<number[]>([]), prefectures }),
    template:
      '<PrefectureSelector v-model="selected" :prefectures="prefectures" /><output>{{ selected.join(",") }}</output>',
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
  expect(selected(wrapper)).toEqual([13, 1])
  await wrapper.get('.desktop-clear').trigger('click')
  expect(selected(wrapper)).toEqual([])
})
test('スマホは初期closed、開閉後も選択県・件数を保持する', async () => {
  const wrapper = mount(PrefectureSelector, {
    props: { prefectures, modelValue: [1], mobile: true },
  })
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
  const retry = wrapper.get('.status-message-action button')
  await retry.trigger('click')
  await retry.trigger('click')
  expect(loader).toHaveBeenCalledTimes(2)
  expect(wrapper.findAll('.checkbox-skeleton')).toHaveLength(47)
  resolve(prefectures)
  await flushPromises()
  expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  expect(wrapper.findAll('input')).toHaveLength(2)
})

test('47県すべてを選択でき、1県解除しても残り46県を維持する', async () => {
  const all = Array.from({ length: 47 }, (_, index) => ({
    prefCode: index + 1,
    prefName: `合成県${index + 1}`,
  }))
  const Host = defineComponent({
    components: { PrefectureSelector },
    setup: () => ({ selected: ref<number[]>([]), all }),
    template:
      '<PrefectureSelector v-model="selected" :prefectures="all" /><output>{{ selected.join(",") }}</output>',
  })
  const wrapper = mount(Host)
  for (const input of wrapper.findAll('input')) await input.setValue(true)
  expect(selected(wrapper)).toHaveLength(47)
  await wrapper.findAll('input')[12]!.setValue(false)
  expect(selected(wrapper)).toHaveLength(46)
  expect(selected(wrapper)).not.toContain(13)
})

test('スマホは取得中もclosed、開閉状態を保ってskeletonからcheckboxへ移り再取得しない', async () => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  )
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
  const toggle = wrapper.get('[aria-expanded]')
  expect(toggle.attributes('aria-expanded')).toBe('false')
  expect(wrapper.get('.prefecture-selector').classes()).toContain(
    'is-collapsed',
  )
  await toggle.trigger('click')
  expect(toggle.attributes('aria-expanded')).toBe('true')
  expect(wrapper.findAll('.checkbox-skeleton')).toHaveLength(47)
  resolve(prefectures)
  await flushPromises()
  expect(toggle.attributes('aria-expanded')).toBe('true')
  await toggle.trigger('click')
  expect(toggle.attributes('aria-expanded')).toBe('false')
  await toggle.trigger('click')
  expect(wrapper.findAll('input')).toHaveLength(2)
  expect(wrapper.find('.checkbox-skeleton').exists()).toBe(false)
  expect(loader).toHaveBeenCalledTimes(1)
  wrapper.unmount()
})
