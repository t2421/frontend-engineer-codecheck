<script setup lang="ts">
import SingleSelectGroup from '../../shared/ui/SingleSelectGroup.vue'
import Button from '../../shared/ui/Button.vue'
import StatusMessage from '../../shared/ui/StatusMessage.vue'
import PopulationChart from './PopulationChart.vue'
import {
  populationCategories,
  type SelectedPrefecture,
  type PopulationSeries,
  type PopulationCategory,
} from './populationApi'
import { usePopulationData, type PopulationLoader } from './usePopulationData'
const props = defineProps<{
  selectedPrefectures: readonly SelectedPrefecture[]
  loader?: PopulationLoader
}>()
defineSlots<{
  default(props: {
    series: readonly PopulationSeries[]
    category: PopulationCategory
    status: 'empty' | 'loading' | 'error' | 'ready'
  }): unknown
}>()
const { category, status, series, retry } = usePopulationData(
  () => props.selectedPrefectures,
  props.loader,
)
const statusCopy = {
  empty: {
    title: '都道府県を選択すると、人口の推移を確認できます',
    description:
      '比較したい都道府県にチェックを入れると、人口の推移を表示します。',
  },
  loading: {
    title: '人口データを読み込み中…',
    description: '選択内容はそのままに、しばらくお待ちください。',
  },
  error: {
    title: 'データを取得できませんでした',
    description:
      '接続を確認して、もう一度お試しください。選択内容は保持されています。',
  },
}
</script>

<template>
  <div class="population-data">
    <SingleSelectGroup
      v-model="category"
      :options="populationCategories"
      label="人口区分"
    />
    <StatusMessage
      v-if="status !== 'ready'"
      :state="status"
      :title="statusCopy[status].title"
      :description="statusCopy[status].description"
    >
      <template v-if="status === 'error'" #action>
        <Button label="再読み込み" @click="retry" />
      </template>
    </StatusMessage>
    <slot
      v-if="series.length"
      :series="series"
      :category="category"
      :status="status"
    >
      <PopulationChart :series="series" :category="category" />
    </slot>
  </div>
</template>

<style scoped>
.population-data {
  display: grid;
  gap: var(--space-20);
  min-width: 0;
}
</style>
