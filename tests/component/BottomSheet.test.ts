import { describe, expect, test, vi } from 'vitest'
import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'
import BottomSheet from '../../src/components/shared/BottomSheet.vue'
import { buttonByLabel } from './queries'

// jsdomにはdialogのshowModal/closeと要素の描画判定がないため、必要最小限を補う。
function polyfillDialog(dialog: HTMLDialogElement) {
  Object.assign(dialog, {
    showModal: () => {
      dialog.open = true
      dialog.querySelector<HTMLElement>('button')?.focus()
    },
    close: () => {
      dialog.open = false
    },
  })
}

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
  polyfillDialog(dialog)
  const opener = buttonByLabel(wrapper, 'シートを開く')
  return { wrapper, opener, dialog: new DOMWrapper(dialog) }
}
const focusedText = () => document.activeElement?.textContent

describe('BottomSheet', () => {
  test('開くとタイトルと中身を表示し、閉じるボタンへフォーカスを移し、ページのスクロールを固定する', async () => {
    const { opener, dialog } = mountSheet()
    await opener.trigger('click')
    expect(dialog.element.open).toBe(true)
    expect(dialog.get('h2').text()).toBe('確認')
    expect(focusedText()).toBe('閉じる')
    expect(document.body.style.position).toBe('fixed')
    await dialog.get('input').setValue('名前')
    expect(dialog.get('input').element.value).toBe('名前')
  })

  test.each([
    { how: '背景のクリック', event: 'click' },
    { how: 'Escキー（cancel）', event: 'cancel' },
  ])('$howで閉じ、開く前のフォーカスとスクロールを戻す', async ({ event }) => {
    const { opener, dialog } = mountSheet()
    opener.element.focus()
    await opener.trigger('click')
    await dialog.trigger(event)
    expect(dialog.element.open).toBe(false)
    expect(document.body.style.position).toBe('')
    expect(focusedText()).toBe('シートを開く')
  })

  test('背景のダブルクリックの2回目では閉じない', async () => {
    const { opener, dialog } = mountSheet()
    await opener.trigger('click')
    dialog.element.dispatchEvent(new MouseEvent('click', { detail: 2 }))
    await flushPromises()
    expect(dialog.element.open).toBe(true)
  })

  test('TabとShift+Tabは先頭と末尾の間で巡回し、途中の要素では通常どおり進む', async () => {
    const { opener, dialog } = mountSheet()
    await opener.trigger('click')
    await dialog.trigger('keydown', { key: 'Tab', shiftKey: true })
    expect(focusedText()).toBe('反映')
    await dialog.trigger('keydown', { key: 'Tab' })
    expect(focusedText()).toBe('閉じる')
    dialog.get('input').element.focus()
    await dialog.trigger('keydown', { key: 'Tab' })
    expect(document.activeElement).toBe(dialog.get('input').element)
  })

  test('開いたままunmountしてもスクロール固定を解除する', async () => {
    const { wrapper, opener } = mountSheet()
    await opener.trigger('click')
    wrapper.unmount()
    expect(document.body.style.position).toBe('')
    expect(window.scrollTo).toHaveBeenCalled()
  })
})
