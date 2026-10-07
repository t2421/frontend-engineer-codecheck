# 開発・検証

## 起動と閲覧

Node.js **24.16.0**とpnpm **12.8.1**、Google Chromeを使います。準備できたら、プロジェクトのフォルダで以下を実行します。

```sh
pnpm install --frozen-lockfile
```

実APIを使うには、次の手順でAPIキーを設定します。

1. [公式APIドキュメントの「APIキーの設定について」](https://github.com/yumemi-inc/frontend-engineer-codecheck/blob/main/docs/api.md#-api-キーの設定について)でキーを確認します。
2. プロジェクト直下（`package.json`と同じフォルダ）に`.dev.vars`を作り、次の例の`取得したAPIキー`を本人が置き換えて保存します。

   ```dotenv
   YUMEMI_API_KEY="取得したAPIキー"
   ```

3. 以下で開発サーバーを起動します。起動中にキーを変更した場合は、Ctrl+Cで停止して起動し直します。

   ```sh
   pnpm dev
   ```

`.dev.vars`はgitignore対象です。コミットせず、キーを`VITE_*`や公開vars、チャット・ログ・コマンド引数へ入れないでください。キーが未設定の場合、実APIからデータを取得できずAPIは503になります。buildやモックテストにはキーは不要です。[API契約](./API_PROXY.md)も参照してください。

表示された`http://127.0.0.1:ポート番号`を開きます。Vueファイルを編集すると画面に反映され、Ctrl+Cで停止します。ポート競合時は`pnpm dev --port 5176 --strictPort`を指定できます。

## 検証の入口

| コマンド             | 確認すること                                                                                          |
| -------------------- | ----------------------------------------------------------------------------------------------------- |
| `pnpm check`         | lint・CSS・整形・型                                                                                   |
| `pnpm test`          | 単体・Vue部品・CIスクリプト                                                                           |
| `pnpm test:coverage` | テストのカバー率を確認（各項目80%以上）。[設定](../vitest.config.ts)を参照。通常のtest/CIとは別に実行 |
| `pnpm test:e2e`      | Chromeの操作・Canvas・axe                                                                             |
| `pnpm build`         | SPA / Worker build                                                                                    |
| `pnpm audit`         | 依存パッケージの脆弱性を確認。例外は[依存管理](./DEPENDENCY_SECURITY.md)を確認                        |

`pnpm test:watch`でVitestを継続実行、`pnpm format`で整形できます。個別コマンドは[package.json](../package.json)を参照してください。

画面テストは専用サーバーを自動で起動・停止し、インストール済みのChromeを使います。詳細は[Playwright設定](../playwright.config.ts)を参照してください。HTMLレポートは`pnpm test:e2e --reporter=list,html`の後、`pnpm exec playwright show-report`で開きます。[a11y手動確認](./ACCESSIBILITY.md)も行ってください。実装とテストの書き方は[開発ガイドライン](./GUIDELINES.md)に従います。

## ローカルpreview

`pnpm build`の後に`pnpm preview`を実行し、表示された127.0.0.1のURLを開きます。ビルドした画面とWorkerをローカルで動かします。公開せずに配備の設定だけ確認する場合は、次を実行します。

```sh
pnpm exec wrangler deploy --dry-run --config dist/population_viewer/wrangler.json
```

部品の確認ページは開発サーバーの`/tests/preview/対象.html`で開きます（例：`/tests/preview/app-integration.html`）。一覧は[tests/preview](../tests/preview/README.md)。テスト用データを使った確認と、実APIの動作確認は別です。

PR用の画面だけのPreviewを確認するには`node .github/scripts/build-review.mjs`、閲覧は次を実行して`http://127.0.0.1:4173/`を開きます。部品fixtureは公開対象外です。[CI/CD](./CI_CD.md)を参照してください。

```sh
python3 -m http.server 4173 --bind 127.0.0.1 --directory dist-review
```
