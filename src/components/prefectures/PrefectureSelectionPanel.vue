<script setup lang="ts">
import { computed } from 'vue'
import CheckboxSkeleton from '../shared/CheckboxSkeleton.vue'
import StatusMessage from '../shared/StatusMessage.vue'
import Button from '../shared/Button.vue'
import PrefectureSelector from './PrefectureSelector.vue'
import { prefectureFailure, type Prefecture } from './prefectureApi'
import { usePrefectures, type PrefectureLoader } from './usePrefectures'
const props = defineProps<{
  headingId?: string
  modelValue: readonly Prefecture[]
  loader?: PrefectureLoader
}>()
const emit = defineEmits<{ 'update:modelValue': [prefectures: Prefecture[]] }>()
const { prefectures, status, retry } = usePrefectures(props.loader)
const codes = computed(() => props.modelValue.map((p) => p.prefCode))
function update(codes: number[]) {
  const selected = new Set(codes)
  emit(
    'update:modelValue',
    prefectures.value.filter((p) => selected.has(p.prefCode)),
  )
}
</script>
<template>
  <h2 v-if="status !== 'ready'" :id="headingId" class="panel-title">
    都道府県
  </h2>
  <p v-if="status !== 'ready'" class="panel-description">
    比較したい都道府県を選択（複数選択可）
  </p>
  <div v-if="status === 'loading'" class="loading-list" aria-busy="true">
    <p role="status">都道府県一覧を読み込んでいます…</p>
    <div class="loading-grid" aria-hidden="true">
      <CheckboxSkeleton v-for="item in 47" :key="item" />
    </div>
  </div>
  <StatusMessage
    v-else-if="status === 'error'"
    state="error"
    :title="prefectureFailure"
    description="接続を確認して、もう一度お試しください。"
  >
    <template #action><Button label="再読み込み" @click="retry" /></template>
  </StatusMessage>
  <PrefectureSelector
    v-else
    :heading-id="headingId"
    :prefectures="prefectures"
    :model-value="codes"
    @update:model-value="update"
  />
</template>
<style scoped>
.panel-title {
  font: var(--font-section);
}

.panel-description {
  color: var(--color-text-secondary);
}

.loading-list {
  display: grid;
  gap: var(--space-16);
  color: var(--color-text-secondary);
  container-type: inline-size;
}

.loading-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4);
}

.loading-grid > * {
  width: 100%;
}

@container (min-width: 310px) {
  .loading-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@container (min-width: 600px) {
  .loading-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    column-gap: var(--space-8);
  }
}

@container (min-width: 1100px) {
  .loading-grid {
    grid-template-columns: repeat(8, minmax(0, 1fr));
  }
}
</style>
