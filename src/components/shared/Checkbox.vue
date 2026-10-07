<script setup lang="ts">
import checkIcon from './assets/check.svg'

defineOptions({ name: 'SharedCheckbox' })

const props = withDefaults(
  defineProps<{ label: string; modelValue: boolean; disabled?: boolean }>(),
  { disabled: false },
)
// `change` は v-model を使わない呼び出し元（カウンタ・ログ等）向け。値は `update:modelValue` と同一。
const emit = defineEmits<{
  'update:modelValue': [checked: boolean]
  change: [checked: boolean]
}>()

function onChange(event: Event) {
  if (props.disabled) return
  const checked = (event.target as HTMLInputElement).checked
  emit('update:modelValue', checked)
  emit('change', checked)
}
</script>

<template>
  <label
    class="checkbox"
    :class="{ 'is-selected': modelValue, 'is-disabled': disabled }"
  >
    <input
      class="checkbox-input"
      type="checkbox"
      :checked="modelValue"
      :disabled="disabled"
      @change="onChange"
    />
    <span class="checkbox-control" aria-hidden="true">
      <img v-if="modelValue" :src="checkIcon" alt="" />
    </span>
    <span class="checkbox-label">{{ label }}</span>
  </label>
</template>

<style scoped>
.checkbox {
  position: relative;
  display: inline-flex;
  gap: var(--space-8);
  align-items: center;
  min-width: 136px;
  min-height: 44px;
  padding: var(--space-8);
  font: var(--font-label);
  color: var(--color-text-primary);
  border-radius: var(--radius-8);
  cursor: pointer;
}

.checkbox-input {
  position: absolute;
  top: 50%;
  left: var(--space-8);
  width: 20px;
  height: 20px;
  margin: 0;
  opacity: 0;
  transform: translateY(-50%);
  cursor: inherit;
}

.checkbox-control {
  position: relative;
  flex: 0 0 20px;
  width: 20px;
  height: 20px;
  overflow: hidden;
  background: var(--color-bg-surface);
  border: var(--stroke-1) solid var(--color-border-strong);
  border-radius: var(--radius-4);
  pointer-events: none;
}

.checkbox-control img {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.checkbox-label {
  overflow-wrap: anywhere;
}

.is-selected {
  background: var(--color-action-subtle);
}

.is-selected .checkbox-control {
  background: var(--color-action-default);
  border-color: var(--color-action-default);
}

.checkbox:has(.checkbox-input:focus-visible) {
  box-shadow: inset 0 0 0 var(--stroke-2) var(--color-focus);
}

.is-disabled {
  color: var(--color-disabled-text);
  cursor: default;
}

.is-disabled .checkbox-control {
  background: var(--color-disabled-bg);
  border-color: var(--color-border-strong);
}

@media (forced-colors: active) {
  .checkbox-input {
    position: static;
    flex: 0 0 20px;
    width: 20px;
    height: 20px;
    opacity: 1;
    transform: none;
  }

  .checkbox-control {
    display: none;
  }
}
</style>
