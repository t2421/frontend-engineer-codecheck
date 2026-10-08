import { afterEach, describe, expect, test } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'
import Checkbox from '../../src/components/shared/Checkbox.vue'

afterEach(() => {
  document.body.innerHTML = ''
})

function mountCheckbox(
  props: Partial<{ modelValue: boolean; disabled: boolean }> = {},
) {
  return mount(Checkbox, {
    props: { label: '任意の項目', modelValue: false, ...props },
    attachTo: document.body,
  })
}

describe('Checkbox', () => {
  test('ラベルがネイティブのcheckboxに関連付く', () => {
    const input = mountCheckbox().get('input').element
    expect(input.type).toBe('checkbox')
    expect(input.checked).toBe(false)
    expect(input.labels?.[0]?.textContent).toContain('任意の項目')
  })

  test('ラベルのクリックで選択・解除し、v-modelとchangeを1回ずつ通知する', async () => {
    const Host = defineComponent({
      components: { Checkbox },
      setup: () => ({ selected: ref(false) }),
      template: '<Checkbox v-model="selected" label="任意の項目" />',
    })
    const wrapper = mount(Host, { attachTo: document.body })
    const checkbox = wrapper.getComponent(Checkbox)
    await checkbox.get('label').trigger('click')
    expect(wrapper.get('input').element.checked).toBe(true)
    await checkbox.get('label').trigger('click')
    expect(wrapper.get('input').element.checked).toBe(false)
    expect(checkbox.emitted('update:modelValue')).toEqual([[true], [false]])
    expect(checkbox.emitted('change')).toEqual([[true], [false]])
  })

  test('親からの値の変更は反映するが、操作の通知は出さない', async () => {
    const wrapper = mountCheckbox()
    await wrapper.setProps({ modelValue: true })
    expect(wrapper.get('input').element.checked).toBe(true)
    expect(wrapper.emitted('change')).toBeUndefined()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  test.each([false, true])(
    'disabled中は選択状態（%s）を保ち、クリックを通知しない',
    async (modelValue) => {
      const wrapper = mountCheckbox({ modelValue, disabled: true })
      expect(wrapper.get('input').element.disabled).toBe(true)
      await wrapper.get('label').trigger('click')
      wrapper.get('input').element.click()
      expect(wrapper.get('input').element.checked).toBe(modelValue)
      expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    },
  )

  test('複数のcheckboxは、それぞれのラベルが自分のcheckboxだけを切り替える', async () => {
    const first = mountCheckbox()
    const second = mount(Checkbox, {
      props: { label: '項目B', modelValue: false },
      attachTo: document.body,
    })
    await second.get('label').trigger('click')
    expect(first.emitted('change')).toBeUndefined()
    expect(second.emitted('change')).toEqual([[true]])
  })
})
