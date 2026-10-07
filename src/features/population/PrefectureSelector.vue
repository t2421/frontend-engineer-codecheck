<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import Checkbox from '../../shared/ui/Checkbox.vue'
import Button from '../../shared/ui/Button.vue'
import type { Prefecture } from './prefectureApi'
const props = defineProps<{
  prefectures: readonly Prefecture[]
  headingId?: string
  modelValue: readonly number[]
}>()
const emit = defineEmits<{ 'update:modelValue': [codes: number[]] }>()
const expanded = ref(true)
const listId = useId()
const selected = computed(() => new Set(props.modelValue))
const summary = computed(
  () =>
    props.prefectures
      .filter((p) => selected.value.has(p.prefCode))
      .map((p) => p.prefName)
      .join('、') || '都道府県は未選択です',
)
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
  <div class="prefecture-selector" :class="{ 'is-collapsed': !expanded }">
    <div class="selector-heading">
      <h2 :id="headingId" class="selector-title">都道府県</h2>
      <p class="selection-count" role="status" aria-label="選択件数">
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
    <p class="selection-summary">{{ summary }}</p>
    <fieldset :id="listId" class="prefecture-list">
      <legend class="visually-hidden">比較する都道府県（複数選択可）</legend>
      <div class="prefecture-grid">
        <Checkbox
          v-for="prefecture in prefectures"
          :key="prefecture.prefCode"
          :label="prefecture.prefName"
          :model-value="selected.has(prefecture.prefCode)"
          @update:model-value="select(prefecture.prefCode, $event)"
        />
      </div>
    </fieldset>
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
        @click="expanded = !expanded"
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

.prefecture-list {
  min-width: 0;
  padding: 0;
  border: 0;
}

.prefecture-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4);
}

.prefecture-grid > * {
  min-width: 0;
  width: 100%;
}

.selector-actions {
  display: none;
  flex-wrap: wrap;
  gap: var(--space-12);
}

.toggle-list {
  display: none;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}

@container (min-width: 310px) {
  .prefecture-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@container (min-width: 600px) {
  .prefecture-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    column-gap: var(--space-8);
  }
}

@container (min-width: 1100px) {
  .prefecture-grid {
    grid-template-columns: repeat(8, minmax(0, 1fr));
  }
}

@media (width < 640px) {
  .selector-heading {
    min-height: var(--line-height-section);
  }

  .desktop-clear {
    display: none;
  }

  .selector-actions {
    display: flex;
  }

  .is-collapsed .selector-description {
    display: none;
  }

  .toggle-list {
    display: inline-flex;
  }

  .selector-actions > * {
    flex: 1;
    min-width: 0;
  }

  .is-collapsed .prefecture-list {
    display: none;
  }

  .is-collapsed .selection-summary {
    display: block;
  }

  .is-collapsed .selector-actions > :first-child {
    display: none;
  }
}
</style>
