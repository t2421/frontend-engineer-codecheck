# 人口推移グラフ（Issue #26）

`PopulationChart.vue` は #25 / PR #47 の `PopulationSeries[]` と `PopulationCategory` を受け取る描画専用部品です。通信・選択・キャッシュは持ちません。`PopulationDataPanel` の既存 slot の既定表示として接続し、App の選択入力境界と検証用 JSON slot を維持します。#24 の一覧・選択 UI はこの変更に含めません。

## データと lifecycle

- `populationChartData.ts` が年・人数を数値の `{ x, y }` に写し、入力を変更しない新しい Chart.js データを作ります。県ごとに年が異なっても配列 index で年を取り違えません。
- Chart.js 単体の必要な controller・element・linear scale・tooltip だけを登録します。初回は生成、変更は同じ instance にデータを置き換えて `update('none')`、全解除・unmount は `destroy()`。Vue の post-flush watcher で canvas の再表示後に生成します。
- 横軸は数値年、縦軸の元データは人数。表示目盛りだけ万人に変換し、tooltip と表は桁区切り人数です。横軸はデータ範囲に合わせ、狭い plot は目盛り数を減らします。animation は無効です。
- 県コードごとに系列色・線種・マーカーを固定。東京都・大阪府・北海道は Figma の3種類に合わせ、残りも既存の3色と4線種・4マーカーの組み合わせで47県を区別します。選択順・解除で割当は変わりません。
- 空の入力では共通 StatusMessage の PRD 文言を表示。Panel 接続時の loading/error/retry は既存部品が引き続き担当します。

## Figma と画面比較

