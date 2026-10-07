import { afterEach, describe, expect, test } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import Button from '../../src/shared/ui/Button.vue'

enableAutoUnmount(afterEach)

describe('Button', () => {
  test('ラベルを表示し、クリックを一度通知する', () => {
    const wrapper = mount(Button, { props: { label: '再読み込み' } })
    const button = wrapper.get('button')
    expect(button.text()).toBe('再読み込み')
    button.element.click()
    expect(wrapper.emitted('click')).toHaveLength(1)
    expect(wrapper.emitted('click')?.[0]?.[0]).toBeInstanceOf(MouseEvent)
  })

  test('無効時は通知せず、再び有効にすると操作できる', async () => {
    const wrapper = mount(Button, {
      props: { label: '再読み込み', disabled: true },
    })
    expect(wrapper.get('button').element.disabled).toBe(true)
    wrapper.get('button').element.click()
    // 合成イベントが直接送られた場合も通知しない。
    wrapper.get('button').element.dispatchEvent(new MouseEvent('click'))
    expect(wrapper.emitted('click')).toBeUndefined()

    await wrapper.setProps({ disabled: false, label: 'もう一度' })
    expect(wrapper.get('button').text()).toBe('もう一度')
    wrapper.get('button').element.click()
    expect(wrapper.emitted('click')).toHaveLength(1)
  })

  test('既定ではフォームを送信しない', () => {
    const wrapper = mount(Button, { props: { label: '操作' } })
    expect(wrapper.get('button').element.type).toBe('button')
  })

  test.each(['submit', 'reset'] as const)('%s を指定できる', (type) => {
    const wrapper = mount(Button, { props: { label: '操作', type } })
    expect(wrapper.get('button').element.type).toBe(type)
  })

  test('aria属性などをネイティブbuttonに引き継ぐ', () => {
    const wrapper = mount(Button, {
      props: { label: '詳細', variant: 'primary' },
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
