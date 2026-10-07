<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import BottomSheet from '../shared/BottomSheet.vue'
import Button from '../shared/Button.vue'
import Checkbox from '../shared/Checkbox.vue'
import CheckboxSkeleton from '../shared/CheckboxSkeleton.vue'
import StatusMessage from '../shared/StatusMessage.vue'
import { prefectureFailure, type Prefecture } from './prefectureApi'

const props = defineProps<{
  prefectures: readonly Prefecture[]
  selectedCodes: readonly number[]
  status: 'loading' | 'error' | 'ready'
}>()
const open = defineModel<boolean>({ default: false })
const emit = defineEmits<{ apply: [codes: number[]]; retry: []; closed: [] }>()
const draft = ref(new Set<number>())
watch(
  open,
  (value) => {
    if (value) draft.value = new Set(props.selectedCodes)
  },
  { immediate: true },
)
const selectedNames = computed(() =>
  props.prefectures
    .filter((prefecture) => draft.value.has(prefecture.prefCode))
    .map((prefecture) => prefecture.prefName)
    .join('、'),
)
function select(code: number, checked: boolean) {
  if (checked) draft.value.add(code)
  else draft.value.delete(code)
}
function apply(event: MouseEvent) {
  if (!open.value || props.status !== 'ready' || event.detail > 1) return
  emit(
    'apply',
    props.prefectures
      .filter((prefecture) => draft.value.has(prefecture.prefCode))
      .map((prefecture) => prefecture.prefCode),
  )
  open.value = false
}
</script>

<template>
  <BottomSheet v-model="open" title="都道府県を選択" @closed="emit('closed')">
    <div class="selection-sheet">
      <div class="selection-summary">
        <p v-if="status === 'ready'" class="selection-count" role="status">
          {{ draft.size }} / {{ prefectures.length }} 選択中
        </p>
        <p v-else-if="status === 'loading'" role="status">
          都道府県一覧を読み込んでいます…
        </p>
        <p class="selected-names">
          {{ selectedNames || '都道府県は未選択です' }}
        </p>
      </div>
      <div class="selection-list">
        <fieldset v-if="status === 'ready'" class="prefecture-grid">
          <legend class="visually-hidden">
            比較する都道府県（複数選択可）
          </legend>
          <Checkbox
            v-for="prefecture in prefectures"
            :key="prefecture.prefCode"
            :label="prefecture.prefName"
            :model-value="draft.has(prefecture.prefCode)"
            @update:model-value="select(prefecture.prefCode, $event)"
          />
        </fieldset>
        <div v-else-if="status === 'loading'" aria-busy="true">
          <div class="prefecture-grid" aria-hidden="true">
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
            ><Button label="再読み込み" @click="emit('retry')"
          /></template>
        </StatusMessage>
      </div>
      <div class="selection-actions">
        <p>一覧は上下にスクロールできます</p>
        <Button
          :label="`${draft.size} 都道府県をグラフに反映`"
          :disabled="status !== 'ready'"
          @click="apply"
        />
      </div>
    </div>
  </BottomSheet>
</template>

<style scoped>
.selection-sheet {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  gap: var(--space-12);
}

.selection-summary {
  flex-shrink: 0;
  display: grid;
  gap: var(--space-4);
  padding-inline: var(--space-16);
  font: var(--font-caption);
  color: var(--color-text-secondary);
}

.selection-count {
  font-weight: var(--font-weight-bold);
  color: var(--color-action-default);
}

.selected-names {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.selection-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior-y: contain;
  padding: var(--space-4) var(--space-16);
  container-type: inline-size;
}

.prefecture-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4);
  min-width: 0;
  padding: 0;
  margin: 0;
  border: 0;
}

.prefecture-grid > * {
  min-width: 0;
  width: 100%;
}

.selection-actions {
  display: grid;
  flex-shrink: 0;
  gap: var(--space-8);
  padding: var(--space-8) var(--space-16)
    calc(var(--space-20) + env(safe-area-inset-bottom));
  background: var(--color-bg-surface);
}

.selection-actions p {
  font: var(--font-caption);
  color: var(--color-text-secondary);
}

.selection-actions .button {
  /* Figmaの固定アクションは高さ52px。 */
  min-height: 52px;
  width: 100%;
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
</style>
