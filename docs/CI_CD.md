# CI/CD

GitHub Actionsで変更を確認し、mainのアプリを必要なときだけCloudflareへ公開します。

| ワークフロー          | いつ動くか                                                                    | 何をするか                                                                                                                                                                             | 失敗したら                                                                                                                                                   |
| --------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Checks**            | PRの作成・更新・再開、mainへのpush、手動実行、Deploy productionからの呼び出し | コードの整形・lint・型、単体テスト、Chromeでの画面テスト、公開用buildを確認します。Wranglerのdry-runで配備できる構成か調べ、依存パッケージの脆弱性も監査します。実際の公開はしません。 | チェックが失敗します。Chromeテスト実行時は成功・失敗とも画面テストのHTML・axe JSON（失敗時traceを含む）、監査は成功・失敗ともテキストログを7日間保存します。 |
| **Deploy production** | mainを選んで手動実行したときだけ                                              | 同じcommitでChecksを実行し、品質・テスト・監査がすべて成功したら、アプリをbuildしてCloudflareへ公開します。                                                                            | Checksに失敗すると公開へ進みません。必須Secretsがない場合も公開前に停止します。main以外を選ぶと処理をskipします。                                            |

両ワークフローは共通のsetupで、リポジトリに指定したNodeとpnpmを用意し、lockfileどおりに依存を導入します。PRチェックには公開用のSecretsを渡しません。

## 手動で公開する

事前にGitHubの`production` environmentへ次のEnvironment secretsを設定します。API tokenは対象Workerの公開に必要な権限へ絞り、秘密値はリポジトリやログへ書きません。

- `CLOUDFLARE_API_TOKEN`：Cloudflareの公開用API token
- `CLOUDFLARE_ACCOUNT_ID`：公開先のCloudflare account ID

1. GitHubの **Actions → Deploy production → Run workflow** を開き、branchに **main** を選びます。
2. Checksが成功し、`production`の承認が必要な場合はその承認が済むと公開します。
3. 実行ログに出る公開URLで画面と深いSPA URLを確認します。現在のAPI proxyは未実装のため、`/api/*`の404は想定どおりです。

本番は手動公開です。PRのUI Previewは[PR #43](https://github.com/t2421/frontend-engineer-codecheck/pull/43)の専用workflowで扱います（#43のmerge後に有効）。[環境設定・Secrets別作業・公開の完了条件](./CLOUDFLARE_ENVIRONMENT.md)を参照してください。人口APIのキーは公開用tokenとは別のWorker Secretとして扱います。

## 監査の既知の例外

Stylelint経由のbraces High **GHSA-vfj7-8cjw-p6xm**だけを、承認済みの`audit.ignore`で例外にしています。通常の依存更新で解消できず、固定lintパターンに限定してリスクを受容したためです。脆弱性は未解消で、ログには`1 ignored: 1 high`と表示されます。

管理者は`t2421`、見直し日は**2026-10-14**です。修正版や依存経路を確認し、解消後に例外を削除します。ほかの脆弱性や監査の通信失敗はチェックを失敗させ、公開も止めます。詳しいリスクは[品質チェック](./QUALITY_CHECKS.md)を参照してください。

## 失敗を確認・再実行する

Actionsの失敗したstepのログを確認します。画面テストは`playwright-results`、監査は`dependency-audit`のartifactも使えます。修正はPRへpushすると再チェックされます。同じcommitをやり直す場合は対象runの **Re-run failed jobs** または **Re-run all jobs** を選びます。公開をやり直す場合はDeploy productionをmainから改めて実行します。

## アクセシビリティ自動検査

PRごとの`pnpm test:e2e`にaxeによるWCAG A・AA検査を含み、違反があればChecksを失敗させます。判定不能の`incomplete`もJSONへ保存して手動確認します。対象状態・追加手順・手動確認の残件は[アクセシビリティ検査](./ACCESSIBILITY.md)を参照してください。
