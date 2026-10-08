import { describe, expect, test, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { h } from 'vue'
import StatusMessage from '../../src/components/shared/StatusMessage.vue'
import Button from '../../src/components/shared/Button.vue'

describe('StatusMessage', () => {
  test.each([
    { state: 'empty', role: 'status', live: 'polite', busy: 'false' },
    { state: 'loading', role: 'status', live: 'polite', busy: 'true' },
    { state: 'error', role: 'alert', live: 'assertive', busy: 'false' },
  ] as const)(
    '$state は見出しと説明を表示し、読み上げ領域を role=$role で busy 領域の外に置く',
    ({ state, role, live, busy }) => {
      const wrapper = mount(StatusMessage, {
        props: { state, title: '見出し', description: '説明' },
      })
      expect(wrapper.get('h3').text()).toBe('見出し')
      expect(wrapper.get('p').text()).toBe('説明')
      expect(wrapper.get('img').attributes('alt')).toBe('')
      expect(wrapper.get('.status-message').attributes('aria-busy')).toBe(busy)

      const announcement = wrapper.get(`[role="${role}"]`)
      expect(announcement.text()).toBe('見出し説明')
      expect(announcement.attributes('aria-live')).toBe(live)
      expect(announcement.attributes('aria-atomic')).toBe('true')
      expect(announcement.element.closest('[aria-busy="true"]')).toBeNull()
    },
  )

  test('説明を省略でき、状態の更新で読み上げの役割と busy を切り替える', async () => {
    const wrapper = mount(StatusMessage, {
      props: { state: 'empty', title: '未選択' },
    })
    expect(wrapper.find('p').exists()).toBe(false)
    await wrapper.setProps({ state: 'loading', title: '読み込み中' })
    expect(wrapper.get('[role="status"]').text()).toBe('読み込み中')
    expect(wrapper.get('.status-message').attributes('aria-busy')).toBe('true')
    await wrapper.setProps({ state: 'error', title: '取得失敗' })
    expect(wrapper.get('[role="alert"]').text()).toBe('取得失敗')
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
    expect(wrapper.get('.status-message').attributes('aria-busy')).toBe('false')
  })

  test('compact 表示でも読み上げ領域は busy 領域の外に保つ', () => {
    const wrapper = mount(StatusMessage, {
      props: { state: 'loading', title: '読み込み中', compact: true },
    })
    expect(wrapper.get('.status-message').classes()).toContain(
      'status-message-compact',
    )
    expect(
      wrapper.get('[role="status"]').element.closest('[aria-busy="true"]'),
    ).toBeNull()
  })

  test('action slot の操作を読み上げ領域の外に置き、見出しレベルを指定できる', async () => {
    const retry = vi.fn()
    const wrapper = mount(StatusMessage, {
      props: { state: 'error', title: '取得失敗', headingLevel: 2 },
      slots: {
        action: () => h(Button, { label: '再読み込み', onClick: retry }),
      },
    })
    expect(wrapper.get('h2').text()).toBe('取得失敗')
    expect(wrapper.get('[role="alert"]').find('button').exists()).toBe(false)
    await wrapper.get('button').trigger('click')
    expect(retry).toHaveBeenCalledTimes(1)
  })
})
