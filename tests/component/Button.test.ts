import { describe, expect, test } from 'vitest'
import { mount } from '@vue/test-utils'
import Button from '../../src/components/shared/Button.vue'

describe('Button', () => {
  test('ラベルを表示し、クリックをMouseEvent付きで1回通知する', () => {
    const wrapper = mount(Button, { props: { label: '再読み込み' } })
    expect(wrapper.get('button').text()).toBe('再読み込み')
    wrapper.get('button').element.click()
    expect(wrapper.emitted('click')).toHaveLength(1)
    expect(wrapper.emitted('click')?.[0]?.[0]).toBeInstanceOf(MouseEvent)
  })

  test('disabled中は通知せず、再び有効にすると操作できる', async () => {
    const wrapper = mount(Button, {
      props: { label: '再読み込み', disabled: true },
    })
    const button = wrapper.get('button').element
    expect(button.disabled).toBe(true)
    button.click()
    // 合成イベントが直接届いても通知しない。
    button.dispatchEvent(new MouseEvent('click'))
    expect(wrapper.emitted('click')).toBeUndefined()

    await wrapper.setProps({ disabled: false })
    button.click()
    expect(wrapper.emitted('click')).toHaveLength(1)
  })

  test('ダブルクリックの2回目は通知しない', () => {
    const wrapper = mount(Button, { props: { label: '反映' } })
    const button = wrapper.get('button').element
    button.dispatchEvent(new MouseEvent('click', { detail: 1 }))
    button.dispatchEvent(new MouseEvent('click', { detail: 2 }))
    expect(wrapper.emitted('click')).toHaveLength(1)
  })

  test.each([
    { given: '指定なし', type: undefined, expected: 'button' },
    { given: 'submit', type: 'submit', expected: 'submit' },
    { given: 'reset', type: 'reset', expected: 'reset' },
  ] as const)(
    'type が$givenなら $expected として描く',
    ({ type, expected }) => {
      const wrapper = mount(Button, { props: { label: '操作', type } })
      expect(wrapper.get('button').element.type).toBe(expected)
    },
  )

  test('aria属性やidをネイティブのbuttonへ引き継ぐ', () => {
    const wrapper = mount(Button, {
      props: { label: '詳細' },
      attrs: {
        'aria-expanded': 'false',
        'aria-controls': 'details',
        id: 'toggle',
      },
    })
    expect(wrapper.get('button').attributes()).toMatchObject({
      'aria-expanded': 'false',
      'aria-controls': 'details',
      id: 'toggle',
    })
  })
})