2026-10-07、design-to-code skill の design context と screenshot で [PC](https://www.figma.com/design/I5QdPGt1iIXNqda6KQG1r2?node-id=2-64)、[tablet](https://www.figma.com/design/I5QdPGt1iIXNqda6KQG1r2?node-id=31-1655)、[mobile](https://www.figma.com/design/I5QdPGt1iIXNqda6KQG1r2?node-id=2-65)、[グラフ](https://www.figma.com/design/I5QdPGt1iIXNqda6KQG1r2?node-id=6-92) を確認しました。

| 対象   | Figma 参照キャプチャ                                             | 実装キャプチャ（合成データ）                                                                                                           |
| ------ | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| PC     | [グラフ領域](./screenshots/issue-26/figma-desktop-reference.png) | [1440px グラフ領域](./screenshots/issue-26/population-chart-panel-1440.png) / [全体](./screenshots/issue-26/population-chart-1440.png) |
| Tablet | 上記 design context の 768px 画面                                | [768px グラフ領域](./screenshots/issue-26/population-chart-panel-768.png) / [全体](./screenshots/issue-26/population-chart-768.png)    |
| Mobile | [グラフ領域](./screenshots/issue-26/figma-mobile-reference.png)  | [390px グラフ領域](./screenshots/issue-26/population-chart-panel-390.png) / [全体](./screenshots/issue-26/population-chart-390.png)    |
| 最小幅 | 390pxを基にリフロー確認                                          | [320px グラフ領域](./screenshots/issue-26/population-chart-panel-320.png) / [全体](./screenshots/issue-26/population-chart-320.png)    |

plot は PC/tablet 344px・mobile 266px、間隔20px、既存の文字・余白・系列色トークンを再利用します。凡例を折り返し、参照3県の装飾SVGをローカル保存し、実ブラウザで各24×16px・非空・読込成功を確認しました。データ依存の線は Chart.js で描画します。Figma の仮の折れ線 SVG はアプリの素材にしません。

目盛りの上限・間隔は選択値に応じた Chart.js の自動計算です。Figma のサンプル固定目盛り・注記をそのまま固定せず、現在区分の説明と開閉できる人口表を追加しています。既存のフォント配信方針（Noto Sans JP 未導入時は端末 sans-serif）を維持します。画面全体の県選択エリアは検証専用で、Figma の選択 UI 実装を示しません。

## アクセシビリティ

Canvas は role=img と現在区分・県名のラベル、軸と代替表の説明を持ちます。画面側の県名凡例と線種・マーカーを併用。ネイティブ details/summary から、各県の全ての年・人口数を表で確認でき、マウス hover に依存しません。47県でも表を県別に分け、横に47列を並べません。更新時の追加 live 通知・focus 移動は行いません。

PR #50 は確認時 draft で main 未マージです。その `docs/ACCESSIBILITY.md` と同じ axe 4.13.0 / WCAG 2A・2AA・2.1A・2.1AA・2.2AA タグ、除外なしでローカル検査しました。PR #50 の worktree のインストール済み axe を読み取り利用し、今回の依存は増やしていません。

4幅（1440/768/390/320）×5状態（未選択・3県選択・老年人口・表展開・全解除）の20検査で violations=0、incomplete=0。[集計](./screenshots/issue-26/accessibility-summary.json)。完全な検査JSONはローカル `test-results/issue26-a11y-*.json` に保存します。これは PR #50 の CI への統合結果ではありません。マージ後の共通検査へのケース追加は接続時に確認してください。

キーボードによる区分切替、県選択維持、summary の focus/Enter で表を開くこと、人口値の可視性、4幅の横溢れなしを Chrome で確認しました。スクリーンリーダーによる読み上げの自然さと、利用者による色・線・表の理解の手動確認は残ります。

## 検証記録

Mac / Node 24.16.0 / native pnpm 12.8.1 / installed Google Chrome。TDD で描画用データ・部品未実装時と review fixture 未実装時の失敗を確認してから実装しました。

| チェック                    | 結果                                                                                                                                   |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm check`                | ESLint・Stylelint・Prettier・vue-tsc 成功                                                                                              |
| `pnpm test`                 | 12ファイル・56件成功（新規4件）                                                                                                        |
| `pnpm test:e2e --workers=2` | 24件成功（新規5件）                                                                                                                    |
| 描画・更新・破棄            | 4区分、解除、全解除、再表示3回、連続更新、unmount、Chart.js registry の instance 数・同一 id と破棄を確認                              |
| 実ブラウザ                  | 入力年・人数、線の有限座標、canvas の非空画素、人数 tooltip、47県凡例、各幅への resize、表のキーボード操作、検証fixtureの API 通信ゼロ |
| build                       | 通常 Worker/client と review fixture build 成功                                                                                        |
| frozen install              | 既存方針のまま成功                                                                                                                     |
| audit                       | 成功。承認済み braces High 1件のみ `1 ignored: 1 high`。新しい監査指摘なし                                                             |

追加依存は公式 npm registry の `chart.js@4.5.1`（2025-10-13公開、MIT）と推移依存 `@kurkle/color@0.3.4`（2024-11-19公開）のみ。`pnpm-workspace.yaml` の7日待機・scripts停止・既存例外を変更していません。Chart.js の [公式 lifecycle API](https://www.chartjs.org/docs/latest/developers/api.html) と [Canvas accessibility](https://www.chartjs.org/docs/latest/general/accessibility.html) を参照しました。

## ローカルでの確認

`pnpm dev` の URL で `/tests/e2e/fixtures/population-chart.html` を開きます。初期は未選択。東京都・大阪府・北海道にチェックし、4区分・個別解除・全解除・47県・グラフ領域表示切替を操作できます。データは合成で、実APIや秘密値を使用しません。review build が既存公開規約の `tests/e2e/fixtures/*.html` として列挙することも確認しました。

review build の既存生成先 `dist-review` は `.gitignore` に含まれますが、既存 ESLint/Prettier の除外には含まれません。生成済み出力があると `pnpm check` が生成JSを検査するため、今回の最終 check 前に出力を `/tmp/issue26-review-build-final-20261007` へ移しました。検査規則は緩和していません。

実APIデータでの画面統合は #24 接続後に確認します。この描画専用部品の値・操作は合成 fixture で検証済み。PR・Previewの最新状態はPR本文の検証結果を参照してください。
