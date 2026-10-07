<script setup lang="ts">
import './control-label.css'
defineOptions({ name: 'SharedButton' })

const props = withDefaults(
  defineProps<{
    label: string
    disabled?: boolean
    type?: 'button' | 'submit' | 'reset'
  }>(),
  { disabled: false, type: 'button' },
)

const emit = defineEmits<{ click: [event: globalThis.MouseEvent] }>()

function handleClick(event: globalThis.MouseEvent) {
  if (!props.disabled) emit('click', event)
}
</script>

<template>
  <button
    class="button button-primary control-label"
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

.button:disabled {
  color: var(--color-disabled-text);
  background-color: var(--color-disabled-bg);
  cursor: not-allowed;
}
</style>
