import js from '@eslint/js'
import vue from 'eslint-plugin-vue'
import ts from 'typescript-eslint'
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
  { files: ['**/*.{ts,vue}'], extends: [ts.configs.recommended] },
  vue.configs['flat/essential'],
  {
    files: ['**/*.vue'],
    languageOptions: { parserOptions: { parser: ts.parser } },
  },
])
