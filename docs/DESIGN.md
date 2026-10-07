# 設計とデザイン

採用技術はVue / Vite / TypeScript、Chart.js単体、Cloudflare Workers Static Assetsと公式Viteプラグインです。Vueのref・computed・composableで状態を扱い、永続cache・DB・認証・SSRは設けません。版とツールの正本は[package.json](../package.json)、配置規約は[README](../README.md)です。

## 状態と表示

ページが選択県と人口区分の正本を持ち、取得処理が県別の全4区分cacheを管理します。系列と案内は現在の選択から導出し、UIやChartへ選択を複製しません。

- 初期は県未選択・総人口。区分変更で県を維持し、全解除で区分を維持します。
- 未選択時は人口取得なし。取得済み/取得中の県を重複取得せず、古い応答で選択や新しい状態を上書きしません。
- 一覧の読み込み表示は操作不可。失敗は再読み込みへ進み、人口の追加取得/一部失敗でも成功済み系列を保ちます。既存系列がある場合はコンパクトな状態表示です。
- 狭い幅では県一覧を初期closedにし、選択を維持して開閉します。隠れた操作をTab/支援技術から外し、幅変更で必要な場合だけfocusを移します。

通信・エラーの契約は[API](./API_PROXY.md)、操作と通知の品質基準は[a11y](./ACCESSIBILITY.md)を参照してください。props・slotの詳細は各コンポーネントを正本とします。

## グラフ

元の全データ点を年・人数で保持します。横軸は年、縦軸目盛りは万人、tooltipは人数。狭い幅で目盛りを絞ってもデータを間引きません。Chartは生成・同じinstanceで更新・全解除/unmountで破棄します。

実線・丸点・県コード順の固定色を使用します。これはFigmaの線種からの追加仕様です。色の判別可能性を保証せず、県名凡例・tooltip・視覚的に隠した県別年別のsemantic tableを併用し、可視の数値一覧は設けません。描画は実Chromeで確認します。[描画実装](../src/components/population/PopulationChart.vue)と[共通CSS](./DESIGN_TOKENS.md)を参照してください。

## Figma参照

要件の正本は[仕様](./PRD.md)。以下は画面・状態・部品の参照先です。

- 画面：[PC](https://www.figma.com/design/I5QdPGt1iIXNqda6KQG1r2?node-id=2-64)、[tablet](https://www.figma.com/design/I5QdPGt1iIXNqda6KQG1r2?node-id=31-1655)、[mobile](https://www.figma.com/design/I5QdPGt1iIXNqda6KQG1r2?node-id=2-65)、[mobile展開](https://www.figma.com/design/I5QdPGt1iIXNqda6KQG1r2?node-id=2-66)。
- 状態：[初期](https://www.figma.com/design/I5QdPGt1iIXNqda6KQG1r2?node-id=31-1366)、[一覧読み込み](https://www.figma.com/design/I5QdPGt1iIXNqda6KQG1r2?node-id=17-860)、[未選択・読み込み・失敗](https://www.figma.com/design/I5QdPGt1iIXNqda6KQG1r2?node-id=8-879)、[4区分](https://www.figma.com/design/I5QdPGt1iIXNqda6KQG1r2?node-id=31-2290)。
- 部品：[共通操作](https://www.figma.com/design/I5QdPGt1iIXNqda6KQG1r2?node-id=4-169)、[県選択](https://www.figma.com/design/I5QdPGt1iIXNqda6KQG1r2?node-id=7-591)、[状態表示](https://www.figma.com/design/I5QdPGt1iIXNqda6KQG1r2?node-id=6-295)、[グラフ](https://www.figma.com/design/I5QdPGt1iIXNqda6KQG1r2?node-id=6-92)。
- スケルトン：[部品](https://www.figma.com/design/I5QdPGt1iIXNqda6KQG1r2?node-id=16-1392)、[PC一覧](https://www.figma.com/design/I5QdPGt1iIXNqda6KQG1r2?node-id=16-1395)、[mobile一覧](https://www.figma.com/design/I5QdPGt1iIXNqda6KQG1r2?node-id=16-1549)。

## ライセンス

採用ツールの公式ライセンス：

- MIT：[Vue](https://github.com/vuejs/core/blob/main/LICENSE)、[Vite](https://github.com/vitejs/vite/blob/main/LICENSE)、[Chart.js](https://github.com/chartjs/Chart.js/blob/master/LICENSE.md)、[Vitest](https://github.com/vitest-dev/vitest/blob/main/LICENSE)、[Vue Test Utils](https://github.com/vuejs/test-utils/blob/main/LICENSE)。
- MIT：[ESLint](https://github.com/eslint/eslint/blob/main/LICENSE)、[eslint-plugin-vue](https://github.com/vuejs/eslint-plugin-vue/blob/master/LICENSE)、[Prettier](https://github.com/prettier/prettier/blob/main/LICENSE)、[Stylelint](https://github.com/stylelint/stylelint/blob/main/LICENSE)、[vue-tsc](https://github.com/vuejs/language-tools/blob/master/LICENSE)。
- Apache-2.0：[TypeScript](https://github.com/microsoft/TypeScript/blob/main/LICENSE.txt)、[Playwright](https://github.com/microsoft/playwright/blob/main/LICENSE)。
- Cloudflare Viteプラグイン：[公式package.json](https://github.com/cloudflare/workers-sdk/blob/main/packages/vite-plugin-cloudflare/package.json)の宣言はMITで、リポジトリの[LICENSE-MIT](https://github.com/cloudflare/workers-sdk/blob/main/LICENSE-MIT)も確認した。

アクセシビリティ検査の`@axe-core/playwright`・axe-coreはMPL-2.0です。[公式ライセンス](https://github.com/dequelabs/axe-core/blob/develop/LICENSE)を参照してください。依存更新・配布時は推移依存を含め必要なライセンス条件を確認します。
