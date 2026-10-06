<script setup lang="ts">
import { ref } from 'vue'
import SingleSelectGroup from '../../../src/shared/ui/SingleSelectGroup.vue'

const selected = ref('total')
const other = ref(1)
const options = [
  { value: 'total', label: '総人口' },
  { value: 'young', label: '年少人口' },
  { value: 'working', label: '生産年齢人口' },
  { value: 'elder', label: '老年人口' },
]
</script>

<template>
  <main>
    <SingleSelectGroup v-model="selected" :options="options" label="人口区分" />
    <output aria-label="選択値">{{ selected }}</output>
    <SingleSelectGroup
      v-model="other"
      :options="[
        { value: 1, label: '一' },
        { value: 2, label: '二' },
      ]"
      label="別のグループ"
    />
    <SingleSelectGroup
      v-model="other"
      :options="[
        { value: 1, label: '任意の長いラベルでも選択肢の全文が確認できます' },
        { value: 2, label: 'Short' },
      ]"
      label="長いラベル"
    />
    <button @click="selected = 'total'">先頭に戻す</button>
  </main>
</template>

<style scoped>
main {
  display: grid;
  gap: var(--space-24);
  max-width: 41.5rem;
  padding: var(--space-32);
  background: var(--color-bg-surface);
}
</style>
