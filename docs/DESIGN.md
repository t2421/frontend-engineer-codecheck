# 人口推移アプリ Design Doc

## 目的と範囲

[PRD](./PRD.md)の利用体験を、状態の整合性と変更しやすさを保って実現するための実装方針。技術選定は[ADR](./ADR.md)、画面の参照先は[デザインリンク](./DESIGN_LINKS.md)に従う。本書は設計を示し、実装済みの機能を示すものではない。

対象は都道府県選択、人口区分切替、推移グラフ、読み込み・失敗・再試行。一画面の規模に合わせ、認証・DB・SSR・大きな状態管理基盤は設けない。

## 全体構成

```mermaid
flowchart LR
  UI[Vue SPA] -->|同一オリジン・GET 2本| W[API Proxy]
  W -->|固定転送先・APIキー付与| API[API]
  A[Workers Static Assets] -->|画面配信| UI
```

Vue 3・Vite・TypeScriptの画面とAPI中継を、公式Viteプラグインを使うWorkers構成で扱う。依存は必要なものに絞り、Pinia・Chart.jsのVueラッパー・Storybookは追加しない。依存導入はpnpm 12.8.1と[既存の依存管理方針](./DEPENDENCY_SECURITY.md)に従う。

## 役割と扱うデータ

| 役割 | 担うこと |
| --- | --- |
| 汎用UI | チェックボックス、区分切替、案内・再試行などの表示と操作通知。取得処理や人口の業務判断を持たない。 |
| 選択と読み込みの管理 | 選択県・人口区分・読み込みや失敗の状態を管理し、操作に応じてデータ取得と表示更新を行うVue composable。 |
| API取得（画面側） | API Proxyへデータを要求し、応答を検証して、人口データやエラーを画面で扱いやすい形へ整える。 |
| API Proxy | 許可した要求だけを指定APIへ送り、APIキーの付与や安全なエラー応答を担う。 |
| グラフ用データの作成 | 選択県・人口区分・取得済みの人口データから、グラフに渡すデータを作る。通信や描画は行わず、単独で検証できる。 |
| グラフの描画・更新 | 小さなコンポーネントでChart.jsのグラフを生成・更新・破棄する。渡されたグラフ用データを表示し、選択や通信は管理しない。 |

## 状態と更新の方針

- 選択県のコード集合と人口区分を表示対象の唯一の正本にする。取得済みデータと取得状態は別に管理し、グラフ・件数・案内はcomputedで導出する。UIやChart.js側に同じ選択状態を複製しない。
- 初期状態は県未選択・総人口。区分変更では県を維持し、全解除では区分を維持する。県が未選択ならグラフ領域に「都道府県を選択すると、人口の推移を確認できます」を表示する。
- 人口構成の取得結果は県コード単位で画面滞在中に再利用する。同じ取得を重複させず、区分変更だけで再取得しない。永続化や複雑なキャッシュ基盤は設けない。
- 選択解除後に応答が届いても選択集合を書き換えない。最新の要求に対応する応答だけが取得状態を更新し、グラフは常に現在の選択集合から導出する。連続操作・再試行で古い応答が新しい状態を上書きすることを防ぐ。
- 一覧取得中は操作できないスケルトンを表示。人口取得中・取得失敗を識別できる表示と再試行を用意し、成功後は一覧またはグラフへ戻す。部分失敗専用の表示・再試行方式は要件として追加しない。

## 主要処理のシーケンス

図はユーザー・Webアプリ・API Proxy・APIのやり取りを示す。アプリ内部の処理は自己メッセージにまとめ、実装の役割分担は上の表に示す。

### 初期表示と都道府県一覧取得

```mermaid
sequenceDiagram
  actor User as ユーザー
  participant App as Webアプリ
  participant Proxy as API Proxy
  participant API as API
  User->>App: 画面を開く
  App->>App: 県未選択・総人口で初期化
  App-->>User: 選択案内・一覧読み込み中のスケルトン
  App->>Proxy: 都道府県一覧GET
  Proxy->>API: APIキーを付けて中継
  API-->>Proxy: 都道府県一覧
  Proxy-->>App: 一覧応答
  App->>App: 応答を検証し、一覧と読み込み状態を更新
  App-->>User: チェックボックスを表示（県は自動選択しない）
```

### 都道府県選択・取得再利用・解除

```mermaid
sequenceDiagram
  actor User as ユーザー
  participant App as Webアプリ
  participant Proxy as API Proxy
  participant API as API
  User->>App: 県を選択
  App->>App: 選択県を更新（同じ取得は重複しない）
  alt 取得済みデータあり
    App->>App: 現在の選択県・区分でグラフを更新
  else 未取得
    App-->>User: 人口読み込み中
    App->>Proxy: 人口構成GET（県コード）
    Proxy->>API: APIキーを付けて中継
    opt 応答前に選択解除
      User->>App: 県を解除
      App->>App: 選択県から除外し、表示を更新
      Note over App: 全解除時は区分維持・選択案内
    end
    API-->>Proxy: 人口構成
    Proxy-->>App: 人口応答
    App->>App: 応答を検証し、最新の要求だけ反映
    App->>App: 現在の選択県・区分でグラフを更新
  end
  Note over App: 解除した県は描画対象に戻さない
```

