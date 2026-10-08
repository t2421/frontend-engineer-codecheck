<script setup lang="ts">
import '../../styles/control-label.css'
import { isRepeatedClick } from '../../utils/repeatedClick'
defineOptions({ name: 'SharedButton' })

const props = withDefaults(
  defineProps<{
    label: string
    disabled?: boolean
    type?: 'button' | 'submit' | 'reset'
    variant?: 'primary' | 'secondary'
  }>(),
  { disabled: false, type: 'button', variant: 'primary' },
)

const emit = defineEmits<{ click: [event: MouseEvent] }>()

function handleClick(event: MouseEvent) {
  if (props.disabled || isRepeatedClick(event)) return
  emit('click', event)
}
</script>

<template>
  <button
    class="button control-label"
    :class="`button-${variant}`"
    :type="type"
    :disabled="disabled"
    @click="handleClick"
  >
    {{ label }}
  </button>
</template>

<style scoped>
.button {
  display: inline-flex;
  min-width: min(136px, 100%);
  max-width: 100%;
  min-height: 44px;
  padding: var(--space-8) var(--space-12);
  border: 0;
  cursor: pointer;
}

.button-primary {
  color: var(--color-text-inverse);
  background-color: var(--color-action-default);
}

.button-primary:hover:not(:disabled) {
  background-color: var(--color-action-hover);
}

.button-secondary {
  color: var(--color-action-default);
  background-color: var(--color-bg-surface);
  border: var(--stroke-1) solid var(--color-border-default);
}

.button-secondary:hover:not(:disabled) {
  background-color: var(--color-action-subtle);
}

.button:disabled {
  color: var(--color-disabled-text);
  background-color: var(--color-disabled-bg);
  cursor: not-allowed;
}
</style>
