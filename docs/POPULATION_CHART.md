# 人口推移グラフ（Issue #26）

`PopulationChart.vue` は #25 / PR #47 の `PopulationSeries[]` と `PopulationCategory` を受け取る描画専用部品です。通信・選択・キャッシュは持ちません。`PopulationDataPanel` の既存 slot の既定表示として接続し、App の選択入力境界と検証用 JSON slot を維持します。#24 の一覧・選択 UI はこの変更に含めません。

## データと lifecycle

- `populationChartData.ts` が年・人数を数値の `{ x, y }` に写し、入力を変更しない新しい Chart.js データを作ります。県ごとに年が異なっても配列 index で年を取り違えません。
- Chart.js 単体の必要な controller・element・linear scale・tooltip だけを登録します。初回は生成、変更は同じ instance にデータを置き換えて `update('none')`、全解除・unmount は `destroy()`。Vue の post-flush watcher で canvas の再表示後に生成します。
- 横軸は数値年、縦軸の元データは人数。表示目盛りだけ万人に変換し、tooltip と表は桁区切り人数です。横軸はデータ範囲に合わせ、狭い plot は目盛り数を減らします。animation は無効です。
- 追加依頼に合わせ、全系列を実線・直線補間（tension=0）・丸いデータ点に統一。県コードごとに47個の固有の色トークンを固定し、選択順・解除で割当は変わりません。東京都・大阪府・北海道は既存の3色を再利用します。
- 空の入力では共通 StatusMessage の PRD 文言を表示。Panel 接続時の loading/error/retry は既存部品が引き続き担当します。

## Figma と画面比較

