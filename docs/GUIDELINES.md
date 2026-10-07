# 開発ガイドライン

このリポジトリで実装・テストを書くときの短いルール集です。設計の内容は[設計](./DESIGN.md)、手順は[開発手順](./DEVELOPMENT.md)にあり、ここは「どう書くか」だけを扱います。各項目の根拠は末尾の参照先に対応します。**[公式]** は各ツールの公式ドキュメントが推奨している事項、**[慣例]** は広く使われている流儀でこのリポジトリの決めごとです。

迷ったら「挙動を変えない」「小さく直す」「公開インターフェースで確かめる」を優先します。

## 1. 共通

- 整形はPrettierに一任し、ESLintは品質のためだけに使う。`eslint-config-prettier`は設定の末尾に置く。[公式]
- 依存は固定版で導入し、lockfileを更新する。`minimumReleaseAge`・`ignoreScripts`・監査例外は[依存管理](./DEPENDENCY_SECURITY.md)に従う。[公式]
- `pnpm check`・`pnpm test`・`pnpm test:e2e`・`pnpm build`が通ってから完了とする。
- コメントは「なぜそうしたか」を日本語で書く。「何をしているか」はコードで表す。[慣例]
- 関数は50行、ファイルは400行を目安に分割する。[慣例]

## 2. TypeScript

- `strict`に加え`verbatimModuleSyntax`・`noUncheckedIndexedAccess`・`noUnusedLocals`・`noUnusedParameters`を有効にしている。型だけのimportは`import type`で書く。[公式]
- `any`は使わない。外部データは`unknown`で受けて型ガードで絞る（`parsePrefectures`・`parsePopulation`が例）。[公式]
- 非nullアサーション`!`は書かない。配列の要素は存在を確かめてから使い、テストでは`if (!x) throw new Error(...)`で早期に失敗させる。[慣例]
- `as`はDOMイベントの`target`など型システムが追えない箇所に限る。[慣例]

## 3. Vue部品

- `<script setup lang="ts">`で書き、順序は`<script>`→`<template>`→`<style scoped>`。1ファイル1部品、名前は複数単語のPascalCase。[公式]
- propsは`defineProps<T>()`、既定値は`withDefaults`、イベントは`defineEmits<{ change: [value: T] }>()`、`v-model`は`defineModel`で宣言する。propsは変更せず、親が正本を持つ。[公式]
- 状態は`ref`、派生値は`computed`、`watch`は副作用だけに使い、生成した資源はコールバック内で片付ける。[公式]
- `v-for`には必ず一意な`:key`を付け、同じ要素に`v-if`を同居させない。[公式]
- Chart.jsのinstance・`matchMedia`の購読・AbortControllerなどは`onUnmounted`／`onScopeDispose`で破棄する。[公式]
- DOMのグローバル（`document`・`matchMedia`・`HTMLElement`など）に`globalThis.`は付けない。型は`lib.dom`が、未定義名の検出は`vue-tsc`が担う。[慣例]
- 色・余白・角丸・字体は[デザイントークン](./DESIGN_TOKENS.md)のCSS変数を使う。生のpxや色は、タッチ領域の44pxのような根拠のある値に限り、理由をコメントする。[慣例]
- アクセシビリティの既定: ネイティブ要素を使う。入力には`<label>`を関連付ける。読み上げ領域（`role="status"`／`role="alert"`）は`aria-busy`領域の外に置く。装飾は`aria-hidden`。動きは`prefers-reduced-motion`で止める。フォーカスは2px・4pxオフセットの外側リング。[公式]

## 4. composableとデータ層

- 名前は`useXxx`。入力は`MaybeRefOrGetter`で受けて`toValue`で読み、戻り値はrefを持つ素のオブジェクトにする。`setup`内で同期的に呼ぶ。[公式]
- 取得（`*Api.ts`）と状態（`use*.ts`）を分ける。取得側は固定URL・15秒timeout・`unknown`からの検証・固定文言の失敗を担い、応答本文や内部例外を画面へ出さない。[慣例]
- 古い応答で状態を上書きしない。要求ごとのトークンや`active`フラグで捨て、scope破棄時はabortする。[慣例]

## 5. Worker

- 検証→固定上流へ中継→安全な失敗応答、の順で1つの`fetch`ハンドラに収める。送るヘッダーは`X-API-KEY`とプロキシ自身を名乗る`User-Agent`だけ。ブラウザーの認証情報は転送しない。[慣例]
- `redirect: 'manual'`、`AbortSignal`によるtimeout、`Cache-Control: no-store`、固定コードのerror envelopeを守る。[公式]
- ログは固定分類と数値だけを構造化して出す。キー・IP・本文・例外文は出さない。[慣例]
- Secretは`env`からだけ読む。`.dev.vars`はgitignore対象で、値をチャット・ログ・引数に出さない。`compatibility_date`は依存更新時に見直す。[公式]
- 契約の詳細は[API仕様](./API_PROXY.md)。

## 6. テスト方針

### 層の使い分け

| 層        | 実行環境      | 対象                                          | 場所               |
| --------- | ------------- | --------------------------------------------- | ------------------ |
| unit      | Node          | 取得・検証・導出の純粋関数、Worker            | `tests/unit/`      |
| component | jsdom         | 部品の入出力（props・slot・操作→DOM・emit）   | `tests/component/` |
| e2e       | Google Chrome | 実描画・キーボード操作・Chart.js・axe・横溢れ | `tests/e2e/`       |

