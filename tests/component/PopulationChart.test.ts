import { afterEach, describe, expect, test, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import PopulationChart from '../../src/components/population/PopulationChart.vue'
import type {
  PopulationCategory,
  PopulationSeries,
} from '../../src/components/population/populationApi'
import { series } from '../fixtures/populationChart'

// jsdomはCanvasを描画できないため、Chart.jsを「生成・更新・破棄を記録するだけ」の実装に置き換える。
const charts = vi.hoisted(() => ({
  instances: [] as { data: unknown; update: () => void; destroy: () => void }[],
}))
vi.mock('chart.js', () => {
  class Chart {
    static register = vi.fn()
    data: unknown
    update = vi.fn()
    destroy = vi.fn()
    constructor(_canvas: unknown, config: { data: unknown }) {
      this.data = config.data
      charts.instances.push(this)
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
afterEach(() => charts.instances.splice(0))

const mountChart = (
  props: {
    series: readonly PopulationSeries[]
    category: PopulationCategory
  } = { series, category: 'total' },
) => mount(PopulationChart, { props })
const halved = series.map((s) => ({
  ...s,
  data: s.data.map((p) => ({ ...p, value: p.value / 2 })),
}))

describe('PopulationChart: Chart.jsインスタンスの寿命', () => {
  test('県が選ばれていればインスタンスを1つ生成し、未選択なら生成せず案内を出す', () => {
    mountChart({ series: [], category: 'total' })
    expect(charts.instances).toHaveLength(0)

    const wrapper = mountChart()
    expect(charts.instances).toHaveLength(1)
    expect(charts.instances[0]?.data).toMatchObject({
      datasets: [{ label: '東京都' }, { label: '北海道' }],
    })
    expect(wrapper.find('canvas').exists()).toBe(true)
  })

  test('区分や県の変更は同じインスタンスのデータを更新し、作り直さない', async () => {
    const wrapper = mountChart()
    const chart = charts.instances[0]
    if (!chart) throw new Error('Chartが生成されていません')
    await wrapper.setProps({ category: 'young', series: halved })
    expect(chart.data).toMatchObject({
      datasets: [
        { data: [{ y: 4500000 }, { y: 7000000 }] },
        { data: [{ y: 2500000 }, { y: 2600000 }] },
      ],
    })
    await wrapper.setProps({ series: series.slice(1) })
    expect(chart.data).toMatchObject({ datasets: [{ label: '北海道' }] })
    expect(charts.instances).toHaveLength(1)
    expect(chart.update).toHaveBeenCalled()
  })

  test('全解除で破棄して案内に戻り、再選択で新しいインスタンスを生成する', async () => {
    const wrapper = mountChart()
    const first = charts.instances[0]
    await wrapper.setProps({ series: [] })
    expect(first?.destroy).toHaveBeenCalledTimes(1)
    expect(wrapper.find('canvas').exists()).toBe(false)
    expect(wrapper.get('[role="status"]').text()).toContain(
      '都道府県を選択すると、人口の推移を確認できます',
    )
    await wrapper.setProps({ series })
    expect(charts.instances).toHaveLength(2)
  })

  test('unmountでインスタンスを破棄する', () => {
    const wrapper = mountChart()
    wrapper.unmount()
    expect(charts.instances[0]?.destroy).toHaveBeenCalledTimes(1)
  })
})

describe('PopulationChart: 読み上げ向けの代替表現', () => {
  test('凡例・区分名入りのラベル・説明文・年別の表を描き、canvasから説明文を参照する', () => {
    const wrapper = mountChart({ series, category: 'elder' })
    expect(wrapper.get('[aria-label="都道府県の凡例"]').text()).toContain(
      '東京都',
    )
    const canvas = wrapper.get('canvas')
    expect(canvas.attributes('aria-label')).toContain('老年人口')
    expect(canvas.attributes('aria-describedby')).toBe(
      wrapper.get('.chart-description').attributes('id'),
    )
    expect(wrapper.get('caption').text()).toContain('東京都・老年人口')
    expect(wrapper.get('tbody').text()).toContain('1960年9,000,000人')
  })
})
