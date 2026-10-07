# Cloudflare環境とSecrets

Worker名は`population-viewer`。本番URLは <https://population-viewer.t2421-loop.workers.dev>。本番設定は`wrangler.jsonc`、静的UI Previewは`wrangler.review.jsonc`を使用します。[workflowと公開手順](./CI_CD.md)を参照してください。

## 設定名と安全な扱い

| 設定場所                                | 名前                                            | 用途                     |
| --------------------------------------- | ----------------------------------------------- | ------------------------ |
| GitHub `production` environment Secrets | `CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID` | 本番deploy・metadata診断 |
| GitHub repository Secrets               | `CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID` | Preview公開・削除        |
| 本番Worker Secret                       | `YUMEMI_API_KEY`                                | 指定上流APIへの認証      |
| gitignore対象のローカル`.dev.vars`      | `YUMEMI_API_KEY`                                | ローカルの実API接続      |

Cloudflare tokenは対象Workerの公開に必要な権限へ限定し、[公式権限](https://developers.cloudflare.com/workers/authorization/workers/)に従います。production environmentのmain制限・reviewer・tokenの有効期間を設定し、既存OAuthをCIへ転用しません。

秘密値をrepo・チャット・Issue・ログ・コマンド引数へ出さず、`VITE_*`や公開varsに入れません。APIキーはWorkerの実行時envで読み、上流へだけ送信します。UI専用PreviewにはAPIキー・API・本番bindingを追加しません。未設定でもbuildは可能です。

APIキー登録は`pnpm exec wrangler secret put YUMEMI_API_KEY`の対話入力を使用できます。Secret操作が即時公開を伴う可能性があるため、[公式手順](https://developers.cloudflare.com/workers/configuration/secrets/)と対象Workerを確認して実施します。[API仕様](./API_PROXY.md)も参照してください。

## API制限

`API_RATE_LIMITER`はnamespace `27001`、両API共通のCloudflare `CF-Connecting-IP`キーで200回/10秒を制限します。拒否時は上流を呼ばず429と`Retry-After: 10`、IP不足・binding失敗は503。IPはログへ出しません。静的UIは制限対象外です。

[Rate Limiting binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)は拠点ごとの近似カウンタです。共有IPへの影響、47県選択、上流割当量を実環境で確認します。同じnamespaceを他Workerへ使うとカウンタを共有します。日次枠や費用上限は保証しません。

Workersはプランの実行数・CPU・subrequest・接続数・メモリ制限を持ち、APIはWorker実行枠を使用します。配備時に[公式limits](https://developers.cloudflare.com/workers/platform/limits/)と[料金](https://developers.cloudflare.com/workers/platform/pricing/)を確認してください。
