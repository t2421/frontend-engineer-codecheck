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
  <PrefectureSelector
    :heading-id="headingId"
    :prefectures="prefectures"
    :model-value="codes"
    :status="status"
    @update:model-value="update"
  >
    <template v-if="status !== 'ready'" #list>
      <!-- 読み上げ領域はbusy領域の外に置き、読み込み中の通知が抑止されないようにする。 -->
      <p v-if="status === 'loading'" role="status" class="loading-status">
        都道府県一覧を読み込んでいます…
      </p>
      <div v-if="status === 'loading'" class="loading-list" aria-busy="true">
        <div class="loading-grid" aria-hidden="true">
          <CheckboxSkeleton v-for="item in 47" :key="item" />
        </div>
      </div>
      <StatusMessage
        v-else
        state="error"
        :title="prefectureFailure"
        description="接続を確認して、もう一度お試しください。"
      >
        <template #action
          ><Button label="再読み込み" @click="retry"
        /></template>
      </StatusMessage>
    </template>
  </PrefectureSelector>
</template>
<style scoped>
.loading-status {
  margin-block-end: var(--space-20);
  color: var(--color-text-secondary);
}

.loading-list {
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
