<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import BottomSheet from '../shared/BottomSheet.vue'
import Button from '../shared/Button.vue'
import PrefectureChecklist from './PrefectureChecklist.vue'
import type { Prefecture } from './prefectureApi'

const props = defineProps<{
  prefectures: readonly Prefecture[]
  selectedCodes: readonly number[]
  status: 'loading' | 'error' | 'ready'
}>()
const open = defineModel<boolean>({ default: false })
const emit = defineEmits<{ apply: [codes: number[]]; retry: []; closed: [] }>()
const draftCodes = ref<ReadonlySet<number>>(new Set())
watch(
  open,
  (isOpen) => {
    if (isOpen) draftCodes.value = new Set(props.selectedCodes)
  },
  { immediate: true },
)
const draftPrefectures = computed(() =>
  props.prefectures.filter((prefecture) =>
    draftCodes.value.has(prefecture.prefCode),
  ),
)
const draftNames = computed(() =>
  draftPrefectures.value.map((prefecture) => prefecture.prefName).join('、'),
)
function toggleDraft(code: number, checked: boolean) {
  const next = new Set(draftCodes.value)
  if (checked) next.add(code)
  else next.delete(code)
  draftCodes.value = next
}
function applyDraft() {
  if (!open.value) return
  emit(
    'apply',
    draftPrefectures.value.map((prefecture) => prefecture.prefCode),
  )
  open.value = false
}
</script>

<template>
  <BottomSheet v-model="open" title="都道府県を選択" @closed="emit('closed')">
    <div class="selection-sheet">
      <div class="selection-summary">
        <p v-if="status === 'ready'" class="selection-count" role="status">
          {{ draftCodes.size }} / {{ prefectures.length }} 選択中
        </p>
        <p class="selected-names">
          {{ draftNames || '都道府県は未選択です' }}
        </p>
      </div>
      <div class="selection-list">
        <PrefectureChecklist
          :prefectures="prefectures"
          :selected-codes="draftCodes"
          :status="status"
          @select="toggleDraft"
          @retry="emit('retry')"
        />
      </div>
      <div class="selection-actions">
        <p>一覧は上下にスクロールできます</p>
        <Button
          :label="`${draftCodes.size} 都道府県をグラフに反映`"
          :disabled="status !== 'ready'"
          @click="applyDraft"
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
</style>
