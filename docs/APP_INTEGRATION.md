# Webアプリ全体の統合確認（#55・#57）

## 実装と依存

最新main `ad864de`（PR47・48・50・51・52・53・54・56を含む）のApp、ベースページ、県選択、人口区分、グラフ、共通UI、Workerを再利用した。県選択・区分・県単位cache・request無効化・Chart生成更新破棄は既存実装に集約している。

スマホ初期closedはPR58 head `0266ca1d7eea47541dc9a0f21996a10f9e755f1f`の既存実装を統合した。PR58は未mergeの依存であり、本作業でmainへmergeしない。PR54とPR58のa11yテスト競合はPR58側の県選択・mobile展開テストを維持して解消した。jsdomでのChart描画をstubする既存修正も再利用している。

今回の追加はAppから既存人口loaderへの注入、同じAppを使う合成データ確認ページ、全体統合テストと画面側→Workerの契約テスト。人口GETにも一覧GETと同じ15秒timeoutを設けた。依存・lock・pnpm12.8.1・supplychain設定は変更していない。

## 確認環境と手順

2026-10-07、Mac arm64 / Node24.16.0 / pnpm12.8.1 / インストール済みGoogle Chromeで確認した。上記mainとPR58を基準にした統合branchで検証した。公開したcommitはPRのheadを正本とし、CI・自動Previewの結果はPR本文に記録する。

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm check
pnpm test:e2e
pnpm build
node .github/scripts/build-review.mjs
```

別タスクが5175番を使っていたため、本検証では一時的なPlaywright設定で5186番に変更した。それ以外の設定は既存のplaywright.config.tsと同じ。一時設定は成果物に含めない。

アプリ本体 `/` は同一originの固定GETへ接続する。テストはPlaywright routeモックで47県・4区分の合成応答を返し、実Appで検証する。別の確認ページ `/tests/e2e/fixtures/app-integration.html` は同じAppに合成loaderを渡すためAPIへ通信しない。UI専用Previewにも既存buildで含まれる。これを実API成功として扱わない。

## PRD受入条件

| 条件                                         | ローカルの観測結果                                                                                       |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| API由来の47チェックボックス・複数県・1県解除 | route応答から47県を表示。2県の元値を照合、47系列を表示。1県解除はその系列だけ削除                        |
| 年・人口数・県と線・値                       | 実Chart.jsのdatasetと代替表を合成応答の年・人口値と照合。凡例・固定色・実線は既存実装                    |
| 4人口区分・選択維持                          | 全区分の値を照合。県は維持し、切替で追加通信なし。同じChart instanceを更新                               |
| PC/tablet/mobile                             | 1440/768/390/320pxで主要操作、47系列、横溢れなし。mobile初期closed・展開・閉じた選択要約を確認           |
| 初期未選択・総人口・全解除                   | 初期は人口GETなし、PRDの案内。全解除で案内・区分維持・Chart instanceが0                                  |
| 一覧/人口loading・error                      | 一覧は操作不可47skeleton、人口loading、各取得失敗と安全な案内を確認                                      |
| retry                                        | 一覧/人口の失敗後に再読み込みで復帰。人口区分・県選択を保持                                              |
| 連続操作・cache                              | 未選択は人口通信なし。解除後再選択はcache。取得中再選択は重複GETなし。遅延応答後も解除済み県は復活しない |
| キーボード・aria・代替表                     | Tab/Space/Enter操作、radio切替、Canvas説明、表、既存WCAG A/AA自動検査を維持                              |

## 検証結果と画面

全既存を含むChrome86件、Vitest158件、CI script25件、check（ESLint/Stylelint/Prettier/vue-tsc）、SPA/Worker build、UI Preview buildが通過。

[機械検証記録](./screenshots/issue-55/verification.json)にAPIモックの区別・基準SHA・axe結果を記録。axeの判定不能は手動確認が必要であり、自動検査だけで全a11y監査完了とはしない。#35の横断監査・#36の最終性能計測は別Issue。

| 状態                            | キャプチャ（すべて合成データ）                                                                                                                    |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| PC 2県                          | [1440px](./screenshots/issue-55/app-selected-1440.png)                                                                                            |
| tablet 2県                      | [768px](./screenshots/issue-55/app-selected-768.png)                                                                                              |
| mobile初期closed                | [390px](./screenshots/issue-55/app-initial-390.png)                                                                                               |
| mobile展開・2県                 | [390px](./screenshots/issue-55/app-selected-390.png)                                                                                              |
| narrow 2県                      | [320px](./screenshots/issue-55/app-selected-320.png)                                                                                              |
| 47県                            | [PC](./screenshots/issue-55/app-47-1440.png)、[mobile](./screenshots/issue-55/app-47-390.png)                                                     |
| 一覧loading・人口loading・error | [一覧](./screenshots/issue-55/app-list-loading.png)、[人口](./screenshots/issue-55/app-loading.png)、[失敗](./screenshots/issue-55/app-error.png) |

## 実API確認の残件（#57）

既存公開環境 `https://population-viewer.t2421-loop.workers.dev/api/v1/prefectures` へ通常GETを1回行い、HTTP404 / Not Foundだった。人口GETは実施していない。権限・配備・Secret操作は行っていない。

画面側取得→既存Worker→固定上流のパス・GET・応答・値は合成応答の契約テストで照合した。429/502/503/504を画面の安全な取得失敗へ変換することも検証した。Workerの既存timeout/rate-limit検証は継続成功。上流の公式API仕様のorigin/パスとも照合した。

#57は未完了。承認済みの別配備作業で同一origin proxyが利用できた後、ブラウザー→Worker→指定APIによる47県、複数県・全4区分の年/人口値を実応答と照合し、実環境の失敗/retryを確認する必要がある。UI専用PreviewにSecretやAPIを追加しない。404からSecret設定状況を推測しない。
