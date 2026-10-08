import { describe, expect, test, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import PrefectureSelectionPanel from '../../src/components/prefectures/PrefectureSelectionPanel.vue'
import type { Prefecture } from '../../src/components/prefectures/prefectureApi'
import { deferred } from '../fixtures/deferred'
import { hokkaido, tokyo } from '../fixtures/prefectures'
import { buttonByLabel, checkboxByLabel } from './queries'

const prefectures = [tokyo, hokkaido]

function mountPanel(loader: () => Promise<Prefecture[]>) {
  return mount(PrefectureSelectionPanel, { props: { modelValue: [], loader } })
}
const skeletonCount = (wrapper: ReturnType<typeof mountPanel>) =>
  wrapper.findAll('.checkbox-skeleton').length

describe('PrefectureSelectionPanel', () => {
  test('取得中は47件のスケルトンを出し、取得後に一覧へ置き換えて選択県を通知する', async () => {
    const pending = deferred<Prefecture[]>()
    const wrapper = mountPanel(() => pending.promise)
    expect(skeletonCount(wrapper)).toBe(47)
    expect(wrapper.find('input').exists()).toBe(false)

    pending.resolve(prefectures)
    await flushPromises()
    expect(skeletonCount(wrapper)).toBe(0)
    await checkboxByLabel(wrapper, '北海道').setValue(true)
    expect(wrapper.emitted('update:modelValue')).toEqual([[[hokkaido]]])
  })

  test('取得失敗は内部情報を出さず、再読み込みで取得し直す（連打しても1回）', async () => {
    const pending = deferred<Prefecture[]>()
    const loader = vi
      .fn()
      .mockRejectedValueOnce(new Error('internal details'))
      .mockImplementationOnce(() => pending.promise)
    const wrapper = mountPanel(loader)
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain(
      '都道府県一覧を取得できませんでした',
    )
    expect(wrapper.text()).not.toContain('internal details')

    const retry = buttonByLabel(wrapper, '再読み込み')
    await retry.trigger('click')
    await retry.trigger('click')
    expect(loader).toHaveBeenCalledTimes(2)
    expect(skeletonCount(wrapper)).toBe(47)

    pending.resolve(prefectures)
    await flushPromises()
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.findAll('input')).toHaveLength(2)
  })

  test('スマホ表示は閉じたまま取得を始め、開いた先で取得完了を反映し再取得しない', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    )
    const pending = deferred<Prefecture[]>()
    const loader = vi.fn(() => pending.promise)
    const wrapper = mountPanel(loader)
    const toggle = wrapper.get('[aria-expanded]')
    expect(toggle.attributes('aria-expanded')).toBe('false')

    await toggle.trigger('click')
    expect(skeletonCount(wrapper)).toBe(47)
    pending.resolve(prefectures)
    await flushPromises()
    expect(toggle.attributes('aria-expanded')).toBe('true')
    expect(wrapper.findAll('input')).toHaveLength(2)

    await toggle.trigger('click')
    await toggle.trigger('click')
    expect(wrapper.findAll('input')).toHaveLength(2)
    expect(loader).toHaveBeenCalledTimes(1)
  })
})
