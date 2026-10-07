# API契約

画面から同一オリジンのGETを要求し、Workerが[指定API](https://github.com/yumemi-inc/frontend-engineer-codecheck/blob/main/docs/api.md)へ中継します。

| パス                                     | query                                   |
| ---------------------------------------- | --------------------------------------- |
| `/api/v1/prefectures`                    | なし                                    |
| `/api/v1/population/composition/perYear` | `prefCode`必須、1〜47の正規十進表記のみ |

転送先は`https://frontend-engineer-codecheck-api.mirai.yumemi.io`の同じパスに固定します。任意URL・未知query・重複県コード・末尾スラッシュを拒否し、redirectは追いません。上流へはWorker Secret `YUMEMI_API_KEY`を`X-API-KEY`として、固定の`User-Agent: population-viewer-proxy`と共に送ります。ブラウザの認証header・Cookieは転送しません。

## 応答と失敗

成功は200と公式envelope `{ "message": null, "result": ... }`。人口の年・人数・区分・rateを保持します。Workerは安全なenvelopeを検証し、画面側は一覧・4区分・年・人数などの業務データを検証します。応答はJSON、`Cache-Control: no-store`です。

失敗は`{ "error": "固定コード" }`を返し、上流の本文・header・例外を公開しません。

| status / error            | 意味                                               |
| ------------------------- | -------------------------------------------------- |
| 400 `INVALID_REQUEST`     | 不正query                                          |
| 404 `NOT_FOUND`           | 未知APIパス                                        |
| 405 `METHOD_NOT_ALLOWED`  | GET以外（`Allow: GET`）                            |
| 429 `RATE_LIMITED`        | 制限超過。上流を呼ばず`Retry-After`を返す          |
| 503 `SERVICE_UNAVAILABLE` | Secret・Cloudflare IP不足、制限bindingの失敗       |
| 502 `UPSTREAM_ERROR`      | 上流HTTP失敗、通信・JSON・envelope不正、Secret反射 |
| 504 `UPSTREAM_TIMEOUT`    | 上流の接続・本文読取がtimeout                      |

`/api/*`には両API共通のIP制限を要求検証より先に適用します。Cloudflareの`CF-Connecting-IP`を使い、`X-Forwarded-For`は信用しません。静的UIは対象外です。上限は[wrangler.jsonc](../wrangler.jsonc)、timeout等は[Worker設定](../worker/config.ts)を正本とします。制限は拠点ごとの近似値で、共有IP・日次枠・上流割当量への影響を実環境で確認します。[公式binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)も参照してください。

画面側は本文読取を含む15秒timeoutで、固定文言の取得失敗と手動の再読み込みを表示します。自動retryは行いません。人口の再試行は選択中の失敗県が対象で、成功済みデータと選択を保持します。

## 診断とSecrets

上流失敗ログは固定分類`code`、数値`status`、分類済み`responseType`、booleanの`challenge`だけです。Secret・IP・生の本文/header・例外は記録しません。これらの分類から上流のWAF内部設定を断定しません。[実装](../worker/index.ts)を参照してください。

Secretの設定先と公開時の扱いは[CI/CD](./CI_CD.md#secrets)に、ローカル接続は[開発手順](./DEVELOPMENT.md)にまとめています。モックの成功を実API疎通・値の一致・実環境のRate Limit検証とは扱いません。
