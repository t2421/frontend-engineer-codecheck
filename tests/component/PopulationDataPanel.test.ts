import { afterEach, expect, test, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import StatusMessage from '../../src/shared/ui/StatusMessage.vue'
import Button from '../../src/shared/ui/Button.vue'
import PopulationDataPanel from '../../src/features/population/PopulationDataPanel.vue'
import { parsePopulation } from '../../src/features/population/populationApi'
import { populationResponse } from '../fixtures/population'
const prefectures = [
  { prefCode: 1, prefName: '北海道' },
  { prefCode: 13, prefName: '東京都' },
]
const wrappers: ReturnType<typeof mount>[] = []
afterEach(() => wrappers.splice(0).forEach((w) => w.unmount()))
function render(
  loader = vi.fn().mockResolvedValue(parsePopulation(populationResponse())),
  selectedPrefectures = prefectures.slice(0, 1),
) {
  const wrapper = mount(PopulationDataPanel, {
    props: { selectedPrefectures, loader },
    slots: {
      default:
        '<template #default="{ series, category }"><output>{{ category }}:{{ JSON.stringify(series) }}</output></template>',
    },
  })
  wrappers.push(wrapper)
  return { wrapper, loader }
}
test('初期は総人口・未選択時は区分変更/再試行で通信しない', async () => {
  const { wrapper, loader } = render(undefined, [])
  expect(wrapper.get('input[value="total"]').element).toHaveProperty(
    'checked',
    true,
  )
  expect(wrapper.text()).toContain(
    '都道府県を選択すると、人口の推移を確認できます',
  )
  await wrapper.get('input[value="young"]').setValue()
  await flushPromises()
  expect(loader).not.toHaveBeenCalled()
})
test('取得中の区分変更も選択県を維持し到着時の区分を渡す・全区分再利用', async () => {
  let resolve!: (value: ReturnType<typeof parsePopulation>) => void
  const loader = vi.fn(
    () =>
      new Promise<ReturnType<typeof parsePopulation>>((r) => {
        resolve = r
      }),
  )
  const { wrapper } = render(loader)
  expect(wrapper.get('[role="status"]').text()).toContain('読み込み中')
  await wrapper.get('input[value="young"]').setValue()
  resolve(parsePopulation(populationResponse()))
  await flushPromises()
  expect(wrapper.get('output').text()).toContain('"value":101')
  for (const [category, value] of [
    ['working', 102],
    ['elder', 103],
    ['total', 100],
  ] as const) {
    await wrapper.get(`input[value="${category}"]`).setValue()
    expect(wrapper.get('output').text()).toContain(`"value":${value}`)
  }
  expect(wrapper.props('selectedPrefectures')).toEqual(prefectures.slice(0, 1))
  expect(loader).toHaveBeenCalledTimes(1)
})
test('複数県は独立取得し未取得県だけ追加・解除/再選択ではキャッシュを利用', async () => {
  const { wrapper, loader } = render()
  await flushPromises()
  await wrapper.setProps({ selectedPrefectures: prefectures })
  await flushPromises()
  expect(loader.mock.calls.map((c) => c[0])).toEqual([1, 13])
  expect(wrapper.get('output').text()).toContain('東京都')
  await wrapper.setProps({ selectedPrefectures: prefectures.slice(1) })
  expect(wrapper.get('output').text()).not.toContain('北海道')
  await wrapper.setProps({ selectedPrefectures: prefectures })
  await flushPromises()
  expect(loader).toHaveBeenCalledTimes(2)
})
test('失敗後の区分変更では自動再取得せず再試行・成功県を維持', async () => {
  const loader = vi
    .fn()
    .mockResolvedValueOnce(parsePopulation(populationResponse()))
    .mockRejectedValueOnce(new Error('secret'))
    .mockResolvedValue(parsePopulation(populationResponse(200)))
  const { wrapper } = render(loader, prefectures)
  await flushPromises()
  expect(wrapper.get('[role="alert"]').text()).not.toContain('secret')
  await wrapper.get('input[value="elder"]').setValue()
  expect(loader).toHaveBeenCalledTimes(2)
  await wrapper.get('button').trigger('click')
  await flushPromises()
  expect(loader.mock.calls.map((c) => c[0])).toEqual([1, 13, 13])
  expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  expect(wrapper.get('output').text()).toContain('"value":203')
})
test.each(['resolve', 'reject'])(
  '解除後の遅延%sは県を復活させない・再選択中も重複通信しない',
  async (kind) => {
    let resolve!: (value: ReturnType<typeof parsePopulation>) => void
    let reject!: (reason: Error) => void
    const loader = vi.fn(
      () =>
        new Promise<ReturnType<typeof parsePopulation>>((r, j) => {
          resolve = r
          reject = j
        }),
    )
    const { wrapper } = render(loader)
    await wrapper.setProps({ selectedPrefectures: [] })
    await wrapper.setProps({ selectedPrefectures: prefectures.slice(0, 1) })
    expect(loader).toHaveBeenCalledTimes(1)
    await wrapper.setProps({ selectedPrefectures: [] })
    if (kind === 'resolve') resolve(parsePopulation(populationResponse()))
    else reject(new Error('failed'))
    await flushPromises()
    expect(wrapper.text()).toContain(
      '都道府県を選択すると、人口の推移を確認できます',
    )
    expect(wrapper.find('output').exists()).toBe(false)
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  },
)

test('共通StatusMessageの状態とaction slotで再試行し、成功時に表示データへ復帰する', async () => {
  let reject!: (reason: Error) => void
  const loader = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise((_, j) => {
          reject = j
        }),
    )
    .mockResolvedValue(parsePopulation(populationResponse()))
  const { wrapper } = render(loader, [])
  expect(wrapper.getComponent(StatusMessage).props('state')).toBe('empty')
  await wrapper.setProps({ selectedPrefectures: prefectures.slice(0, 1) })
  expect(wrapper.getComponent(StatusMessage).props('state')).toBe('loading')
  expect(wrapper.get('[aria-busy="true"]').text()).toContain(
    '人口データを読み込み中',
  )
  reject(new Error('failed'))
  await flushPromises()
  expect(wrapper.getComponent(StatusMessage).props('state')).toBe('error')
  await wrapper
    .getComponent(StatusMessage)
    .getComponent(Button)
    .trigger('click')
  await flushPromises()
  expect(wrapper.findComponent(StatusMessage).exists()).toBe(false)
  expect(wrapper.get('output').text()).toContain('"value":100')
  expect(loader).toHaveBeenCalledTimes(2)
})
