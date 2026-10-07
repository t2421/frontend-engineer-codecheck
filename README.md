# 都道府県別人口推移ビューア

指定APIの都道府県・人口データを、県と人口区分を選んで比較するVue 3 / TypeScriptのSPAです。Chart.jsで折れ線を描画し、Cloudflare Workersで画面配信とAPI中継を行います。

## 開発を始める

Node **24.16.0**、pnpm **12.8.1**、Git、Google Chromeを用意します。[依存管理](./docs/DEPENDENCY_SECURITY.md)を確認してから実行してください。

```sh
nvm use
pnpm install --frozen-lockfile
pnpm dev
```

表示されたlocalhost URLを開きます。実API接続にはローカルの`YUMEMI_API_KEY`設定が必要です。設定方法、テスト、buildは[開発手順](./docs/DEVELOPMENT.md)を参照してください。

## ドキュメント

| 文書                                               | 内容                                           |
| -------------------------------------------------- | ---------------------------------------------- |
| [PRD](./docs/PRD.md)                               | 機能の受入条件、課題の制約・提出要件           |
| [設計](./docs/DESIGN.md)                           | 採用技術、役割、状態・取得・グラフ、ライセンス |
| [デザインリンク](./docs/DESIGN_LINKS.md)           | Figmaの画面・状態・部品                        |
| [デザイントークン](./docs/DESIGN_TOKENS.md)        | 共通CSS・素材・フォント                        |
| [API仕様](./docs/API_PROXY.md)                     | 同一オリジンGET、検証、エラー契約              |
| [開発手順](./docs/DEVELOPMENT.md)                  | 起動・テスト・品質チェック・ローカルpreview    |
| [CI/CD](./docs/CI_CD.md)                           | 全workflowの役割、PR Preview、本番deploy、診断 |
| [Cloudflare環境](./docs/CLOUDFLARE_ENVIRONMENT.md) | 設定名・Secrets・API制限                       |
| [依存管理](./docs/DEPENDENCY_SECURITY.md)          | 固定導入、安全設定、監査例外の管理             |
| [アクセシビリティ](./docs/ACCESSIBILITY.md)        | 自動検査と手動確認の品質基準                   |

## リリース・提出前の確認

モックや合成データのテスト成功と実API疎通は区別します。実データの47県・4区分の値、失敗からの再試行、本番のRate Limit、スクリーンリーダー、操作時INPを確認してから完了と判断してください。公開状態や一時的な障害の経過はIssue・PRで管理します。
