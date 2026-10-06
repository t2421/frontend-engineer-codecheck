# 技術選定 ADR

## 目的

[PRD](./PRD.md)の一画面SPAを、実務経験のある技術で品質と開発速度を確保して実現する。[Issue #2](https://github.com/t2421/frontend-engineer-codecheck/issues/2)で決定した採用技術と判断理由を記録する。

## 採用技術と理由

| 対象 | 決定と理由 |
| --- | --- |
| 画面 | [Vue 3 + Vite](https://vuejs.org/guide/quick-start.html) + TypeScript。Vueの実務経験を生かし、学習・調査の不確実性を減らす。PRDにSSR要件はなく、一画面SPAに適する。 |
| グラフ | Chart.js単体。複数の折れ線とレスポンシブ表示を満たし、MITライセンスで利用できる。依存を抑えるためVueラッパーは使わず、小さな自前コンポーネントで[生成・更新・破棄](https://www.chartjs.org/docs/latest/developers/api.html)を管理する。 |
| 状態管理 | Vueのref・computed・composable。一画面の規模に合わせ、Piniaは追加しない。 |
| テスト | [Vitest + Vue Test Utils + Playwright](https://vuejs.org/guide/scaling-up/testing.html)。TDDで進め、ロジック・部品と実ブラウザでの操作を検証する。APIモックは各テストツールの標準機能を使い、追加モックライブラリは導入しない。 |
| 品質 | ESLint（eslint-plugin-vue）・Prettier・Stylelint・vue-tsc。Vue・スタイル・整形を確認し、型チェックはテストとは別に実行する。 |
| 公開・API中継 | [Cloudflare Workers Static Assets + 公式Viteプラグイン](https://developers.cloudflare.com/workers/framework-guides/web-apps/vue/)。静的SPAと小さなfetch API中継に限定した構成。公式Viteプラグインで開発・本番のWorker実行環境を揃えやすく、Static AssetsとAPIを同じWorkerへ配備できる。 |

API中継は都道府県一覧・人口構成のGET 2本に限定し、転送先を固定する。APIキーは実行時にWorker Secretsへ保持し、CIから設定する場合はGitHub Secretsを利用する。ブラウザには渡さない。

## 比較して見送った選択肢

- Nuxt：今回SSRは不要で、フレームワーク固有の規約を増やす利点が小さい。React：今回はVueの実務経験を優先する。
- ECharts：高度な機能は今回不要。Recharts：React依存を混在させる負担がある。Highcharts：ライセンス確認の負担を避ける。
- Jest：既存資産がなく、Vite構成と設定の親和性からVitestを選ぶ。Cypress：Playwrightでブラウザ自動化を担い、重複導入しない。AIによるブラウザ操作・テスト作成・失敗調査を、[Playwrightの公式CLI/MCPやTestの仕組み](https://playwright.dev/docs/test-agents)に揃えられる点を評価した。[CypressにもAI支援](https://docs.cypress.io/app/ai/overview)があり、AI性能の優位性を理由にした選定ではない。
- ブラウザからの直接API接続：APIキーが配信物や通信から見えるため、Workerで中継する。
- Biome：選定時の[公式対応表](https://biomejs.dev/introduction/language-support/)でVue対応はexperimentalのため、今回は見送る。
- [Firebase Hosting + Functions](https://firebase.google.com/docs/hosting/functions)：同じ機能を実現でき、一括デプロイも可能。ただしHostingのrewritesとFunctionsの接続・管理が加わる。今回はAuth・DBを使わず、SPAと小さなAPI中継を同じWorkerへ配備できる構成を優先する。
- Storybook：今回の一画面実装では、必要以上に構成が複雑になるため導入しない。共通コンポーネントの品質はテストと画面確認で担保する。

## ライセンス

採用ツール本体の公式LICENSEを確認した。

- MIT：[Vue](https://github.com/vuejs/core/blob/main/LICENSE)、[Vite](https://github.com/vitejs/vite/blob/main/LICENSE)、[Chart.js](https://github.com/chartjs/Chart.js/blob/master/LICENSE.md)、[Vitest](https://github.com/vitest-dev/vitest/blob/main/LICENSE)、[Vue Test Utils](https://github.com/vuejs/test-utils/blob/main/LICENSE)。
- MIT：[ESLint](https://github.com/eslint/eslint/blob/main/LICENSE)、[eslint-plugin-vue](https://github.com/vuejs/eslint-plugin-vue/blob/master/LICENSE)、[Prettier](https://github.com/prettier/prettier/blob/main/LICENSE)、[Stylelint](https://github.com/stylelint/stylelint/blob/main/LICENSE)、[vue-tsc](https://github.com/vuejs/language-tools/blob/master/LICENSE)。
- Apache-2.0：[TypeScript](https://github.com/microsoft/TypeScript/blob/main/LICENSE.txt)、[Playwright](https://github.com/microsoft/playwright/blob/main/LICENSE)。
- Cloudflare Viteプラグイン：[公式package.json](https://github.com/cloudflare/workers-sdk/blob/main/packages/vite-plugin-cloudflare/package.json)の宣言はMITで、リポジトリの[LICENSE-MIT](https://github.com/cloudflare/workers-sdk/blob/main/LICENSE-MIT)も確認した。

## トレードオフと検証

- Vueラッパーを使わない分、Chart.jsのライフサイクル管理を自前で担う。Canvas描画の成功はjsdomで判定せず、実ブラウザで確認する。
- WorkersはNode.jsと完全互換ではなく、無料枠にも上限がある。利用APIの互換性と利用量を確認する。
- APIキーを秘匿しても、公開中継APIの悪用防御が自動的に保証されるわけではない。公開時には中継範囲とアクセス制御を検討する。

GitHub ActionsによるPRチェック・デプロイは[Issue #12](https://github.com/t2421/frontend-engineer-codecheck/issues/12)で実装する。具体的なトリガーはそこで決める。