2026-10-07、design-to-code skill の design context と screenshot で [PC](https://www.figma.com/design/I5QdPGt1iIXNqda6KQG1r2?node-id=2-64)、[tablet](https://www.figma.com/design/I5QdPGt1iIXNqda6KQG1r2?node-id=31-1655)、[mobile](https://www.figma.com/design/I5QdPGt1iIXNqda6KQG1r2?node-id=2-65)、[グラフ](https://www.figma.com/design/I5QdPGt1iIXNqda6KQG1r2?node-id=6-92) を確認しました。

| 対象   | Figma 参照キャプチャ                                             | 実装キャプチャ（合成データ）                                                                                                           |
| ------ | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| PC     | [グラフ領域](./screenshots/issue-26/figma-desktop-reference.png) | [1440px グラフ領域](./screenshots/issue-26/population-chart-panel-1440.png) / [全体](./screenshots/issue-26/population-chart-1440.png) |
| Tablet | 上記 design context の 768px 画面                                | [768px グラフ領域](./screenshots/issue-26/population-chart-panel-768.png) / [全体](./screenshots/issue-26/population-chart-768.png)    |
| Mobile | [グラフ領域](./screenshots/issue-26/figma-mobile-reference.png)  | [390px グラフ領域](./screenshots/issue-26/population-chart-panel-390.png) / [全体](./screenshots/issue-26/population-chart-390.png)    |
| 最小幅 | 390pxを基にリフロー確認                                          | [320px グラフ領域](./screenshots/issue-26/population-chart-panel-320.png) / [全体](./screenshots/issue-26/population-chart-320.png)    |

plot は PC/tablet 344px・mobile 266px、間隔20px、既存の文字・余白・系列色トークンを再利用します。凡例を折り返し、24×16pxのSVGを系列と同じトークン色の実線・丸点で描画します。追加依頼に合わせ、Figma参照の破線・点線・マーカー形状による識別を変更しました。上記比較画像は実線・固定色への追加変更後です。Figmaとの相違はユーザーの追加依頼によるものです。データ依存の線は Chart.js で描画します。Figma の仮の折れ線 SVG はアプリの素材にしません。

PC/tabletの目盛りと縦軸は選択値に応じた Chart.js の自動計算です。スマホ（既存viewport breakpointの640px未満）の横軸は1960・1980・2000・2020年のうち、入力データの年の範囲内だけを表示します。リサイズで表示方法を切り替え、データ点・年の範囲・人数・tooltipは変更しません。範囲内に指定年がなくても偽の点を追加しません。Figma のサンプル固定目盛り・注記をそのまま固定せず、現在区分の説明と読み上げ用の人口表を追加しています。既存のフォント配信方針（Noto Sans JP 未導入時は端末 sans-serif）を維持します。画面全体の県選択エリアは検証専用で、Figma の選択 UI 実装を示しません。

## アクセシビリティ

Canvas は role=img と現在区分・県名のラベル、軸と代替表の説明を持ちます。画面側の県名凡例・人数tooltip・代替表を併用。47色があらゆる色覚や利用者に対して識別可能であるとは保証しません。年別値の表は視覚的に隠し、支援技術から各県の全ての年・人口数を確認できる代替情報として提供します。可視の開閉一覧は設けません。47県でも表を県別に分け、横に47列を並べません。更新時の追加 live 通知・focus 移動は行いません。

PR #50 を含む最新mainを取り込み、`tests/e2e/accessibility.spec.ts`と共通`checkAccessibility`で4幅（1440/768/390/320）×5状態（未選択・3県選択・老年人口・読み上げ用表・全解除）を継続検査します。axe 4.13.0 / WCAG 2A・2AA・2.1A・2.1AA・2.2AA、除外なし。判定前に全結果のJSONを保存し、CIのHTMLレポートへ添付します。初回のローカル20検査も violations=0、incomplete=0。[初回集計](./screenshots/issue-26/accessibility-summary.json)。

キーボードによる区分切替、県選択維持、読み上げ用表の全人口値と説明参照の整合、4幅の横溢れなしを Chrome で確認しました。スクリーンリーダーによる読み上げの自然さと、利用者による色・線・表の理解の手動確認は残ります。

## 検証記録

Mac / Node 24.16.0 / native pnpm 12.8.1 / installed Google Chrome。TDD で描画用データ・部品未実装時と review fixture 未実装時の失敗を確認してから実装しました。

| チェック                    | 結果                                                                                                                                   |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm check`                | ESLint・Stylelint・Prettier・vue-tsc 成功                                                                                              |
| `pnpm test`                 | 単体・部品130件、レビュー関連13件成功                                                                                                  |
| `pnpm test:e2e --workers=2` | 61件成功（共通axeのグラフ20状態を含む）                                                                                                |
| 描画・更新・破棄            | 4区分、解除、全解除、再表示3回、連続更新、unmount、Chart.js registry の instance 数・同一 id と破棄を確認                              |
| 実ブラウザ                  | 入力年・人数、線の有限座標、canvas の非空画素、人数 tooltip、47県凡例、各幅への resize、表のキーボード操作、検証fixtureの API 通信ゼロ |
| build                       | 通常 Worker/client と review fixture build 成功                                                                                        |
| frozen install              | 既存方針のまま成功                                                                                                                     |
| audit                       | 成功。承認済み braces High 1件のみ `1 ignored: 1 high`。新しい監査指摘なし                                                             |

追加依存は公式 npm registry の `chart.js@4.5.1`（2025-10-13公開、MIT）と推移依存 `@kurkle/color@0.3.4`（2024-11-19公開）のみ。`pnpm-workspace.yaml` の7日待機・scripts停止・既存例外を変更していません。Chart.js の [公式 lifecycle API](https://www.chartjs.org/docs/latest/developers/api.html) と [Canvas accessibility](https://www.chartjs.org/docs/latest/general/accessibility.html) を参照しました。

## ローカルでの確認

`pnpm dev` の URL で `/tests/preview/population-chart.html` を開きます。初期は未選択。東京都・大阪府・北海道にチェックし、4区分・個別解除・全解除・47県・グラフ領域表示切替を操作できます。データは合成で、実APIや秘密値を使用しません。review build が既存公開規約の `tests/preview/*.html` として列挙することも確認しました。

最新mainのreview build・性能計測と生成物の除外設定を維持しています。性能計測は同じheadのSHA付きアプリURLで自動実行され、fixtureの手動検証とは別にPRへ結果を記録します。

実APIデータでの画面統合は #24 接続後に確認します。この描画専用部品の値・操作は合成 fixture で検証済み。PR・Previewの最新状態はPR本文の検証結果を参照してください。

## スマホ横軸の表示変更（ローカル検証）

2026-10-07の追加依頼で、横軸の目盛りを上記4年に変更しました。1年/5年刻みの全点保持、指定年が一部/全部範囲外の入力、非目盛り年のtooltip、639/640px境界・320/390/768/1440px間のresize、同一instanceを確認。単体・部品59件、Chrome26件、check・buildが成功しています。スマホの4キャプチャを更新し、PC/tabletのキャプチャに変更はありません。PR・Previewへの反映結果はPR本文を参照してください。

[指定APIの公式仕様](https://github.com/yumemi-inc/frontend-engineer-codecheck/blob/main/docs/api.md)は年単位のデータとして説明しますが、固定10年/5年刻みは規定せず、例は1960年の1点です。既存review fixtureの10年刻みはFigmaに合わせた合成データで、実APIの刻みを保証するものではありません。今回も実APIは呼ばず、取得済みデータの`year`をそのまま保持する描画を検証しています。`?years=five-year`・`?years=annual`・`?years=partial`・`?years=gap`で年の刻み・範囲が異なる合成fixtureを確認できます。

## 実線・固定色への追加変更

2026-10-07の追加依頼により、線種・マーカー形状による識別をやめ、実線と県ごとの固定色を採用しました。色パレットの44色は白背景に対するコントラスト3.2以上の候補からCIELAB距離を広げるよう選び、CSSトークンへ明示しています。RGB値は全47県で固有、白背景との最小コントラストは3.270です。これは色同士の判別やあらゆる色覚への保証ではありません。[固定割当とコントラスト記録](./screenshots/issue-26/solid-colors-summary.json)。県名・tooltip・全データの表を維持します。

[PC 3県](./screenshots/issue-26/solid-colors-panel-1440.png) / [tablet 3県](./screenshots/issue-26/solid-colors-panel-768.png) / [mobile 3県](./screenshots/issue-26/solid-colors-panel-390.png) / [320px 3県](./screenshots/issue-26/solid-colors-panel-320.png) / [PC 47県](./screenshots/issue-26/solid-colors-47-1440.png) / [mobile 47県](./screenshots/issue-26/solid-colors-47-390.png)。PR・Previewの反映結果と対象SHAはPR本文を参照してください。

TDDで47色の固有性検査が旧実装の3色に対して失敗することを確認してから変更しました。全系列の実線・tension=0、選択順反転・個別解除／再選択で色固定、実canvasと凡例の色一致、既存の全点保持・tooltip・区分変更・生成更新破棄を確認しています。最新main（PR48のAPI中継を含む）との統合後、check・130件の単体/部品・13件のレビュー関連テスト・61件のChrome・通常/review build・auditが成功しました。共通axeのグラフ20状態はviolations/incompleteとも0件です。

2026-10-07の追加依頼により、東京・大阪・北海道への先頭3色の特別割当を廃止しました。全県で県コードから色番号（県コード − 1）を求め、選択順・解除・再選択によらず固定します。APIの人数と系列の入力順は変更しません。またグラフを直感的に比較する目的に合わせ、可視の数値一覧を削除しました。canvas の軸説明と、視覚的に隠した県別・年別の semantic table を維持し、PRD のグラフ表示および代替情報の提供を保ちます。スクリーンリーダー実機での読みやすさは手動確認が必要です。
