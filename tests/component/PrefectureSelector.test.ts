import { describe, expect, test } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'
import PrefectureSelector from '../../src/components/prefectures/PrefectureSelector.vue'
import { hokkaido, tokyo } from '../fixtures/prefectures'
import { buttonByLabel, checkboxByLabel } from './queries'

const prefectures = [tokyo, hokkaido]

// 親がv-modelで持つ選択値を<output>に描き、表示結果で確かめる。
function mountWithHost() {
  const Host = defineComponent({
    components: { PrefectureSelector },
    setup: () => ({ selected: ref<number[]>([]), prefectures }),
    template: `<PrefectureSelector v-model="selected" :prefectures="prefectures" />
      <output>{{ selected.join(",") }}</output>`,
  })
  const wrapper = mount(Host)
  const selectedCodes = () => {
    const text = wrapper.get('output').text()
    return text === '' ? [] : text.split(',').map(Number)
  }
  return { wrapper, selectedCodes }
}

describe('PrefectureSelector', () => {
  test('一覧をAPI順に表示し、選択・解除をAPI順のコードで親に伝える', async () => {
    const { wrapper, selectedCodes } = mountWithHost()
    expect(wrapper.findAll('label').map((label) => label.text())).toEqual([
      '東京都',
      '北海道',
    ])
    await checkboxByLabel(wrapper, '北海道').setValue(true)
    await checkboxByLabel(wrapper, '東京都').setValue(true)
    expect(selectedCodes()).toEqual([13, 1])
    await checkboxByLabel(wrapper, '東京都').setValue(false)
    expect(selectedCodes()).toEqual([1])
  })

  test('「選択を解除」で全県を解除する', async () => {
    const { wrapper, selectedCodes } = mountWithHost()
    await checkboxByLabel(wrapper, '北海道').setValue(true)
    await buttonByLabel(wrapper, '選択を解除').trigger('click')
    expect(selectedCodes()).toEqual([])
  })

  test.each([
    {
      scenario: '一覧を取得中',
      status: 'loading',
      modelValue: [],
      expected: '都道府県一覧を読み込んでいます…',
    },
    {
      scenario: '一覧の取得に失敗',
      status: 'error',
      modelValue: [],
      expected: '都道府県一覧を取得できませんでした',
    },
    {
      scenario: '取得済みで未選択',
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
      scenario: '取得中でも選択済み',
      status: 'loading',
      modelValue: [1, 13],
      expected: '東京都、北海道',
    },
    {
      scenario: '取得失敗でも選択済み',
      status: 'error',
      modelValue: [1, 13],
      expected: '東京都、北海道',
    },
  ] as const)(
    'スマホ表示で$scenarioなら要約に「$expected」を出す',
    ({ status, modelValue, expected }) => {
      const wrapper = mount(PrefectureSelector, {
        props: { prefectures, status, modelValue, mobile: true },
      })
      expect(wrapper.get('.selection-summary').text()).toBe(expected)
    },
  )

  test('スマホ表示は一覧を閉じた状態で始まり、開閉しても選択と件数を保つ', async () => {
    const wrapper = mount(PrefectureSelector, {
      props: { prefectures, modelValue: [1], mobile: true },
    })
    const toggle = wrapper.get('[aria-expanded]')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    expect(wrapper.get('[role="status"]').text()).toBe('1 / 2 選択中')
    await toggle.trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('true')
    expect(checkboxByLabel(wrapper, '北海道').element.checked).toBe(true)
    await toggle.trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    expect(wrapper.get('[role="status"]').text()).toBe('1 / 2 選択中')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })
})
