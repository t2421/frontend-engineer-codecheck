# 都道府県別人口推移ビューア

指定APIの人口データを、都道府県と人口区分を選んで比較するVue / TypeScriptのSPAです。Chart.jsで描画し、Cloudflare Workersで画面配信とAPI中継を行います。

## 開発の入口

Node.js **24.16.0**とpnpm **12.8.1**、Google Chromeを用意し、プロジェクトのフォルダで実行します。

```sh
pnpm install --frozen-lockfile
pnpm dev
```

表示された`http://127.0.0.1:ポート番号`を開きます。実APIにはローカルの`YUMEMI_API_KEY`が必要です。設定・テスト・previewは[開発手順](./docs/DEVELOPMENT.md)を参照してください。

## 文書

| 知りたいこと                         | 参照先                                      |
| ------------------------------------ | ------------------------------------------- |
| 機能・課題の提出要件                 | [仕様](./docs/PRD.md)                       |
| 状態管理・グラフ・Figma・ライセンス  | [設計](./docs/DESIGN.md)                    |
| 共通CSSの使い方                      | [デザイントークン](./docs/DESIGN_TOKENS.md) |
| API契約・失敗・診断                  | [API](./docs/API_PROXY.md)                  |
| 起動・テスト・ローカル閲覧           | [開発](./docs/DEVELOPMENT.md)               |
| 実装・テストの書き方                 | [開発ガイドライン](./docs/GUIDELINES.md)    |
| workflow・Preview・本番公開・Secrets | [CI/CD](./docs/CI_CD.md)                    |
| 依存更新・監査例外                   | [依存管理](./docs/DEPENDENCY_SECURITY.md)   |
| 自動検査と手動確認                   | [アクセシビリティ](./docs/ACCESSIBILITY.md) |

配置は`src/pages/`にページ、`src/components/<業務名>/`に業務部品・composable・取得処理、`src/components/shared/`に業務判断を持たない汎用UI、`src/styles/`に共通スタイルを置きます。

モックの成功と実API疎通、自動a11y検査と手動確認、静的UIの性能計測と操作時INPを区別します。検証結果や障害の経過はIssue・PRで管理します。
