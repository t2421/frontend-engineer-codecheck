<script setup lang="ts">
import { nextTick, onScopeDispose, useId, useTemplateRef, watch } from 'vue'
import Button from './Button.vue'

defineProps<{ title: string }>()
const emit = defineEmits<{ closed: [] }>()
const open = defineModel<boolean>({ default: false })
const dialog = useTemplateRef<HTMLDialogElement>('dialog')
const titleId = useId()
let restorePage: (() => void) | undefined

function lockPage() {
  const { scrollX, scrollY } = window
  const body = document.body
  const previous = {
    position: body.style.position,
    top: body.style.top,
    width: body.style.width,
    overflow: body.style.overflow,
  }
  const trigger = document.activeElement
  Object.assign(body.style, {
    position: 'fixed',
    top: `-${scrollY}px`,
    width: '100%',
    overflow: 'hidden',
  })
  return () => {
    Object.assign(body.style, previous)
    window.scrollTo({ left: scrollX, top: scrollY, behavior: 'instant' })
    if (trigger instanceof HTMLElement && trigger.isConnected)
      trigger.focus({ preventScroll: true })
  }
}

function closeDialog() {
  const wasOpen = !!restorePage
  if (dialog.value?.open) dialog.value.close()
  restorePage?.()
  restorePage = undefined
  if (wasOpen) emit('closed')
}

watch(
  [open, dialog],
  async ([value]) => {
    if (value && dialog.value && !dialog.value.open) {
      restorePage = lockPage()
      dialog.value.showModal()
    } else if (!value) {
      await nextTick()
      if (!open.value) closeDialog()
    }
  },
  { flush: 'post', immediate: true },
)
onScopeDispose(closeDialog)

function trapFocus(event: KeyboardEvent) {
  const controls = Array.from(
    dialog.value?.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]',
    ) ?? [],
  ).filter((element) => element.getClientRects().length)
  const first = controls[0]
  const last = controls.at(-1)
  const target = event.shiftKey ? last : first
  if (document.activeElement === (event.shiftKey ? first : last) && target) {
    event.preventDefault()
    target.focus()
  }
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
      @click.self="open = false"
      @keydown.tab="trapFocus"
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
