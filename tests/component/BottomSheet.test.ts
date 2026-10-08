import { expect, test, vi } from 'vitest'
import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'
import BottomSheet from '../../src/components/shared/BottomSheet.vue'

function mountSheet() {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  vi.spyOn(HTMLElement.prototype, 'getClientRects').mockImplementation(() =>
    Object.assign([new DOMRect()], { item: () => new DOMRect() }),
  )
  const Host = defineComponent({
    components: { BottomSheet },
    setup: () => ({ open: ref(false) }),
    template: `<button @click="open = true">シートを開く</button>
      <BottomSheet v-model="open" title="確認">
        <input aria-label="名前" /><button @click="open = false">反映</button>
      </BottomSheet>`,
  })
  const wrapper = mount(Host, { attachTo: document.body })
  const dialog = document.querySelector('dialog')
  if (!(dialog instanceof HTMLDialogElement))
    throw new Error('dialogが必要です')
  // jsdomにないネイティブdialog APIだけを、この要素上で補う。
  Object.assign(dialog, {
    showModal: () => {
      dialog.open = true
      dialog.querySelector<HTMLElement>('button')?.focus()
    },
    close: () => {
      dialog.open = false
    },
  })
  return { wrapper, dialog: new DOMWrapper(dialog) }
}

test('開くとタイトルとslotを表示し、ページのスクロールを固定する', async () => {
  const { wrapper, dialog } = mountSheet()
  await wrapper.get('button').trigger('click')
  expect(dialog.element).toHaveProperty('open', true)
  expect(dialog.get('h2').text()).toBe('確認')
  expect(document.body.style.position).toBe('fixed')
  expect(document.activeElement?.textContent).toBe('閉じる')
  await dialog.get('input').setValue('名前')
  expect(dialog.get('input').element).toHaveProperty('value', '名前')
})

test.each(['click', 'cancel'])(
  '%sで閉じて元のフォーカスとscroll lockを復元する',
  async (event) => {
    const { wrapper, dialog } = mountSheet()
    wrapper.get('button').element.focus()
    await wrapper.get('button').trigger('click')
    await dialog.trigger(event)
    expect(dialog.element).toHaveProperty('open', false)
    expect(document.body.style.position).toBe('')
    expect(document.activeElement?.textContent).toBe('シートを開く')
  },
)

test('背景へのダブルクリックの2回目では閉じない', async () => {
  const { wrapper, dialog } = mountSheet()
  await wrapper.get('button').trigger('click')
  dialog.element.dispatchEvent(new MouseEvent('click', { detail: 2 }))
  await flushPromises()
  expect(dialog.element).toHaveProperty('open', true)
})

test('TabとShift+Tabは先頭と末尾を巡回し中間操作を妨げない', async () => {
  const { wrapper, dialog } = mountSheet()
  await wrapper.get('button').trigger('click')
  await dialog.trigger('keydown', { key: 'Tab', shiftKey: true })
  expect(document.activeElement?.textContent).toBe('反映')
  await dialog.trigger('keydown', { key: 'Tab' })
  expect(document.activeElement?.textContent).toBe('閉じる')
  dialog.get('input').element.focus()
  await dialog.trigger('keydown', { key: 'Tab' })
  expect(document.activeElement).toBe(dialog.get('input').element)
})

test('開いたままunmountしてもページ状態を復元する', async () => {
  const { wrapper } = mountSheet()
  await wrapper.get('button').trigger('click')
  wrapper.unmount()
  expect(document.body.style.position).toBe('')
  expect(window.scrollTo).toHaveBeenCalled()
})
