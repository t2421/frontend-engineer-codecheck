# CI/CDと公開

## workflow

| workflow                                                  | 入口と役割                                                                  |
| --------------------------------------------------------- | --------------------------------------------------------------------------- |
| [Checks](../.github/workflows/checks.yml)                 | PR・main push・手動・workflow呼出し。品質・テスト・build・配備dry-run・監査 |
| [Review assets](../.github/workflows/review-build.yml)    | 同一repoのPR更新。Secretなしで静的UIをbuild                                 |
| [Publish review](../.github/workflows/review-publish.yml) | Review assets成功後にPreview公開・コメント更新。PR close/merge時に削除      |
| [Deploy production](../.github/workflows/deploy.yml)      | mainを選ぶ手動実行。同じcommitでChecksを呼び直し、その完了を待って本番公開  |

PRの導入・build/testへ公開Secretsを渡しません。監査の未承認指摘・通信失敗はChecksと本番公開を止めます。ブラウザstepが実行された場合だけPlaywright/axe成果物を保存し、skip・取消時は保存しません。保持期間や再試行の詳細はworkflowを参照してください。

## PR Preview

PreviewはPRの静的UIと、信頼するmain由来の[API転送Worker](../worker/review.ts)を公開します。転送先は公開済み本番の2つのGET APIに限定し、PreviewにはSecrets・本番binding・部品fixtureを含めません。ブラウザの認証情報やIPヘッダーは転送せず、本番APIの利用量・IP制限を使用します（本番から見えるIPによって複数Previewの枠が共有される場合があります）。PRのバックエンド変更は検証対象外です。URLを知る人が閲覧できます。公開jobは信頼するmainコードで成果物をデータとして扱い、PRコードをcheckout・実行しません。fork PR・古いhead・closed PRは公開対象外です。

対象SHAのHTMLへの到達を確認し、一時的な通信失敗・一部HTTPエラーは同じURLで再試行します。期限内に200 HTMLを確認できなければ失敗とし、別SHAへfallbackしません。[readinessの実装](../.github/scripts/preview-readiness.mjs)が詳細の正本です。

`performance-comment` jobがrootのPreview URLとSHA別URLの参考性能コメントを更新します。LighthouseのPC/mobile各3回の中央値を表示し、欠損・未完了は判定不可。静的UIのラボ値で、mergeをブロックせず、実ユーザー評価・操作時INP・実API待ちとは区別します。指標・条件はコメントと[計測実装](../.github/scripts/review-performance.mjs)に記載します。

close時の削除失敗はcleanup jobを再実行します。設定は[wrangler.review.jsonc](../wrangler.review.jsonc)、ローカル閲覧は[開発手順](./DEVELOPMENT.md)を参照してください。

## 本番公開

Workerは`population-viewer`、本番URLは <https://population-viewer.t2421-loop.workers.dev>。本番設定は[wrangler.jsonc](../wrangler.jsonc)です。

Actions → **Deploy production → Run workflow**で**main**を選びます。再実行したChecksの成功、production environmentの保護設定、必要Secretsを満たしてから公開します。公開後は画面・深いSPA URL・APIの実データと失敗/retry・利用量制限を確認します。dry-runやUI Previewだけでは完了としません。

失敗stepとartifactを確認し、修正pushまたは対象runの**Re-run failed jobs / Re-run all jobs**で再確認します。

## Secrets

| 設定先                               | 名前・用途                                                 |
| ------------------------------------ | ---------------------------------------------------------- |
| GitHub `production` environment      | `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID`：本番公開 |
| GitHub repository Secrets            | 同じ2名：Preview公開・削除                                 |
| Worker Secret                        | `YUMEMI_API_KEY`：上流API認証                              |
| ローカル`.dev.vars`（gitignore対象） | `YUMEMI_API_KEY`：ローカル実API                            |

tokenは対象Workerに必要な[権限](https://developers.cloudflare.com/workers/authorization/workers/)へ限定し、productionのmain制限・reviewer・有効期間を設定します。秘密値をrepo・チャット・ログ・コマンド引数・`VITE_*`へ出さず、既存OAuthをCIへ転用しません。

Worker Secretは`pnpm exec wrangler secret put YUMEMI_API_KEY`の対話入力で設定できます。即時公開を伴う可能性があるため[公式手順](https://developers.cloudflare.com/workers/configuration/secrets/)と対象を確認してください。配備時には[プランの制限](https://developers.cloudflare.com/workers/platform/limits/)と[料金](https://developers.cloudflare.com/workers/platform/pricing/)も確認します。
