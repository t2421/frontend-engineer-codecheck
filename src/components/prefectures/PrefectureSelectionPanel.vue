<script setup lang="ts">
import {
  computed,
  nextTick,
  onMounted,
  onScopeDispose,
  ref,
  useTemplateRef,
  watch,
} from 'vue'
import Button from '../shared/Button.vue'
import { isRendered } from '../../utils/dom'
import { useMobileViewport } from '../../composables/useMobileViewport'
import PrefectureSelector from './PrefectureSelector.vue'
import PrefectureSelectionSheet from './PrefectureSelectionSheet.vue'
import type { Prefecture } from './prefectureApi'
import {
  usePrefectures,
  type PrefectureLoader,
} from '../../composables/usePrefectures'
const props = defineProps<{
  headingId?: string
  modelValue: readonly Prefecture[]
  loader?: PrefectureLoader
  sheetOnMobile?: boolean
}>()
const emit = defineEmits<{
  'update:modelValue': [prefectures: Prefecture[]]
  'floating-control-height': [height: number]
}>()
const { prefectures, status, retry } = usePrefectures(props.loader)
const { isMobile } = useMobileViewport()
const sheetMode = computed(() => Boolean(props.sheetOnMobile) && isMobile.value)
const selectedCodes = computed(() =>
  props.modelValue.map((prefecture) => prefecture.prefCode),
)
const sheetOpen = ref(false)
const inlineList = useTemplateRef<HTMLElement>('inlineList')
const floatingControl = useTemplateRef<HTMLElement>('floatingControl')

let lastFocused: EventTarget | null = null
function trackLastFocused(event: FocusEvent) {
  lastFocused = event.target
}
function focusedBeforeLayoutChange(): Node | null {
  const active = document.activeElement
  const focused = active === document.body ? lastFocused : active
  return focused instanceof Node ? focused : null
}

let heightObserver: ResizeObserver | undefined
function reportFloatingControlHeight() {
  const height = floatingControl.value?.getBoundingClientRect().height
  if (height) emit('floating-control-height', height)
}
onMounted(() => {
  document.addEventListener('focusin', trackLastFocused)
  if (typeof ResizeObserver === 'undefined' || !floatingControl.value) return
  heightObserver = new ResizeObserver(reportFloatingControlHeight)
  heightObserver.observe(floatingControl.value)
})
onScopeDispose(() => {
  heightObserver?.disconnect()
  document.removeEventListener('focusin', trackLastFocused)
})

watch(sheetMode, async (entersSheetMode) => {
  const focused = focusedBeforeLayoutChange()
  const focusWasInline = Boolean(focused && inlineList.value?.contains(focused))
  const focusWasOnFloatingControl = Boolean(
    focused && floatingControl.value?.contains(focused),
  )
  if (!entersSheetMode && sheetOpen.value) {
    sheetOpen.value = false
    return
  }
  await nextTick()
  if (entersSheetMode && focusWasInline) focusFloatingControl()
  else if (!entersSheetMode && focusWasOnFloatingControl) focusInlineList()
})

function focusFloatingControl() {
  floatingControl.value?.querySelector('button')?.focus({ preventScroll: true })
}
function firstVisibleControl(list: HTMLElement): HTMLElement | undefined {
  const checkbox = list.querySelector<HTMLElement>('input[type="checkbox"]')
  if (checkbox) return checkbox
  const buttons = list.querySelectorAll<HTMLElement>('button:not(:disabled)')
  return Array.from(buttons).find(isRendered)
}
function focusInlineList() {
  const list = inlineList.value
  if (sheetMode.value || !list) return
  const target = firstVisibleControl(list) ?? list
  target.focus()
}
function applySelection(codes: number[]) {
  const selected = new Set(codes)
  emit(
    'update:modelValue',
    prefectures.value.filter((prefecture) => selected.has(prefecture.prefCode)),
  )
}
</script>
<template>
  <div
    ref="inlineList"
    tabindex="-1"
    class="inline-list"
    :class="{ 'is-hidden': sheetMode }"
  >
    <PrefectureSelector
      :heading-id="headingId"
      :prefectures="prefectures"
      :model-value="selectedCodes"
      :status="status"
      :mobile="isMobile"
      @update:model-value="applySelection"
      @retry="retry"
    />
  </div>
  <Teleport to="body">
    <div
      ref="floatingControl"
      class="floating-control"
      :class="{ 'is-hidden': !sheetMode }"
    >
      <Button
        :label="`都道府県を選択 · ${selectedCodes.length} 選択中`"
        aria-haspopup="dialog"
        :aria-expanded="sheetOpen"
        @click="sheetOpen = true"
      />
    </div>
  </Teleport>
  <PrefectureSelectionSheet
    v-model="sheetOpen"
    :prefectures="prefectures"
    :selected-codes="selectedCodes"
    :status="status"
    @apply="applySelection"
    @retry="retry"
    @closed="focusInlineList"
  />
</template>
<style scoped>
.inline-list.is-hidden {
  display: none;
}

.floating-control {
  position: fixed;
  z-index: 2;
  inset-inline: 0;
  bottom: 0;
  padding: var(--space-12) var(--space-16)
    calc(var(--space-12) + env(safe-area-inset-bottom));
  background: var(--color-bg-surface);
}

.floating-control .button {
  /* Figmaのフローティングボタンは高さ52px。 */
  min-height: 52px;
  width: 100%;
}

.floating-control.is-hidden {
  visibility: hidden;
  pointer-events: none;
}
</style>
