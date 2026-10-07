# 共通チェックボックス

Issue #6 の `src/shared/ui/Checkbox.vue`。Vue 3 / TypeScript / scoped CSSで実装し、任意の項目をbooleanで選択・解除する。都道府県コード、API、一覧生成、人口データは持たない。

```vue
<script setup lang="ts">
import { ref } from 'vue'
import Checkbox from '../shared/ui/Checkbox.vue'

const selected = ref(false)
</script>

<template>
  <Checkbox v-model="selected" label="任意の項目" :disabled="false" />
</template>
```

`label: string` と `modelValue: boolean` は必須、`disabled: boolean` の既定値はfalse。操作による変更は `update:modelValue(checked: boolean)` と `change(checked: boolean)` を各1回通知する。親の状態変更は通知しない。親が選択状態の正本を持つ。無効時は選択・通知を行わず、現在の選択状態を表示する。

ネイティブ `input type="checkbox"` をlabelで囲み、ラベル全体のクリック、Tab、Space、アクセシブルネームをブラウザ標準機能で扱う。独自のkeydownによる二重切替は追加しない。複数インスタンスでIDの衝突は発生しない。forced-colorsではネイティブ入力を表示する。

## デザインと依存

[共通操作部品](https://www.figma.com/design/I5QdPGt1iIXNqda6KQG1r2?node-id=4-169) のdesign contextとスクリーンショットを確認。高さ44px、最小幅136px、control 20px、選択背景、内側2pxフォーカス枠、無効色を反映。長い任意ラベルでは折返し・高さ拡張を許容する。

PR #33 はマージ済み。初回はマージコミット `05c8718d568203097b9cacddaadb8b7a0f161704` を基点とし、再開時に最新main `2867e3ca76f26af3c0a67704d090052811cdc2b5` へfast-forwardした。既存 `src/base.css` の共通CSSトークンを参照する。フォントの配信方法は既存のDESIGN_TOKENS.mdと同じ未確定事項で、未導入環境ではsans-serifにフォールバックする。

FigmaのIcon / Check（4:2 / 4:3）は `src/shared/ui/assets/check.svg` に取得した原本を使用。20×20のroot寸法を保持し、装飾としてaria-hiddenのcontrol内に配置する。Figmaの一時URLは実装に含めない。依存追加、共通CSSの変更、App画面への仮の組込みは行っていない。

## 検証

- Vue部品テスト8件：ラベル関連付け、クリック選択・解除と通知、親更新、未選択／選択済みdisabled、disabled中のchange防御、無効解除、複数インスタンス。最小実装で7件失敗を確認後、全件成功。初回は既存2件を含めVitest 10件成功。最新mainでの再検証は既存分を含め22件成功。
- Chromeの操作テスト2件：Tab／Space選択・解除、通知回数、disabledのTabスキップ、ラベルクリック、disabledへの実マウス操作。初回は既存最小画面1件を含め3件成功。最新mainでの再検証は既存画面・ボタンを含め9件成功（目視画像取得用の一時テスト1件も成功後削除）。CSS値を照合するE2Eは追加していない。
- fixtureはtests配下だけに置き、完成画面には追加しない。並行作業で5175番が使用中のため、検証時のみ一時設定で5186番を利用し、設定は削除した。
- Chromeで未選択・選択・フォーカス・無効状態を目視し、Figmaと照合。再開時も1440 / 768 / 390pxで表示と折返しを再確認。チェックアイコンの読み込みと20×20の表示も確認。
- Node 24.16.0 / native pnpm 12.8.1でcheck（ESLint / Stylelint / Prettier / vue-tsc）、test、Worker＋client build成功。部品は後続の画面が利用するため、現時点のproduction entryからは参照されず、部品自体の変換・型・操作はVueテストとChrome fixtureで検証した。
- 既知のbraces High 1件（GHSA-vfj7-8cjw-p6xm）は未解消。初回auditは未合格だったが、最新mainではユーザー承認済みのaudit.ignoreが設定されており、再実行結果は終了コード0、`1 ignored: 1 high`。詳細と既承認リスクはQUALITY_CHECKS.mdを参照。Issue #6では監査設定・依存・閾値を変更していない。

キャプチャは `docs/screenshots/issue-6/` に保存。PC・タブレット・スマートフォンの未選択／無効と、選択済みフォーカス状態を確認できる。

2026-10-07、ユーザーからcommit・push・キャプチャ付きmain向けdraft PR作成の承認を取得。merge・本番deployは対象外。

## 操作可能なPRプレビュー

review buildの規約に合わせてHTMLを `tests/e2e/fixtures/checkbox.html` へ移動し、既存 `tests/fixtures/checkbox.ts` を再利用する。`.github/scripts/build-review.mjs` がこのHTMLを静的出力へ含め、reviewトップのリンクから開ける。ローカルと公開プレビューのパスは `/tests/e2e/fixtures/checkbox.html`。通常のproduction buildのentryやAppには追加しない。

追加確認: review静的出力のトップリンクと部品ページをChromeで開き、1440 / 390pxで未選択・クリック選択・Space切替・Tab移動・disabledの通知抑止を検証。768pxも目視確認し、キャプチャを更新した。check、Vitest 22件、Chrome E2E 9件、通常buildとreview buildが成功。