### 人口区分の切替

```mermaid
sequenceDiagram
  actor User as ユーザー
  participant App as Webアプリ
  User->>App: 人口区分を切り替える
  App->>App: 区分を更新（選択県は維持）
  App->>App: 取得済みデータでグラフを更新（再取得しない）
  App-->>User: 新しい区分のグラフ、未選択なら選択案内
  Note over App: 取得中のデータも到着時点の区分で表示
```

### 取得失敗と再試行

```mermaid
sequenceDiagram
  actor User as ユーザー
  participant App as Webアプリ
  participant Proxy as API Proxy
  participant API as API
  App->>Proxy: 一覧または人口構成GET
  Proxy->>API: 許可した要求を中継
  API-->>Proxy: エラーまたはタイムアウト
  Proxy-->>App: 安全なエラー応答
  App-->>User: 読み込み終了・失敗表示・再試行操作
  User->>App: 再試行
  App-->>User: 読み込み中
  App->>Proxy: 対象データを再取得
  Proxy->>API: 許可した要求を中継
  alt 成功
    API-->>Proxy: データ
    Proxy-->>App: データ応答
    App->>App: 応答を検証し、最新の要求だけ反映
    App-->>User: 読み込み終了・現在の選択に対応する一覧またはグラフ
  else 再び失敗
    API-->>Proxy: エラーまたはタイムアウト
    Proxy-->>App: 安全なエラー応答
    App-->>User: 読み込み終了・失敗表示・再試行操作
  end
```

## API Proxyとセキュリティ

API ProxyはCloudflare Worker上で動作し、中継は都道府県一覧と人口構成の固定GET 2本に限定する。メソッド・パス・県コードを検証し、任意URL・不要なパラメータ・ブラウザからの認証ヘッダーを転送しない。上流への通信にはタイムアウトを設け、失敗を画面が扱えるエラーへ変換する。上流の内部情報や秘密値をレスポンス・ログへ出さない。

APIキーは実行時にWorker Secretsへ保持し、CIから設定する場合はGitHub Secretsを利用する。画面の配信物には含めない。公開中継の悪用対策は秘密値の保管とは別に扱い、公開前にアクセス制御・利用量制限を確認する。CI・配備の具体的なトリガーはIssue #12で扱う。

API中継はIP単位で10秒200回を暫定上限とし、超過を検出した場合は上流APIを呼ばず429を返す。[Cloudflare Rate Limiting binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)は拠点ごとの近似制限であり、厳密な全拠点合計の割当量や費用上限を保証しない。通常の47県選択への影響、共有IPの利用者への影響、上流APIの制限を公開前に確認する。

## 表示と操作

PC・タブレット・スマートフォンで領域の配置とグラフサイズを調整し、固定画面を縮小するだけにしない。47県まで選べる前提で、凡例・操作部品の折返しと連続操作時の読みやすさを確認する。県と線の対応を安定させ、色だけに頼らず名称でも識別できるようにする。

操作にはラベルとキーボード操作を備え、選択・展開・失敗などの状態をテキストでも伝える。Chart.jsのCanvasには説明を付け、人口区分と県・線の対応を画面側でも示す。

## 検証方針

TDDで、グラフ用データの作成・API取得（画面側）・API Proxy・選択と読み込みの管理をVitest、部品の操作と表示をVue Test Utilsで検証する。標準機能のAPIモックを使い、正常・失敗・再試行に加え、解除後の遅延応答と区分切替時の選択維持を確認する。

PlaywrightとGoogle Chrome最新版で、PRDの操作、各画面幅、Chart.jsの実描画・更新・破棄を確認する。jsdomでCanvas描画成功を判定しない。実APIとの契約一致はモックとは別に確認する。ESLint・Prettier・Stylelintとvue-tscの型チェックも実行する。

## レビューで確認したい点

- 汎用UI・選択と読み込みの管理・API取得（画面側）・API Proxy・グラフ用データの作成・描画更新という役割分担で、一画面に対して過剰な構成になっていないか。
- 選択状態を正本とし、画面滞在中の取得結果を再利用する方針で、連続操作時もPRDの振る舞いを維持できるか。

参考：[Vueの状態管理](https://vuejs.org/guide/scaling-up/state-management.html)、[composable](https://vuejs.org/guide/reusability/composables.html)、[Chart.js API](https://www.chartjs.org/docs/latest/developers/api.html)、[Workersの推奨事項](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/)。
