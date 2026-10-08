<script setup lang="ts">
import Button from '../shared/Button.vue'
import Checkbox from '../shared/Checkbox.vue'
import CheckboxSkeleton from '../shared/CheckboxSkeleton.vue'
import StatusMessage from '../shared/StatusMessage.vue'
import { prefectureFailure, type Prefecture } from './prefectureApi'
import { PREFECTURE_COUNT } from './prefectureCode'

withDefaults(
  defineProps<{
    prefectures: readonly Prefecture[]
    selectedCodes: ReadonlySet<number>
    status?: 'loading' | 'error' | 'ready'
  }>(),
  { status: 'ready' },
)
const emit = defineEmits<{
  select: [code: number, checked: boolean]
  retry: []
}>()
</script>

<template>
  <fieldset class="prefecture-checklist">
    <legend class="visually-hidden">比較する都道府県（複数選択可）</legend>
    <div v-if="status === 'ready'" class="prefecture-grid">
      <Checkbox
        v-for="prefecture in prefectures"
        :key="prefecture.prefCode"
        :label="prefecture.prefName"
        :model-value="selectedCodes.has(prefecture.prefCode)"
        @update:model-value="emit('select', prefecture.prefCode, $event)"
      />
    </div>
    <template v-else-if="status === 'loading'">
      <p role="status" class="loading-status">
        都道府県一覧を読み込んでいます…
      </p>
      <div class="loading-list" aria-busy="true">
        <div class="prefecture-grid" aria-hidden="true">
          <CheckboxSkeleton v-for="item in PREFECTURE_COUNT" :key="item" />
        </div>
      </div>
    </template>
    <StatusMessage
      v-else
      state="error"
      :title="prefectureFailure"
      description="接続を確認して、もう一度お試しください。"
    >
      <template #action
        ><Button label="再読み込み" @click="emit('retry')"
      /></template>
    </StatusMessage>
  </fieldset>
</template>

<style scoped>
.prefecture-checklist {
  min-width: 0;
  padding: 0;
  margin: 0;
  border: 0;
}

.prefecture-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4);
}

.prefecture-grid > * {
  min-width: 0;
  width: 100%;
}

.loading-status {
  margin-block-end: var(--space-20);
  color: var(--color-text-secondary);
}

.loading-list {
  color: var(--color-text-secondary);
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}

@container (min-width: 310px) {
  .prefecture-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@container (min-width: 600px) {
  .prefecture-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    column-gap: var(--space-8);
  }
}

@container (min-width: 1100px) {
  .prefecture-grid {
    grid-template-columns: repeat(8, minmax(0, 1fr));
  }
}
</style>
