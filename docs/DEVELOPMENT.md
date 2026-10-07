# 開発・検証手順

## 起動

Node **24.16.0** / pnpm **12.8.1** / Git / Google Chromeを使用します。pnpmは作業shellのPATHに置きます。globalのCorepack/Yarn設定変更は不要です。[依存管理](./DEPENDENCY_SECURITY.md)も確認してください。

```sh
git clone https://github.com/t2421/frontend-engineer-codecheck.git
cd frontend-engineer-codecheck
nvm use
node --version
pnpm --version
pnpm install --frozen-lockfile
pnpm dev
```

表示されたURLをChromeで開きます。Vue編集はHMRで反映され、Ctrl+Cで停止します。ポート競合時は`pnpm dev --port 5176 --strictPort`を使用できます。

実APIを使う場合は本人がgitignore対象の`.dev.vars`へ`YUMEMI_API_KEY`を設定します。値をチャット・ログ・コマンド引数へ貼らず、`VITE_*`や公開varsには入れません。設定なしでもbuild・静的配信・モックテストは可能で、ローカルAPIは503を返します。[API契約](./API_PROXY.md)と[Secrets](./CLOUDFLARE_ENVIRONMENT.md)を参照してください。

## テストと品質チェック

```sh
pnpm check
pnpm test
pnpm test:e2e
pnpm build
pnpm exec wrangler deploy --dry-run --config dist/population_viewer/wrangler.json
pnpm audit
```

| コマンド             | 内容                                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------ |
| `pnpm check`         | ESLint・Stylelint・Prettier・vue-tsc（個別に`lint`・`lint:styles`・`format:check`・`typecheck`） |
| `pnpm format`        | 整形を適用。変更差分を確認する                                                                   |
| `pnpm test`          | Vitestの単体・Vue部品テストと`test:review`のCIスクリプトテスト                                   |
| `pnpm test:watch`    | Vitestのwatch実行                                                                                |
| `pnpm test:e2e`      | 既存Google Chromeで画面操作・Canvas・axe検査                                                     |
| `pnpm build`         | `dist/client`と`dist/population_viewer`へ画面・Workerをbuild                                     |
| Wrangler `--dry-run` | 配備構成を検証。本番公開は行わない                                                               |
| `pnpm audit`         | 全severityの監査。承認済み例外は[依存管理](./DEPENDENCY_SECURITY.md)で確認                       |

Chromeテストは5175番で専用serverを自動起動・停止し、既存serverを再利用しません。ローカルではPlaywright用ブラウザの追加downloadは不要です。失敗時traceは`test-results/`へ保存します。HTMLレポートは`pnpm test:e2e --reporter=list,html`の後、`pnpm exec playwright show-report`で開きます。

テストのrouteモック・合成loaderは実API疎通を証明しません。`tests/preview/`の部品ページはローカル・CI専用で、Preview・本番buildには含めません。追加・変更機能のロジック、操作、失敗/retry、遅延応答を検証し、Chart.jsの描画はjsdomのstubと実Chromeを区別します。[a11yの手動確認](./ACCESSIBILITY.md)も行います。

## ローカルpreview

```sh
pnpm build
pnpm preview
```

ビルド済みWorkerとStatic Assetsをworkerdで実行します。停止はCtrl+C、ポート競合時は`pnpm preview --port 4175 --strictPort`。SPAの深いURLもindex.htmlへfallbackし、`/api/*`はWorkerが処理します。ローカルpreview、PRの静的UI Preview、本番deployの違いは[CI/CD](./CI_CD.md)を参照してください。
