<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  Tooltip,
  type Point,
  type LinearScaleOptions,
} from 'chart.js'
import {
  populationCategories,
  type PopulationCategory,
  type PopulationSeries,
} from './populationApi'
import {
  createPopulationChartData,
  seriesStyle,
  mobileYearTicks,
  seriesColorTokens,
} from './populationChartData'
import StatusMessage from '../shared/StatusMessage.vue'

Chart.register(LineController, LineElement, PointElement, LinearScale, Tooltip)
const props = defineProps<{
  series: readonly PopulationSeries[]
  category: PopulationCategory
}>()
const canvas = ref<globalThis.HTMLCanvasElement>()
const descriptionId = useId()
const categoryLabel = computed(
  () => populationCategories.find((c) => c.value === props.category)!.label,
)
const legends = computed(() =>
  props.series.map((s) => ({ ...s, style: seriesStyle(s.prefCode) })),
)
const formatPeople = (value: number) => `${value.toLocaleString('ja-JP')}人`
let chart: Chart<'line', Point[]> | undefined
let mounted = false
function destroy() {
  chart?.destroy()
  chart = undefined
}
function syncChart() {
  if (!props.series.length || !canvas.value) {
    destroy()
    return
  }
  const css = globalThis.getComputedStyle(canvas.value)
  const token = (name: string) => css.getPropertyValue(name).trim()
  const data = createPopulationChartData(
    props.series,
    seriesColorTokens.map(token),
  )
  if (chart) {
    chart.data = data
    chart.update('none')
    return
  }
  chart = new Chart<'line', Point[]>(canvas.value, {
    type: 'line',
    data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      onResize(instance, size) {
        // Use the same viewport breakpoint as the mobile layout, not plot width.
        const xTicks = instance.options.scales!.x!.ticks as Partial<
          LinearScaleOptions['ticks']
        >
        xTicks.autoSkip = !globalThis.matchMedia('(width < 640px)').matches
        xTicks.maxTicksLimit = 7
        instance.options.scales!.y!.ticks!.maxTicksLimit =
          size.width < 480 ? 3 : 5
      },
      color: token('--color-text-secondary'),
      font: { family: token('--font-family'), size: parseFloat(css.fontSize) },
      interaction: { mode: 'nearest', intersect: false },
      plugins: {
        tooltip: {
          callbacks: {
            title: (items) => `${items[0]?.parsed.x}年`,
            label: (item) =>
              `${item.dataset.label}: ${formatPeople(item.parsed.y ?? 0)}`,
          },
        },
      },
      scales: {
        x: {
          type: 'linear',
          bounds: 'data',
          afterBuildTicks(scale) {
            if (globalThis.matchMedia('(width < 640px)').matches)
              scale.ticks = mobileYearTicks(props.series).map((value) => ({
                value,
              }))
          },
          grid: { display: false },
          border: { display: false },
          title: { display: true, text: '年', align: 'end' },
          ticks: {
            precision: 0,
            maxRotation: 0,
            autoSkip: true,
            callback: (value) => `${value}`,
          },
        },
        y: {
          beginAtZero: true,
          border: { display: false },
          grid: { color: token('--color-border-default') },
          ticks: {
            maxTicksLimit: 5,
            callback: (value) => Number(value) / 10000,
          },
        },
      },
    },
  })
}
onMounted(() => {
  mounted = true
  syncChart()
})
watch(
  () => [props.series, props.category],
  () => {
    if (mounted) syncChart()
  },
  { deep: true, flush: 'post' },
)
onBeforeUnmount(() => {
  mounted = false
  destroy()
})
</script>

<template>
  <StatusMessage
    v-if="!series.length"
    state="empty"
    title="都道府県を選択すると、人口の推移を確認できます"
    description="比較したい都道府県にチェックを入れると、人口の推移を表示します。"
  />
  <figure v-else class="population-chart">
    <ul class="chart-legend" aria-label="都道府県の凡例">
      <li v-for="entry in legends" :key="entry.prefCode">
        <svg
          width="24"
          height="16"
          viewBox="0 0 24 16"
          aria-hidden="true"
          :style="{
            color: `var(${seriesColorTokens[entry.style.colorIndex]})`,
          }"
        >
          <line
            x1="0"
            y1="8"
            x2="24"
            y2="8"
            stroke="currentColor"
            stroke-width="2"
          />
          <circle cx="12" cy="8" r="3" fill="currentColor" />
        </svg>
        {{ entry.prefName }}
      </li>
    </ul>
    <p class="axis-label">人口数（万人）</p>
    <div class="chart-plot">
      <canvas
        ref="canvas"
        role="img"
        :aria-label="`${categoryLabel}の人口推移（${series.map((s) => s.prefName).join('、')}）`"
        :aria-describedby="descriptionId"
        >人口の年別値は下の表で確認できます。</canvas
      >
    </div>
    <figcaption :id="descriptionId" class="chart-description">
      {{ categoryLabel }}・{{
        series.length
      }}県の人口推移。横軸は年、縦軸は人口数（万人）。年別の人数は「人口データを表で確認」から確認できます。
    </figcaption>
    <details class="chart-data">
      <summary>人口データを表で確認（{{ categoryLabel }}）</summary>
      <table v-for="entry in series" :key="entry.prefCode">
        <caption>
          {{
            entry.prefName
          }}・{{
            categoryLabel
          }}（人数）
        </caption>
        <thead>
          <tr>
            <th scope="col">年</th>
            <th scope="col">人口数</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="point in entry.data" :key="point.year">
            <th scope="row">{{ point.year }}年</th>
            <td>{{ formatPeople(point.value) }}</td>
          </tr>
        </tbody>
      </table>
    </details>
  </figure>
</template>

<style scoped>
.population-chart {
  display: grid;
  gap: var(--space-20);
  min-width: 0;
}

.chart-legend {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-8) var(--space-16);
  margin: 0;
  padding: 0;
  list-style: none;
  font: var(--font-caption);
}

.chart-legend li {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  min-width: 112px;
  min-height: 24px;
}

.chart-legend svg {
  flex-shrink: 0;
}

.axis-label,
.chart-description {
  font: var(--font-caption);
  color: var(--color-text-secondary);
}

.chart-plot {
  position: relative;
  height: 344px;
  min-width: 0;
  font: var(--font-caption);
}

.chart-plot canvas {
  max-width: 100%;
}

.chart-data {
  padding: var(--space-12);
  border-radius: var(--radius-8);
  background-color: var(--color-bg-canvas);
}

.chart-data summary {
  cursor: pointer;
  min-height: 44px;
  align-content: center;
  font: var(--font-label);
}

.chart-data table {
  width: 100%;
  border-collapse: collapse;
  font: var(--font-caption);
}

.chart-data caption {
  text-align: start;
  font: var(--font-label);
  padding-block: var(--space-12);
}

.chart-data th,
.chart-data td {
  text-align: start;
  padding: var(--space-8);
  border-bottom: var(--stroke-1) solid var(--color-border-default);
}

.chart-data td {
  text-align: end;
}

@media (width < 640px) {
  .chart-plot {
    height: 266px;
  }

  .chart-legend {
    column-gap: var(--space-0);
  }

  .chart-legend li {
    min-width: 106px;
  }
}
</style>
