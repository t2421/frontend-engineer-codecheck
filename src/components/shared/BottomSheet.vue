<script setup lang="ts">
import {
  nextTick,
  onMounted,
  onScopeDispose,
  useId,
  useTemplateRef,
  watch,
} from 'vue'
import Button from './Button.vue'
import { isRendered } from '../../utils/dom'
import { isRepeatedClick } from '../../utils/repeatedClick'

const FOCUSABLE_SELECTOR =
  'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]'

defineProps<{ title: string }>()
const emit = defineEmits<{ closed: [] }>()
const open = defineModel<boolean>({ default: false })
const dialog = useTemplateRef<HTMLDialogElement>('dialog')
const titleId = useId()
let leaveModal: (() => void) | undefined

function lockPageScroll() {
  const { scrollX, scrollY } = window
  const body = document.body
  const previousStyle = {
    position: body.style.position,
    top: body.style.top,
    width: body.style.width,
    overflow: body.style.overflow,
  }
  Object.assign(body.style, {
    position: 'fixed',
    top: `-${scrollY}px`,
    width: '100%',
    overflow: 'hidden',
  })
  return function unlockPageScroll() {
    Object.assign(body.style, previousStyle)
    window.scrollTo({ left: scrollX, top: scrollY, behavior: 'instant' })
  }
}

function rememberFocus() {
  const trigger = document.activeElement
  return function restoreFocus() {
    if (trigger instanceof HTMLElement && trigger.isConnected)
      trigger.focus({ preventScroll: true })
  }
}

function enterModal() {
  if (leaveModal || !dialog.value) return
  const unlockPageScroll = lockPageScroll()
  const restoreFocus = rememberFocus()
  dialog.value.showModal()
  leaveModal = () => {
    if (dialog.value?.open) dialog.value.close()
    unlockPageScroll()
    restoreFocus()
  }
}

function closeSheet() {
  if (!leaveModal) return
  leaveModal()
  leaveModal = undefined
  emit('closed')
}

async function closeSheetAfterPageUpdates() {
  await nextTick()
  if (!open.value) closeSheet()
}

watch(open, (value) => (value ? enterModal() : closeSheetAfterPageUpdates()), {
  flush: 'post',
})
onMounted(() => {
  if (open.value) enterModal()
})
onScopeDispose(closeSheet)

function closeOnBackdropClick(event: MouseEvent) {
  if (!isRepeatedClick(event)) open.value = false
}

function visibleControls(): HTMLElement[] {
  const controls =
    dialog.value?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
  return Array.from(controls ?? []).filter(isRendered)
}

function keepTabInsideSheet(event: KeyboardEvent) {
  const controls = visibleControls()
  const first = controls[0]
  const last = controls.at(-1)
  const edgeControl = event.shiftKey ? first : last
  const wrapTo = event.shiftKey ? last : first
  if (document.activeElement !== edgeControl || !wrapTo) return
  event.preventDefault()
  wrapTo.focus()
}
</script>

<template>
  <Teleport to="body">
    <dialog
      ref="dialog"
      class="sheet-dialog"
      :aria-labelledby="titleId"
      aria-modal="true"
      @cancel.prevent="open = false"
      @click.self="closeOnBackdropClick"
      @keydown.tab="keepTabInsideSheet"
    >
      <div class="sheet-surface">
        <div class="sheet-handle" aria-hidden="true" />
        <div class="sheet-heading">
          <h2 :id="titleId">{{ title }}</h2>
          <Button
            class="sheet-close"
            label="閉じる"
            variant="secondary"
            autofocus
            @click="open = false"
          />
        </div>
        <div class="sheet-content"><slot v-if="open" /></div>
      </div>
    </dialog>
  </Teleport>
</template>

<style scoped>
.sheet-dialog {
  position: fixed;
  inset: 0;
  width: 100%;
  max-width: none;
  height: 100%;
  max-height: none;
  margin: 0;
  padding: 0;
  color: var(--color-text-primary);
  background: transparent;
  border: 0;
}

.sheet-dialog::backdrop {
  background: color-mix(in srgb, var(--color-text-primary) 36%, transparent);
}

.sheet-surface {
  position: absolute;
  inset-inline: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  height: 80dvh;
  max-height: calc(100dvh - env(safe-area-inset-top) - var(--space-16));
  padding-block-start: var(--space-24);
  background: var(--color-bg-surface);
  border-radius: var(--space-16) var(--space-16) 0 0;
}

.sheet-handle {
  position: absolute;
  top: var(--space-8);
  left: 50%;
  width: calc(var(--space-32) + var(--space-4));
  height: var(--space-4);
  background: var(--color-border-strong);
  border-radius: var(--radius-4);
  transform: translateX(-50%);
}

.sheet-heading {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-8);
  padding-inline: var(--space-16);
}

.sheet-heading h2 {
  font: var(--font-section);
}

.sheet-close {
  min-width: auto;
}

.sheet-content {
  flex: 1;
  min-height: 0;
}
</style>
