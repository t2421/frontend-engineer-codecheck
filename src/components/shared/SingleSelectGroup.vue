<script setup lang="ts" generic="T extends string | number">
import './control-label.css'
import { useId } from 'vue'

// Values must be unique; modelValue must be one of the provided values.
// label names the group for assistive technology; each option label names its radio.
defineProps<{
  options: readonly { value: T; label: string }[]
  modelValue: T
  label: string
}>()
const emit = defineEmits<{ 'update:modelValue': [value: T] }>()
const name = `single-select-${useId()}`
</script>

<template>
  <div class="single-select" role="radiogroup" :aria-label="label">
    <label v-for="option in options" :key="option.value" class="option">
      <input
        type="radio"
        :name="name"
        :value="option.value"
        :checked="modelValue === option.value"
        @change="emit('update:modelValue', option.value)"
      />
      <span class="option-label control-label">{{ option.label }}</span>
    </label>
  </div>
</template>

<style scoped>
.single-select {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 9rem), 1fr));
  gap: var(--space-4);
  width: 100%;
  max-width: 37.5rem;
  padding: var(--space-4);
  background: var(--color-bg-canvas);
  border-radius: var(--radius-12);
}

.option {
  position: relative;
  min-width: 0;
  cursor: pointer;
}

.option input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  opacity: 0;
  cursor: inherit;
}

.option-label {
  display: flex;
  min-height: 2.75rem;
  height: 100%;
  padding: var(--space-8);
  color: var(--color-text-secondary);
  background: var(--color-bg-surface);
}

.option input:checked + .option-label {
  color: var(--color-text-inverse);
  background: var(--color-action-default);
}

.option input:focus-visible + .option-label {
  outline: var(--focus-ring-width) solid var(--color-focus);
  outline-offset: var(--focus-ring-offset);
}
</style>
