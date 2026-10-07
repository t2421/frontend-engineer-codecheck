# PRのUI確認用Preview

PRごとに `pr-番号` の固定URLを作り、push後に同じbotコメントを更新します。
fixtureがあるPRは確認ページ一覧、ないPRはアプリのUIを表示します。
確認ページは専用ビルドだけに含まれ、本番の `pnpm build` には追加されません。
URLを知っている人は閲覧できます。機密情報を確認ページに含めないでください。

| タイミング                     | 処理                                                                                  |
| ------------------------------ | ------------------------------------------------------------------------------------- |
| 同一repoのPR作成・push・再open | `Review assets` がSecretなしでVue UIをビルド                                          |
| ビルド成功                     | main側の `Publish review` が成果物だけをCloudflare Previewへ公開し、URLコメントを更新 |
| PR close・merge                | base側のコードで、そのPRのPreviewを削除                                               |

fork PRは公開対象外です。公開jobはPRコードをcheckout・実行せず、API・Secret・本番リソースbindingを設定しません。
PreviewのBase設定も `--ignore-base-config` で無視します。

## 導入と未完了の前提

このworkflowをmainへmerge後に有効になります。既存PRは次のpushで実行されます。
GitHub Secretsの登録は別タスクです。2026-10-06時点では未設定なので、CIからの自動公開・更新・削除は未検証です。

必要なrepository Secretsは `CLOUDFLARE_ACCOUNT_ID` と `CLOUDFLARE_API_TOKEN`。
accountは `81a92c0f86da67baab9e5ee38d840493`、Workerは `population-viewer`。
tokenはこのWorkerへのEditor権限を持つものを本人が用意します。値をIssueやログへ貼りません。
本番deployは別のPR #34にあるmain限定の手動workflowを使います。

失敗時は該当Actionsのログを確認して再実行してください。古いcommitやclosed PRのビルド結果は公開しません。
PR close時の削除が失敗した場合、同じcleanup jobを再実行するか、本人が `pnpm exec wrangler preview delete --config wrangler.review.jsonc --name pr-番号 --skip-confirmation` を実行します。

[Cloudflare Previews](https://developers.cloudflare.com/workers/previews/)・[公式Actions例](https://developers.cloudflare.com/workers/previews/examples/)
