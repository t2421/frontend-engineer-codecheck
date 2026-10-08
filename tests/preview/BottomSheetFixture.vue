<script setup lang="ts">
import { ref } from 'vue'
import BottomSheet from '../../src/components/shared/BottomSheet.vue'
import Button from '../../src/components/shared/Button.vue'

const open = ref(new URLSearchParams(location.search).has('open'))
const mounted = ref(true)
</script>
<template>
  <main>
    <h1>共通ボトムシート</h1>
    <Button label="シートを開く" @click="open = true" />
    <BottomSheet v-if="mounted" v-model="open" title="確認用シート">
      <div class="fixture-content">
        <label>名前<input type="text" /></label>
        <Button label="反映" @click="open = false" />
        <Button label="シートを除去" @click="mounted = false" />
      </div>
    </BottomSheet>
  </main>
</template>
<style scoped>
main,
.fixture-content {
  display: grid;
  gap: 24px;
  padding: 16px;
}
</style>
