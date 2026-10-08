<script setup lang="ts">
import { computed, nextTick, ref, useId, useTemplateRef, watch } from 'vue'
import Button from '../shared/Button.vue'
import PrefectureChecklist from './PrefectureChecklist.vue'
import type { Prefecture } from './prefectureApi'
const props = withDefaults(
  defineProps<{
    prefectures: readonly Prefecture[]
    headingId?: string
    modelValue: readonly number[]
    status?: 'loading' | 'error' | 'ready'
    mobile?: boolean
  }>(),
  { headingId: undefined, status: undefined, mobile: false },
)
const emit = defineEmits<{
  'update:modelValue': [codes: number[]]
  retry: []
}>()
const mobileExpanded = ref(false)
const expanded = computed(() => !props.mobile || mobileExpanded.value)
const selector = useTemplateRef<HTMLElement>('selector')
watch(() => props.mobile, moveFocusWhenResizeHidesIt)
async function moveFocusWhenResizeHidesIt() {
  const focused = document.activeElement
  if (!(focused instanceof HTMLElement) || !selector.value?.contains(focused))
    return
  await nextTick()
  if (focused.getClientRects().length) return
  const active = document.activeElement
  if (active !== focused && active !== document.body) return
  selector.value
    ?.querySelector<HTMLElement>(
      props.mobile ? '.toggle-list' : 'input[type="checkbox"]',
    )
    ?.focus()
}
const listId = useId()
const selected = computed(() => new Set(props.modelValue))
const selectionSummary = computed(() => {
  const selectedNames = props.prefectures
    .filter((prefecture) => selected.value.has(prefecture.prefCode))
    .map((prefecture) => prefecture.prefName)
    .join('、')

  if (selectedNames) return selectedNames
  if (props.status === 'loading') return '都道府県一覧を読み込んでいます…'
  if (props.status === 'error') return '都道府県一覧を取得できませんでした'
  return '都道府県は未選択です'
})
function select(code: number, checked: boolean) {
  const next = new Set(props.modelValue)
  if (checked) next.add(code)
  else next.delete(code)
  emit(
    'update:modelValue',
    props.prefectures
      .filter((p) => next.has(p.prefCode))
      .map((p) => p.prefCode),
  )
}
</script>
<template>
  <div
    ref="selector"
    class="prefecture-selector"
    :class="{ 'is-collapsed': !expanded, 'is-mobile': mobile }"
  >
    <div class="selector-heading">
      <h2 :id="headingId" class="selector-title">都道府県</h2>
      <p
        v-if="!status || status === 'ready'"
        class="selection-count"
        role="status"
        aria-label="選択件数"
      >
        {{ modelValue.length }} / {{ prefectures.length }} 選択中
      </p>
      <Button
        class="desktop-clear"
        label="選択を解除"
        :disabled="modelValue.length === 0"
        @click="emit('update:modelValue', [])"
      />
    </div>
    <p class="selector-description">比較したい都道府県を選択（複数選択可）</p>
    <p class="selection-summary">{{ selectionSummary }}</p>
    <PrefectureChecklist
      :id="listId"
      class="prefecture-list"
      :prefectures="prefectures"
      :selected-codes="selected"
      :status="status"
      @select="select"
      @retry="emit('retry')"
    />
    <div class="selector-actions">
      <Button
        label="選択を解除"
        :disabled="modelValue.length === 0"
        @click="emit('update:modelValue', [])"
      />
      <Button
        class="toggle-list"
        :label="expanded ? '閉じる' : '都道府県を選ぶ'"
        :aria-controls="listId"
        :aria-expanded="expanded"
        @click="mobileExpanded = !mobileExpanded"
      />
    </div>
  </div>
</template>
<style scoped>
.prefecture-selector {
  display: grid;
  gap: var(--space-16);
  container-type: inline-size;
}

.selector-heading {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-12);
  align-items: center;
  min-height: 44px;
}

.selector-title {
  font: var(--font-section);
}

.selector-description {
  color: var(--color-text-secondary);
}

.desktop-clear {
  margin-inline-start: auto;
}

.selection-count {
  width: fit-content;
  padding: var(--space-4);
  font: var(--font-small-label);
  color: var(--color-action-default);
  background: var(--color-action-subtle);
  border-radius: var(--radius-4);
}

.selection-summary {
  display: none;
  color: var(--color-text-secondary);
  overflow-wrap: anywhere;
}

.selector-actions {
  display: none;
  flex-wrap: wrap;
  gap: var(--space-12);
}

.toggle-list {
  display: none;
}

.is-mobile .selector-heading {
  min-height: var(--line-height-section);
}

.is-mobile .desktop-clear {
  display: none;
}

.is-mobile .selector-actions {
  display: flex;
}

.is-mobile.is-collapsed .selector-description {
  display: none;
}

.is-mobile .toggle-list {
  display: inline-flex;
}

.is-mobile .selector-actions > * {
  flex: 1;
  min-width: 0;
}

.is-mobile.is-collapsed .prefecture-list {
  display: none;
}

.is-mobile.is-collapsed .selection-summary {
  display: block;
}

.is-mobile.is-collapsed .selector-actions > :first-child {
  display: none;
}
</style>
