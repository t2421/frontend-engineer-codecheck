import js from '@eslint/js'
import vue from 'eslint-plugin-vue'
import ts from 'typescript-eslint'
import prettier from 'eslint-config-prettier/flat'
import { defineConfig } from 'eslint/config'

export default defineConfig([
  {
    ignores: [
      'dist/**',
      'dist-review/**',
      '.lighthouseci/**',
      'performance-results/**',
      '.wrangler/**',
      'node_modules/**',
      'test-results/**',
      'playwright-report/**',
      '.vitest/**',
      'coverage/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.{ts,vue}'],
    extends: [ts.configs.recommended, ts.configs.stylistic],
  },
  vue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: { parserOptions: { parser: ts.parser } },
    // 未定義名の検出はvue-tscが担うため、TSファイルと同じくno-undefを切る。
    rules: { 'no-undef': 'off' },
  },
  {
    files: ['tests/**'],
    // テストでは空のstreamやPromiseの意図的なstub、ホスト部品の複数定義を許す。
    rules: {
      '@typescript-eslint/no-empty-function': 'off',
      'vue/one-component-per-file': 'off',
    },
  },
  // 整形はPrettierに一任し、競合するESLintルールを無効にする。常に末尾に置く。
  prettier,
])
