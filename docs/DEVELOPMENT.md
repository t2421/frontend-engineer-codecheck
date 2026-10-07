# 開発・検証

## 起動と閲覧

Node / pnpmは[package.json](../package.json)・[.nvmrc](../.nvmrc)の固定版、ブラウザはGoogle Chromeを使用します。[依存管理](./DEPENDENCY_SECURITY.md)に従い、repoのルートで実行します。

```sh
nvm use
pnpm install --frozen-lockfile
pnpm dev
```

表示された`http://127.0.0.1:ポート番号`を開きます。Vue編集はHMRで反映され、Ctrl+Cで停止します。ポート競合時は`pnpm dev --port 5176 --strictPort`を指定できます。

実APIを使う場合はgitignore対象の`.dev.vars`へ本人が`YUMEMI_API_KEY`を設定します。`VITE_*`や公開varsへ入れず、値をチャット・ログ・コマンド引数へ出しません。未設定でもbuildとモックテストは可能で、APIは503です。[API契約](./API_PROXY.md)を参照してください。

## 検証の入口

| コマンド             | 確認すること                                                                                          |
| -------------------- | ----------------------------------------------------------------------------------------------------- |
| `pnpm check`         | lint・CSS・整形・型                                                                                   |
| `pnpm test`          | 単体・Vue部品・CIスクリプト                                                                           |
| `pnpm test:coverage` | `src/**`の行・関数・分岐・文の各80%閾値（[設定](../vitest.config.ts)）。通常test/CIでは自動実行しない |
| `pnpm test:e2e`      | Chromeの操作・Canvas・axe                                                                             |
| `pnpm build`         | SPA / Worker build                                                                                    |
| `pnpm audit`         | 全severity監査。例外は[依存管理](./DEPENDENCY_SECURITY.md)を確認                                      |

`pnpm test:watch`でVitestを継続実行、`pnpm format`で整形できます。個別コマンドは[package.json](../package.json)を参照してください。

Chromeテストは専用serverを自動起動・停止します。ローカルでは既存Chromeを使い、追加browser downloadは不要です。ポート・trace・reporterは[Playwright設定](../playwright.config.ts)で管理します。HTMLレポートは`pnpm test:e2e --reporter=list,html`の後、`pnpm exec playwright show-report`で開きます。[a11y手動確認](./ACCESSIBILITY.md)も行ってください。

## ローカルpreview

`pnpm build`の後に`pnpm preview`を実行し、表示された127.0.0.1のURLを開きます。ビルド済みWorkerと画面をworkerdで実行します。配備構成の確認は次のdry-runを使います。

```sh
pnpm exec wrangler deploy --dry-run --config dist/population_viewer/wrangler.json
```

部品fixtureは開発serverの`/tests/preview/対象.html`で開きます（例：`/tests/preview/app-integration.html`）。一覧は[tests/preview](../tests/preview/README.md)。合成データ・routeモックは実API成功を証明しません。

静的UI Previewのbuild確認は`node .github/scripts/build-review.mjs`、閲覧は次を実行して`http://127.0.0.1:4173/`を開きます。部品fixtureは公開対象外です。[CI/CD](./CI_CD.md)を参照してください。

```sh
python3 -m http.server 4173 --bind 127.0.0.1 --directory dist-review
```