- 1テスト1振る舞い。名前は日本語の文で「何が起きるか」を書く。期待値は公開インターフェース（DOM・emit・応答）で確かめ、内部状態や実装の都合は見ない。[公式]
- 通信は境界でモックする（loader差し替え・`vi.stubGlobal('fetch')`・`page.route`）。テストから実APIへは通信しない。[公式]
- カバレッジは`pnpm test:coverage`で`src/`と`worker/`を80%以上に保つ。数値はCIでは強制しない。[慣例]

### Vitest / Vue Test Utils

- mountした部品のunmount、mock・spy・`stubGlobal`の復元は設定（`restoreMocks`・`unstubGlobals`・`tests/component/setup.ts`）が自動で行う。テスト内で`unmount()`や`restoreAllMocks()`を書かない。unmount自体を検証する場合だけ例外。[公式]
- Vueの更新は`await trigger()`／`await setValue()`、Vue外のPromiseは`await flushPromises()`で待つ。[公式]
- `wrapper.vm`は使わない。親との連携を見るときはホスト部品に`<output>`などで値を描画し、DOMで確かめる。子部品の`props()`やクラス名ではなく、表示結果で確かめる。[公式]
- 要素は役割・ラベル・テキスト・属性で探す。クラス名セレクタは新たに増やさない。[慣例]
- `test.each`で入力を並べ、`describe`+`beforeEach`で共通の準備をまとめる。fake timersは`afterEach`で`vi.useRealTimers()`。[公式]

### Playwright

- ロケータは`getByRole`→`getByLabel`→`getByText`の順で選び、`exact: true`を付ける。CSSセレクタは`canvas`のようにロールで表せない要素に限る。[公式]
- 待機は`await expect(locator)`のweb-first assertionで行う。`waitForTimeout`は使わない。[公式]
- `page.evaluate`はロケータで表せない値（Chart.js内部など）に限り、操作直後の値は`expect.poll`で再試行する。[慣例]
- 共通の`goto`は`test.describe`+`beforeEach`に置き、`page.route`は`goto`より前に登録する。[公式]
- 記録用のスクリーンショットは`captureScreenshot`（`testInfo.outputPath`+添付）、横溢れは`expectNoHorizontalOverflow`、axeは`checkAccessibility`を使う。固定パスへの保存はしない。axeは表示が安定してから実行し、`incomplete`は手動確認として記録する。[公式]
- 設定: CIだけ`retries: 2`・`workers: 1`、`expect.timeout`は5秒、trace・screenshotは失敗時のみ。[公式]
- fixtureは`tests/fixtures/`で共有し、`tests/preview/`の確認ページはローカル・CI専用。

## 7. 採用しなかったこと

- `fullyParallel`: ファイル内の直列実行を前提にした準備が残るため未採用。[公式の既定だが保留]
- Workers向けVitestプラグイン: Node環境+`fetch`スタブで契約を検証しており、bindingの実挙動は`wrangler dev`で確認する。移行する場合は`worker.test.ts`を分割する。
- 型情報つきlint（`typescript-eslint`のtype-checked／`strict`）: 実行コストと規模の釣り合いから未採用。
- E2EでViteのdev chunkからChart.jsのregistryを読む方法は、実描画を確かめる唯一の手段として許容する。dev server依存であることをコメントで明記する。
- `PrefectureSelectorSkeleton`（検査用）と`PrefectureSelectionPanel`内のスケルトンの二重実装、Checkboxの内側フォーカスリングは、デザイン判断を伴うため別作業にする。

## 参照

- Vue: [Style Guide](https://vuejs.org/style-guide/)、[Composables](https://vuejs.org/guide/reusability/composables.html)、[Testing](https://vuejs.org/guide/scaling-up/testing.html)、[Accessibility](https://vuejs.org/guide/best-practices/accessibility.html)、[TypeScript](https://vuejs.org/guide/typescript/composition-api.html)
- Vue Test Utils: [Crash Course](https://test-utils.vuejs.org/guide/essentials/a-crash-course.html)、[Async](https://test-utils.vuejs.org/guide/advanced/async-suspense.html)、[Component Instance](https://test-utils.vuejs.org/guide/advanced/component-instance.html)
- Vitest: [Projects](https://vitest.dev/guide/projects)、[Coverage](https://vitest.dev/guide/coverage)、[Config](https://vitest.dev/config/)
- Playwright: [Best Practices](https://playwright.dev/docs/best-practices)、[Locators](https://playwright.dev/docs/locators)、[Assertions](https://playwright.dev/docs/test-assertions)、[Accessibility Testing](https://playwright.dev/docs/accessibility-testing)
- Cloudflare: [Workers best practices](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/)、[Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)、[Static Assets routing](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/)
- TypeScript: [tsconfig reference](https://www.typescriptlang.org/tsconfig/)、[@vue/tsconfig](https://github.com/vuejs/tsconfig)
- ESLint / Prettier: [eslint-plugin-vue](https://eslint.vuejs.org/user-guide/)、[typescript-eslint configs](https://typescript-eslint.io/users/configs/)、[Prettier と linter](https://prettier.io/docs/integrating-with-linters)
- pnpm: [Supply chain security](https://pnpm.io/supply-chain-security)
