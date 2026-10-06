<script setup lang="ts">
import SingleSelectGroup from '../../shared/ui/SingleSelectGroup.vue'
import Button from '../../shared/ui/Button.vue'
import {
  populationCategories,
  type SelectedPrefecture,
  type PopulationSeries,
  type PopulationCategory,
} from './populationApi'
import { usePopulationData, type PopulationLoader } from './usePopulationData'
import emptyIcon from './assets/empty.svg'
import loadingIcon from './assets/loading.svg'
import errorIcon from './assets/error.svg'
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
</script>

<template>
  <div class="population-data">
    <SingleSelectGroup
      v-model="category"
      :options="populationCategories"
      label="人口区分"
    />
    <div
      v-if="status !== 'ready'"
      class="population-status"
      :class="status"
      :role="status === 'error' ? 'alert' : 'status'"
      :aria-busy="status === 'loading'"
    >
      <div class="status-symbol">
        <img
          :src="
            status === 'empty'
              ? emptyIcon
              : status === 'loading'
                ? loadingIcon
                : errorIcon
          "
          alt=""
          width="24"
          height="24"
        />
      </div>
      <p class="status-title">
        {{
          status === 'empty'
            ? '都道府県を選択すると、人口の推移を確認できます'
            : status === 'loading'
              ? '人口データを読み込み中…'
              : 'データを取得できませんでした'
        }}
      </p>
      <p class="status-description">
        {{
          status === 'empty'
            ? '比較したい都道府県にチェックを入れると、人口の推移を表示します。'
            : status === 'loading'
              ? '選択内容はそのままに、しばらくお待ちください。'
              : '接続を確認して、もう一度お試しください。選択内容は保持されています。'
        }}
      </p>
      <Button v-if="status === 'error'" label="再読み込み" @click="retry" />
    </div>
    <slot
      v-if="series.length"
      :series="series"
      :category="category"
      :status="status"
    />
  </div>
</template>

<style scoped>
.population-data {
  display: grid;
  gap: var(--space-20);
  min-width: 0;
}

.population-status {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-16);
  min-height: 300px;
  padding: var(--space-24);
  text-align: center;
}

.status-symbol {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  background: var(--color-bg-canvas);
  border-radius: var(--radius-12);
}

.status-title {
  max-width: 25rem;
  font: var(--font-label);
}

.status-description {
  max-width: 25rem;
  color: var(--color-text-secondary);
}

.error .status-symbol {
  background: var(--color-status-error-bg);
}

.error .status-title {
  color: var(--color-status-error);
}

.loading img {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .loading img {
    animation: none;
  }
}
</style>
