import { afterEach, expect, test, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import PopulationChart from '../../src/components/population/PopulationChart.vue'
import { series } from '../fixtures/populationChart'
const mocks = vi.hoisted(() => ({
  instances: [] as {
    data: unknown
    update: ReturnType<typeof vi.fn>
    destroy: ReturnType<typeof vi.fn>
  }[],
}))
vi.mock('chart.js', () => {
  class Chart {
    static register = vi.fn()
    data: unknown
    update = vi.fn()
    destroy = vi.fn()
    constructor(_canvas: unknown, config: { data: unknown }) {
      this.data = config.data
      mocks.instances.push(this)
    }
  }
  return {
    Chart,
    LineController: {},
    LineElement: {},
    PointElement: {},
    LinearScale: {},
    Tooltip: {},
  }
})
afterEach(() => mocks.instances.splice(0))
test('生成後は区分・解除・連続更新で同じinstanceを更新し、全解除で破棄・再表示・unmountで残さない', async () => {
  const wrapper = mount(PopulationChart, {
    props: { series, category: 'total' },
  })
  expect(mocks.instances).toHaveLength(1)
  const first = mocks.instances[0]!
  expect(first.data).toMatchObject({
    datasets: [{ label: '東京都' }, { label: '北海道' }],
  })
  await wrapper.setProps({
    category: 'young',
    series: series.map((s) => ({
      ...s,
      data: s.data.map((p) => ({ ...p, value: p.value / 2 })),
    })),
  })
  expect(first.data).toMatchObject({
    datasets: [
      { data: [{ y: 4500000 }, { y: 7000000 }] },
      { data: [{ y: 2500000 }, { y: 2600000 }] },
    ],
  })
  expect(wrapper.get('canvas').attributes('aria-label')).toContain('年少人口')
  await wrapper.setProps({ series: series.slice(1) })
  expect(first.data).toMatchObject({ datasets: [{ label: '北海道' }] })
  for (let i = 0; i < 10; i++) await wrapper.setProps({ series: [...series] })
  expect(mocks.instances).toHaveLength(1)
  expect(first.update).toHaveBeenCalled()
  await wrapper.setProps({ series: [] })
  expect(first.destroy).toHaveBeenCalledTimes(1)
  expect(wrapper.find('canvas').exists()).toBe(false)
  expect(wrapper.get('[role="status"]').text()).toContain(
    '都道府県を選択すると、人口の推移を確認できます',
  )
  await wrapper.setProps({ series })
  expect(mocks.instances).toHaveLength(2)
  wrapper.unmount()
  expect(mocks.instances[1]!.destroy).toHaveBeenCalledTimes(1)
  expect(first.destroy).toHaveBeenCalledTimes(1)
})
test('未選択では生成せず、県名凡例・現在区分・年と人数の代替表が入力と一致する', async () => {
  const wrapper = mount(PopulationChart, {
    props: { series: [], category: 'elder' },
  })
  expect(mocks.instances).toHaveLength(0)
  await wrapper.setProps({ series })
  expect(wrapper.get('[aria-label="都道府県の凡例"]').text()).toContain(
    '東京都',
  )
  expect(wrapper.find('details').exists()).toBe(false)
  expect(wrapper.get('.chart-data').classes()).toContain('chart-data-assistive')
  expect(wrapper.get('canvas').attributes('aria-describedby')).toBe(
    wrapper.get('figcaption').attributes('id'),
  )
  expect(wrapper.get('caption').text()).toContain('東京都・老年人口')
  expect(wrapper.get('tbody').text()).toContain('1960年9,000,000人')
  wrapper.unmount()
})
