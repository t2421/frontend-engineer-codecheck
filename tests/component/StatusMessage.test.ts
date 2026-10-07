import { afterEach, expect, test, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { h } from 'vue'
import StatusMessage from '../../src/components/shared/StatusMessage.vue'
import Button from '../../src/components/shared/Button.vue'

const wrappers: ReturnType<typeof mount>[] = []
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))

test.each([
  [
    'empty',
    '都道府県を選択すると、人口の推移を確認できます',
    '比較したい都道府県にチェックを入れると、人口の推移を表示します。',
    'status',
  ],
  ['loading', '人口データを読み込み中…', 'しばらくお待ちください。', 'status'],
  [
    'error',
    '人口データを取得できませんでした',
    '接続を確認して、もう一度お試しください。',
    'alert',
  ],
  [
    'error',
    '都道府県一覧を取得できませんでした',
    '接続を確認して、一覧を再読み込みしてください。',
    'alert',
  ],
] as const)(
  '%sの文言と読み上げの役割を表示する',
  (state, title, description, role) => {
    const wrapper = mount(StatusMessage, {
      props: { state, title, description },
    })
    wrappers.push(wrapper)
    const message = wrapper.get(`[role="${role}"]`)
    expect(message.text()).toBe(title + description)
    expect(message.attributes('aria-live')).toBe(
      role === 'alert' ? 'assertive' : 'polite',
    )
    expect(message.attributes('aria-atomic')).toBe('true')
    expect(message.attributes('aria-busy')).toBeUndefined()
    expect(message.element.closest('[aria-busy="true"]')).toBeNull()
    expect(wrapper.get('.status-message').attributes('aria-busy')).toBe(
      state === 'loading' ? 'true' : 'false',
    )
    expect(wrapper.get('h3').text()).toBe(title)
    expect(wrapper.get('img').attributes('alt')).toBe('')
    expect(wrapper.find('button').exists()).toBe(false)
  },
)

test('同じ部品の状態と文言を更新でき、読み込み終了を反映する', async () => {
  const wrapper = mount(StatusMessage, {
    props: { state: 'empty', title: '未選択' },
  })
  wrappers.push(wrapper)
  expect(wrapper.find('p').exists()).toBe(false)
  expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  await wrapper.setProps({
    state: 'loading',
    title: '読み込み中',
    description: 'お待ちください',
  })
  expect(wrapper.get('[role="status"]').text()).toBe('読み込み中お待ちください')
  expect(wrapper.get('.status-message').attributes('aria-busy')).toBe('true')
  await wrapper.setProps({
    state: 'error',
    title: '取得失敗',
    description: '再試行してください',
  })
  expect(wrapper.get('[role="alert"]').text()).toBe(
    '取得失敗再試行してください',
  )
  expect(wrapper.get('.status-message').attributes('aria-busy')).toBe('false')
  expect(wrapper.find('[role="status"]').exists()).toBe(false)
})

test('任意の操作はslotで提供し呼び出し元の再試行を通知する', async () => {
  const retry = vi.fn()
  const wrapper = mount(StatusMessage, {
    props: { state: 'error', title: '取得失敗', headingLevel: 2 },
    slots: {
      action: () => h(Button, { label: '再読み込み', onClick: retry }),
    },
  })
  wrappers.push(wrapper)
  expect(wrapper.get('h2').text()).toBe('取得失敗')
  expect(wrapper.get('[role="alert"]').find('button').exists()).toBe(false)
  await wrapper.get('button').trigger('click')
  expect(retry).toHaveBeenCalledTimes(1)
  expect(wrapper.get('.status-message').attributes('aria-busy')).toBe('false')
  expect(wrapper.get('[role="alert"]').text()).toBe('取得失敗')
})
