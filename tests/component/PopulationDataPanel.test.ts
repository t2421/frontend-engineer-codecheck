import { beforeEach, describe, expect, test, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import StatusMessage from '../../src/components/shared/StatusMessage.vue'
import Button from '../../src/components/shared/Button.vue'
import PopulationDataPanel from '../../src/components/population/PopulationDataPanel.vue'
import { parsePopulation } from '../../src/components/population/populationApi'
import { populationResponse } from '../fixtures/population'
const prefectures = [
  { prefCode: 1, prefName: '北海道' },
  { prefCode: 13, prefName: '東京都' },
]
function render(
  loader = vi.fn().mockResolvedValue(parsePopulation(populationResponse())),
  selectedPrefectures = prefectures.slice(0, 1),
) {
  const wrapper = mount(PopulationDataPanel, {
    props: { selectedPrefectures, loader },
    slots: {
      default: `<template #default="{ series, category }"><output :data-category="category"><section v-for="entry in series" :key="entry.prefCode" :data-pref-code="entry.prefCode"><span>{{ entry.prefName }}</span><span v-for="point in entry.data" :key="point.year" :data-year="point.year" :data-value="point.value"></span></section></output></template>`,
    },
  })
  return { wrapper, loader }
}
function populationValue(wrapper: ReturnType<typeof mount>, prefCode: number) {
  return wrapper
    .get(`[data-pref-code="${prefCode}"] [data-year="2020"]`)
    .attributes('data-value')
}
function pendingPopulation() {
  let resolve!: (value: ReturnType<typeof parsePopulation>) => void
  let reject!: (reason: Error) => void
  const loader = vi.fn(
    () =>
      new Promise<ReturnType<typeof parsePopulation>>((r, j) => {
        resolve = r
        reject = j
      }),
  )
  return {
    loader,
    resolve: () => resolve(parsePopulation(populationResponse())),
    reject: () => reject(new Error('failed')),
  }
}

test('初期は総人口で未選択案内を表示する', () => {
  const { wrapper } = render(undefined, [])
  expect(wrapper.get('input[value="total"]').element).toHaveProperty(
    'checked',
    true,
  )
  expect(wrapper.text()).toContain(
    '都道府県を選択すると、人口の推移を確認できます',
  )
})
test('未選択時の区分変更では通信しない', async () => {
  const { wrapper, loader } = render(undefined, [])
  await wrapper.get('input[value="young"]').setValue()
  await flushPromises()
  expect(loader).not.toHaveBeenCalled()
})

describe('取得中の区分変更', () => {
  let pending: ReturnType<typeof pendingPopulation>
  let wrapper: ReturnType<typeof render>['wrapper']
  beforeEach(() => {
    pending = pendingPopulation()
    ;({ wrapper } = render(pending.loader))
  })
  test('取得中の案内を公開する', () => {
    expect(wrapper.get('[role="status"]').text()).toContain('読み込み中')
  })
  test('区分を変更しても選択県を維持する', async () => {
    await wrapper.get('input[value="young"]').setValue()
    pending.resolve()
    await flushPromises()
    for (const category of ['working', 'elder', 'total']) {
      await wrapper.get(`input[value="${category}"]`).setValue()
    }
    expect(wrapper.props('selectedPrefectures')).toEqual(
      prefectures.slice(0, 1),
    )
  })
  test('応答到着時の区分の値を渡す', async () => {
    await wrapper.get('input[value="young"]').setValue()
    pending.resolve()
    await flushPromises()
    expect(populationValue(wrapper, 1)).toBe('101')
  })
  test('全区分を取得済みデータから表示する', async () => {
    await wrapper.get('input[value="young"]').setValue()
    pending.resolve()
    await flushPromises()
    for (const [category, value] of [
      ['working', 102],
      ['elder', 103],
      ['total', 100],
    ] as const) {
      await wrapper.get(`input[value="${category}"]`).setValue()
      expect(populationValue(wrapper, 1)).toBe(String(value))
    }
    expect(pending.loader).toHaveBeenCalledTimes(1)
  })
})

describe('県別キャッシュ', () => {
  let wrapper: ReturnType<typeof render>['wrapper']
  let loader: ReturnType<typeof render>['loader']
  beforeEach(async () => {
    ;({ wrapper, loader } = render())
    await flushPromises()
  })
  test('追加した未取得県だけを独立取得する', async () => {
    await wrapper.setProps({ selectedPrefectures: prefectures })
    await flushPromises()
    expect(loader.mock.calls.map((c) => c[0])).toEqual([1, 13])
    expect(wrapper.findAll('[data-pref-code]')).toHaveLength(2)
    expect(wrapper.get('[data-pref-code="13"]').text()).toBe('東京都')
  })
  test('解除した県を表示対象から外す', async () => {
    await wrapper.setProps({ selectedPrefectures: prefectures })
    await flushPromises()
    await wrapper.setProps({ selectedPrefectures: prefectures.slice(1) })
    expect(wrapper.find('[data-pref-code="1"]').exists()).toBe(false)
  })
  test('解除後の再選択では成功キャッシュを利用する', async () => {
    await wrapper.setProps({ selectedPrefectures: prefectures })
    await flushPromises()
    await wrapper.setProps({ selectedPrefectures: prefectures.slice(1) })
    await wrapper.setProps({ selectedPrefectures: prefectures })
    await flushPromises()
    expect(loader).toHaveBeenCalledTimes(2)
  })
})

describe('失敗と再試行', () => {
  let wrapper: ReturnType<typeof render>['wrapper']
  let loader: ReturnType<typeof render>['loader']
  beforeEach(async () => {
    loader = vi
      .fn()
      .mockResolvedValueOnce(parsePopulation(populationResponse()))
      .mockRejectedValueOnce(new Error('secret'))
      .mockResolvedValue(parsePopulation(populationResponse(200)))
    ;({ wrapper } = render(loader, prefectures))
    await flushPromises()
  })
  test('失敗の内部情報を案内へ出さない', () => {
    expect(wrapper.get('[role="alert"]').text()).not.toContain('secret')
  })
  test('失敗後の区分変更では自動再取得しない', async () => {
    await wrapper.get('input[value="elder"]').setValue()
    expect(loader).toHaveBeenCalledTimes(2)
  })
  test('失敗県を再試行して現在の区分の表示へ戻る', async () => {
    await wrapper.get('input[value="elder"]').setValue()
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(loader.mock.calls.map((c) => c[0])).toEqual([1, 13, 13])
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(populationValue(wrapper, 13)).toBe('203')
  })
})

test('取得中の県を再選択しても重複通信しない', async () => {
  const pending = pendingPopulation()
  const { wrapper } = render(pending.loader)
  await wrapper.setProps({ selectedPrefectures: [] })
  await wrapper.setProps({ selectedPrefectures: prefectures.slice(0, 1) })
  expect(pending.loader).toHaveBeenCalledTimes(1)
})
test.each(['resolve', 'reject'] as const)(
  '解除後の遅延%sは県を復活させない',
  async (kind) => {
    const pending = pendingPopulation()
    const { wrapper } = render(pending.loader)
    await wrapper.setProps({ selectedPrefectures: [] })
    await wrapper.setProps({ selectedPrefectures: prefectures.slice(0, 1) })
    await wrapper.setProps({ selectedPrefectures: [] })
    pending[kind]()
    await flushPromises()
    expect(wrapper.text()).toContain(
      '都道府県を選択すると、人口の推移を確認できます',
    )
    expect(wrapper.find('output').exists()).toBe(false)
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  },
)

describe('共通StatusMessageとの結合', () => {
  let pending: ReturnType<typeof pendingPopulation>
  let wrapper: ReturnType<typeof render>['wrapper']
  let loader: ReturnType<typeof render>['loader']
  beforeEach(() => {
    pending = pendingPopulation()
    // 最初の要求を遅延失敗にし、その後の再試行だけ成功させる。
    loader = vi
      .fn()
      .mockImplementationOnce(pending.loader)
      .mockResolvedValue(parsePopulation(populationResponse()))
    ;({ wrapper } = render(loader, []))
  })
  test('未選択はemptyを渡す', () => {
    expect(wrapper.getComponent(StatusMessage).props('state')).toBe('empty')
  })
  test('取得中はloadingとbusy表示を渡す', async () => {
    await wrapper.setProps({ selectedPrefectures: prefectures.slice(0, 1) })
    expect(wrapper.getComponent(StatusMessage).props('state')).toBe('loading')
    expect(wrapper.get('[aria-busy="true"]').text()).toContain(
      '人口データを読み込み中',
    )
  })
  test('失敗はerrorを渡す', async () => {
    await wrapper.setProps({ selectedPrefectures: prefectures.slice(0, 1) })
    pending.reject()
    await flushPromises()
    expect(wrapper.getComponent(StatusMessage).props('state')).toBe('error')
  })
  test('action slotの再試行で表示データへ復帰する', async () => {
    await wrapper.setProps({ selectedPrefectures: prefectures.slice(0, 1) })
    pending.reject()
    await flushPromises()
    await wrapper
      .getComponent(StatusMessage)
      .getComponent(Button)
      .trigger('click')
    await flushPromises()
    expect(wrapper.findComponent(StatusMessage).exists()).toBe(false)
    expect(populationValue(wrapper, 1)).toBe('100')
    expect(loader).toHaveBeenCalledTimes(2)
  })
})

test('失敗県は解除後の再選択で再取得し、成功キャッシュは維持する', async () => {
  const loader = vi
    .fn()
    .mockResolvedValueOnce(parsePopulation(populationResponse()))
    .mockRejectedValueOnce(new Error('internal'))
    .mockResolvedValue(parsePopulation(populationResponse(200)))
  const { wrapper } = render(loader, prefectures)
  await flushPromises()
  await wrapper.setProps({ selectedPrefectures: prefectures.slice(0, 1) })
  await wrapper.setProps({ selectedPrefectures: prefectures })
  await flushPromises()
  expect(loader.mock.calls.map((c) => c[0])).toEqual([1, 13, 13])
  expect(wrapper.get('[data-pref-code="13"]').text()).toBe('東京都')
  expect(wrapper.find('[role="alert"]').exists()).toBe(false)
})

test('別県が読み込み中でも既存の失敗案内と再試行を維持する', async () => {
  const loader = vi
    .fn()
    .mockResolvedValueOnce(parsePopulation(populationResponse()))
    .mockRejectedValueOnce(new Error('internal'))
    .mockImplementation(() => new Promise(() => {}))
  const { wrapper } = render(loader, prefectures)
  await flushPromises()
  await wrapper.setProps({
    selectedPrefectures: [...prefectures, { prefCode: 27, prefName: '大阪府' }],
  })
  expect(wrapper.getComponent(StatusMessage).props('state')).toBe('error')
  expect(wrapper.get('button').text()).toBe('再読み込み')
  expect(wrapper.get('[data-pref-code="1"]').text()).toBe('北海道')
  await wrapper.get('button').trigger('click')
  expect(loader.mock.calls.map((c) => c[0])).toEqual([1, 13, 27, 13])
})

test('追加取得中は既存データを維持してコンパクトな状態表示にする', async () => {
  const loader = vi
    .fn()
    .mockResolvedValueOnce(parsePopulation(populationResponse()))
    .mockImplementation(() => new Promise(() => {}))
  const { wrapper } = render(loader)
  await flushPromises()
  await wrapper.setProps({ selectedPrefectures: prefectures })
  expect(wrapper.getComponent(StatusMessage).props('compact')).toBe(true)
  expect(wrapper.get('[data-pref-code="1"]').text()).toBe('北海道')
})
