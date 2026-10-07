import { afterEach, expect, test } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'
import Checkbox from '../../src/components/shared/Checkbox.vue'

afterEach(() => {
  document.body.innerHTML = ''
})

test('ラベルがネイティブcheckboxに関連付く', () => {
  const wrapper = mount(Checkbox, {
    props: { label: '任意の項目', modelValue: false },
    attachTo: document.body,
  })
  const input = wrapper.get('input').element
  expect(input.type).toBe('checkbox')
  expect(input.checked).toBe(false)
  expect(input.labels?.[0]?.textContent).toContain('任意の項目')
})

test('ラベルクリックでv-modelを選択・解除し、booleanを各1回通知する', async () => {
  const parent = defineComponent({
    components: { Checkbox },
    setup: () => ({ selected: ref(false) }),
    template: '<Checkbox v-model="selected" label="任意の項目" />',
  })
  const wrapper = mount(parent, { attachTo: document.body })
  const checkbox = wrapper.getComponent(Checkbox)
  await checkbox.get('label').trigger('click')
  expect(wrapper.get('input').element.checked).toBe(true)
  await checkbox.get('label').trigger('click')
  expect(wrapper.get('input').element.checked).toBe(false)
  expect(checkbox.emitted('update:modelValue')).toEqual([[true], [false]])
  expect(checkbox.emitted('change')).toEqual([[true], [false]])
})

test('親の選択状態変更を反映し、操作通知を出さない', async () => {
  const wrapper = mount(Checkbox, {
    props: { label: '任意の項目', modelValue: false },
  })
  await wrapper.setProps({ modelValue: true })
  expect(wrapper.get('input').element.checked).toBe(true)
  await wrapper.setProps({ modelValue: false })
  expect(wrapper.get('input').element.checked).toBe(false)
  expect(wrapper.emitted('change')).toBeUndefined()
  expect(wrapper.emitted('update:modelValue')).toBeUndefined()
})

test.each([false, true])(
  'disabledは選択状態%sを維持し、クリックを通知しない',
  async (selected) => {
    const wrapper = mount(Checkbox, {
      props: { label: '任意の項目', modelValue: selected, disabled: true },
      attachTo: document.body,
    })
    expect(wrapper.get('input').element.disabled).toBe(true)
    await wrapper.get('label').trigger('click')
    wrapper.get('input').element.click()
    expect(wrapper.get('input').element.checked).toBe(selected)
    expect(wrapper.emitted('change')).toBeUndefined()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  },
)

test('disabled中にchangeが届いても通知しない', async () => {
  const wrapper = mount(Checkbox, {
    props: { label: '任意の項目', modelValue: false, disabled: true },
  })
  await wrapper.get('input').trigger('change')
  expect(wrapper.emitted('change')).toBeUndefined()
  expect(wrapper.emitted('update:modelValue')).toBeUndefined()
})

test('無効解除後は入力クリックを通知する', async () => {
  const wrapper = mount(Checkbox, {
    props: { label: '任意の項目', modelValue: false, disabled: true },
    attachTo: document.body,
  })
  await wrapper.setProps({ disabled: false })
  await wrapper.get('input').trigger('click')
  expect(wrapper.emitted('update:modelValue')).toEqual([[true]])
  expect(wrapper.emitted('change')).toEqual([[true]])
})

test('複数のラベルは各自のcheckboxだけを切り替える', async () => {
  const first = mount(Checkbox, {
    props: { label: '項目A', modelValue: false },
    attachTo: document.body,
  })
  const second = mount(Checkbox, {
    props: { label: '項目B', modelValue: false },
    attachTo: document.body,
  })
  await second.get('label').trigger('click')
  expect(first.emitted('change')).toBeUndefined()
  expect(second.emitted('change')).toEqual([[true]])
})
