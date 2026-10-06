<template>
  <main class="sample">
    <h1>共通CSS検証</h1>
    <p>scoped CSSからトークンを参照します。</p>
    <button type="button">確認</button>
    <label>入力 <input aria-label="入力" /></label>
    <select aria-label="選択">
      <option>選択肢</option>
    </select>
    <textarea aria-label="メモ"></textarea>
    <label><input type="checkbox" /> チェック</label>
    <a href="#app">先頭へ</a>
    <button type="button" disabled>無効</button>
  </main>
</template>

<style scoped>
.sample {
  display: grid;
  gap: var(--space-16);
  margin: var(--space-16);
  padding: var(--space-24);
  color: var(--color-text-primary);
  background: var(--color-bg-surface);
  border-radius: var(--radius-12);
}
</style>
