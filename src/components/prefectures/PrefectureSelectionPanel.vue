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
import CheckboxSkeleton from '../shared/CheckboxSkeleton.vue'
import StatusMessage from '../shared/StatusMessage.vue'
import Button from '../shared/Button.vue'
import PrefectureSelector from './PrefectureSelector.vue'
import PrefectureSelectionSheet from './PrefectureSelectionSheet.vue'
import { prefectureFailure, type Prefecture } from './prefectureApi'
import { usePrefectures, type PrefectureLoader } from './usePrefectures'
const props = withDefaults(
  defineProps<{
    headingId?: string
    modelValue: readonly Prefecture[]
    loader?: PrefectureLoader
    isMobile?: boolean
  }>(),
  { headingId: undefined, loader: undefined, isMobile: undefined },
)
const emit = defineEmits<{
  'update:modelValue': [prefectures: Prefecture[]]
  'control-height': [height: number]
}>()
const { prefectures, status, retry } = usePrefectures(props.loader)
const codes = computed(() => props.modelValue.map((p) => p.prefCode))
const sheetOpen = ref(false)
const inline = useTemplateRef<HTMLElement>('inline')
const control = useTemplateRef<HTMLElement>('control')
let observer: ResizeObserver | undefined
let lastFocused: EventTarget | null = null
function rememberFocus(event: FocusEvent) {
  lastFocused = event.target
}
onMounted(() => {
  document.addEventListener('focusin', rememberFocus)
  if (typeof ResizeObserver === 'undefined' || !control.value) return
  observer = new ResizeObserver(() => {
    const height = control.value?.getBoundingClientRect().height
    if (height) emit('control-height', height)
  })
  observer.observe(control.value)
})
onScopeDispose(() => {
  observer?.disconnect()
  document.removeEventListener('focusin', rememberFocus)
})
watch(
  () => props.isMobile,
  async (value) => {
    const focused =
      document.activeElement === document.body
        ? lastFocused
        : document.activeElement
    const fromInline =
      focused instanceof Node && inline.value?.contains(focused)
    const fromControl =
      focused instanceof Node && control.value?.contains(focused)
    if (value === false && sheetOpen.value) {
      sheetOpen.value = false
      return
    }
    await nextTick()
    if (value && fromInline)
      control.value?.querySelector('button')?.focus({ preventScroll: true })
    else if (value === false && fromControl) focusInline()
  },
)
async function focusInline() {
  await nextTick()
  if (props.isMobile === false) {
    const target =
      inline.value?.querySelector<HTMLElement>('input[type="checkbox"]') ??
      Array.from(
        inline.value?.querySelectorAll<HTMLElement>('button:not(:disabled)') ??
          [],
      ).find((button) => button.getClientRects().length) ??
      inline.value
    target?.focus()
  }
}
function openSheet(event: MouseEvent) {
  if (event.detail > 1) return
  sheetOpen.value = true
}
function update(codes: number[]) {
  const selected = new Set(codes)
  emit(
    'update:modelValue',
    prefectures.value.filter((p) => selected.has(p.prefCode)),
  )
}
</script>
<template>
  <div
    ref="inline"
    tabindex="-1"
    class="inline-control"
    :class="{ 'is-hidden': isMobile }"
  >
    <PrefectureSelector
      :heading-id="headingId"
      :prefectures="prefectures"
      :model-value="codes"
      :status="status"
      :mobile="isMobile"
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
  </div>
  <Teleport to="body"
    ><div
      ref="control"
      class="floating-control"
      :class="{ 'is-hidden': !isMobile }"
      :inert="!isMobile"
      :aria-hidden="!isMobile"
    >
      <Button
        :label="`都道府県を選択 · ${codes.length} 選択中`"
        aria-haspopup="dialog"
        :aria-expanded="sheetOpen"
        @click="openSheet"
      /></div
  ></Teleport>
  <PrefectureSelectionSheet
    v-model="sheetOpen"
    :prefectures="prefectures"
    :selected-codes="codes"
    :status="status"
    @apply="update"
    @retry="retry"
    @closed="focusInline"
  />
</template>
<style scoped>
.inline-control.is-hidden {
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
