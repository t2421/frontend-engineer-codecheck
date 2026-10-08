<script setup lang="ts">
import { computed, nextTick, ref, useId, useTemplateRef, watch } from 'vue'
import Button from '../shared/Button.vue'
import { isRendered } from '../../utils/dom'
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
watch(() => props.mobile, keepFocusVisibleAfterLayoutChange)
function firstControlOfCurrentLayout(): HTMLElement | null | undefined {
  const selectorForLayout = props.mobile
    ? '.toggle-list'
    : 'input[type="checkbox"]'
  return selector.value?.querySelector<HTMLElement>(selectorForLayout)
}
async function keepFocusVisibleAfterLayoutChange() {
  const focusedBefore = document.activeElement
  const wasFocusInside =
    focusedBefore instanceof HTMLElement &&
    Boolean(selector.value?.contains(focusedBefore))
  if (!wasFocusInside) return
  await nextTick()
  if (isRendered(focusedBefore)) return
  const focusMovedElsewhere =
    document.activeElement !== focusedBefore &&
    document.activeElement !== document.body
  if (focusMovedElsewhere) return
  firstControlOfCurrentLayout()?.focus()
}
const listId = useId()
const selected = computed(() => new Set(props.modelValue))
const hasSelection = computed(() => props.modelValue.length > 0)
const showsSelectionCount = computed(
  () => !props.status || props.status === 'ready',
)
function clearSelection() {
  emit('update:modelValue', [])
}
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
function codesInListOrder(codes: ReadonlySet<number>): number[] {
  return props.prefectures
    .filter((prefecture) => codes.has(prefecture.prefCode))
    .map((prefecture) => prefecture.prefCode)
}
function toggleSelection(code: number, checked: boolean) {
  const next = new Set(props.modelValue)
  if (checked) next.add(code)
  else next.delete(code)
  emit('update:modelValue', codesInListOrder(next))
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
        v-if="showsSelectionCount"
        class="selection-count"
        role="status"
        aria-label="選択件数"
      >
        {{ modelValue.length }} / {{ prefectures.length }} 選択中
      </p>
      <Button
        class="desktop-clear"
        label="選択を解除"
        :disabled="!hasSelection"
        @click="clearSelection"
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
      @select="toggleSelection"
      @retry="emit('retry')"
    />
    <div class="selector-actions">
      <Button
        label="選択を解除"
        :disabled="!hasSelection"
        @click="clearSelection"
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
