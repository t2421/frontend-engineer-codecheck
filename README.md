# frontend-engineer-codecheck

Vue 3 / Vite / TypeScript の最小起動環境です。
依存導入前に[pnpmの短い運用手順](./docs/DEPENDENCY_SECURITY.md)を確認してください。

## ローカル起動

Node **24.16.0** と pnpm **12.8.1** を用意し、プロジェクトのルートで実行します。pnpm の実体を作業 shell の PATH に追加するか、以下の `pnpm` をその絶対パスに置き換えてください。global の Corepack/Yarn 設定を変更する必要はありません。

```sh
nvm use
node --version
pnpm --version
pnpm install --frozen-lockfile
pnpm dev
```

表示された localhost URL を開きます。`src/App.vue` を編集すると HMR で画面が更新されます。停止は Ctrl+C です。

```sh
pnpm build
pnpm preview
pnpm audit --audit-level=high
```

## 確認範囲と残課題

2026-10-06、Mac arm64 / Node 24.16.0 / pnpm 12.8.1 で、scripts 無効の frozen-lockfile 導入、別ディレクトリでの再現導入、Chrome の画面表示・HMR、Vite build を確認しました。

推移依存 source-map-js を1.2.2へ更新し、監査は既知の脆弱性0件でした。[GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) の修正を優先するため、ユーザー承認でこの版だけ7日待機の例外にしています。ダウンロードしたパッケージに、脆弱性を修正するコードが含まれていることを確認しました。全体の7日待機とscripts無効は維持しています。

**2026年10月7日23:08:10（JST）以降**は公開から7日が経つため、待機期間の例外設定を削除できます。`pnpm-workspace.yaml` の `minimumReleaseAgeExclude` を削除した後、frozen installと監査を再確認してください。更新後も別ディレクトリのfrozen install、Chrome表示・HMR、buildを再確認しました。他の依存版は変更していません。

## テスト

インストール済みのGoogle Chromeを使用します。Playwright用ブラウザの追加ダウンロードは不要です。

```sh
pnpm test
pnpm test:watch
pnpm test:e2e
```

`test`はVitestのnode単体テストとjsdomのVue Test Utilsテスト、`test:e2e`はChromeでの画面テストです。ブラウザテストは5175番で専用serverを自動起動・停止します。失敗時のtraceは`test-results`へ保存されます。

#15では、単体・部品・Chromeの各サンプルの期待値を意図的に誤らせて失敗を確認し、正しい期待値へ戻すと全3件が成功しました。TypeScriptは7.0.2を維持しています。品質チェックとCloudflare環境の追加手順は以下を参照してください。

## 品質チェック

pnpm checkでlint・CSS・整形・型を検査します。[実行手順と監査の残課題](./docs/QUALITY_CHECKS.md)を参照してください。Stylelint経由のbracesに未解消High 1件があり、監査には承認済みの当該GHSAだけの例外があります。

## Cloudflareのローカル実行

[新規チェックアウトからの手順と監査の残課題](./docs/WORKERS_SETUP.md)を参照してください。公式ViteプラグインでWorkerとStatic Assetsをbuild・previewします。Cloudflare依存を更新してundiciを修正し、sharpも経路を限定して修正版へ更新しています。Stylelint経由のbraces High 1件が未解消のため、全依存監査には承認済みの当該GHSAだけの例外があります。

## CI/CD

`Checks`はPRやmainの変更で、コード・テスト・build・依存の脆弱性を確認します。`Deploy production`はmainから手動で動かし、Checksがすべて成功したらCloudflareへ公開します。[公開に必要なSecrets・操作方法・失敗時の確認](./docs/CI_CD.md)を参照してください。

## Cloudflare環境とPR Preview

[本番・Previewのworkflow、Secretsの別作業、完了条件](./docs/CLOUDFLARE_ENVIRONMENT.md)を参照してください。Issue #27のRate Limitは本番公開承認待ちです。
