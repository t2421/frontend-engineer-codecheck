# 共通CSSとデザイントークン

`src/base.css`を`src/main.ts`から読み込み、`:root`のCSSカスタムプロパティをVueのscoped CSSでも参照する。追加依存はない。色・余白・角丸・線幅の名前はFigma変数と対応させ、文字はFigmaのJPスタイルを用途別に定義した。

## 参照元

2026-10-06、Figma MCPのdesign context（画像を含む）とvariable definitionsで実値を確認した。

- [PC 1440](https://www.figma.com/design/I5QdPGt1iIXNqda6KQG1r2?node-id=2-64)、[tablet 768](https://www.figma.com/design/I5QdPGt1iIXNqda6KQG1r2?node-id=31-1655)、[mobile 390](https://www.figma.com/design/I5QdPGt1iIXNqda6KQG1r2?node-id=2-65)：ページ共通の色・文字・余白。
- [共通操作部品](https://www.figma.com/design/I5QdPGt1iIXNqda6KQG1r2?node-id=4-169)：操作色、hover・focus・disabled、角丸、線幅。
- [都道府県選択部品](https://www.figma.com/design/I5QdPGt1iIXNqda6KQG1r2?node-id=7-591)：選択背景・余白・角丸。
- [グラフ状態部品](https://www.figma.com/design/I5QdPGt1iIXNqda6KQG1r2?node-id=6-295)：状態表示・系列色。系列色は変数定義で確認した。

## 色

| CSS変数（`--`省略）                                             | 値                          | 用途・参照元                                       |
| --------------------------------------------------------------- | --------------------------- | -------------------------------------------------- |
| color-bg-canvas / color-bg-surface                              | #f5f7fa / #ffffff           | ページ背景 / パネル背景、各画面                    |
| color-text-primary / color-text-secondary / color-text-inverse  | #172b3a / #536677 / #ffffff | 本文・見出し / 補足 / 塗り操作上、各画面・操作部品 |
| color-border-default / color-border-strong                      | #d9e1e8 / #7a8c9b           | パネル境界 / 操作部品境界、PC・操作部品            |
| color-action-default / color-action-hover / color-action-subtle | #1558d6 / #1047b1 / #eef4ff | 操作・選択 / hover / 選択背景、操作部品            |
| color-focus                                                     | #1558d6                     | キーボードフォーカス、操作部品                     |
| color-disabled-bg / color-disabled-text                         | #e8edf2 / #6e7b88           | 無効状態、操作部品                                 |
| color-status-error / color-status-error-bg                      | #b42318 / #fff2f0           | エラー表示、グラフ状態部品                         |
| color-series-1 / color-series-2 / color-series-3                | #1558d6 / #087d75 / #ac5710 | Figmaの3系列。47県への割当はグラフ実装で決定       |

## 文字

全スタイルのフォントはNoto Sans JP、字間は0。サイズ・行高は既定16pxのルートに対するremへ変換し、利用者の文字サイズ設定に追従する。ルートのfont-sizeは固定しない。

| CSS変数             | Figmaスタイル             | サイズ / 太さ / 行高（px） |
| ------------------- | ------------------------- | -------------------------- |
| --font-body         | JP/Body                   | 14 / 400 / 22              |
| --font-label        | JP/Label                  | 14 / 500 / 22              |
| --font-caption      | JP/Caption                | 12 / 400 / 20              |
| --font-small-label  | JP/Small label            | 12 / 500 / 20              |
| --font-section      | JP/Section                | 20 / 700 / 30              |
| --font-title        | JP/Title                  | 32 / 700 / 48              |
| --font-title-mobile | JP/Mobile title（mobile） | 24 / 700 / 36              |

`--font-family`、`--font-weight-*`、`--font-size-*`、`--line-height-*`も個別に参照できる。bodyに本文スタイル、フォーム要素に文字設定の継承を適用する。タイトルや操作ラベルの選択は各scoped CSSが担う。

## 余白・角丸・線幅

| CSS変数                                  | 値（px）       | 用途・参照元                                                                       |
| ---------------------------------------- | -------------- | ---------------------------------------------------------------------------------- |
| --space-0 / 4 / 8 / 12                   | 0 / 4 / 8 / 12 | 余白なし / 区分間・注記 / アイコンと文字 / 操作内側、操作部品                      |
| --space-16 / 20 / 24                     | 16 / 20 / 24   | 選択欄・mobileパネル / グラフ内の間隔 / PC・tabletパネルと領域間、各画面・共通部品 |
| --space-32 / 40 / 80                     | 32 / 40 / 80   | tabletページ / PC上下・部品確認枠 / PC左右、tablet・PC・操作部品                   |
| --radius-4 / 8 / 12                      | 4 / 8 / 12     | 小さな操作枠 / 操作・注記 / パネル・区分群、共通部品                               |
| --stroke-1 / 2                           | 1 / 2          | 通常境界 / focus、操作部品                                                         |
| --focus-ring-width / --focus-ring-offset | 2 / 4          | 操作部品のFocus ringレイヤー（5:91、2px with 4px offset）                          |

## 利用と範囲

```vue
<style scoped>
.panel {
  padding: var(--space-24);
  font: var(--font-body);
  color: var(--color-text-primary);
  background: var(--color-bg-surface);
  border-radius: var(--radius-12);
}
</style>
```

resetはbox-sizing、body・見出し・本文・figureの初期余白、フォーム文字設定だけに限定。ネイティブのフォーム外観・無効状態・リンク装飾は保持し、focus-visibleに確認済みの外側リングを設定する。横溢れを隠すoverflow指定はしない。

App.vueは既存の最小起動画面のまま、重複するグローバル設定を削除し、scoped CSSでトークンを利用する。画面の配置・各幅のタイトル切替・checkbox・グラフは各Issueで実装する。

## 確認事項

- Figmaはフォント名を示すが配信方法を指定していない。今回は`'Noto Sans JP', sans-serif`で宣言し、外部配信・フォントファイル追加はしない。端末に未導入ならsans-serifで表示される。フォント配信方法の確定と実フォントでの一致検証は後続実装に必要。
- 1440 / 768 / 390は確認用画面幅。切替ブレークポイントは未指定なので推測したトークンを追加しない。
- 系列は確認できた3色だけを定義。残りの県の色や線種を推測しない。

## 検証

共通CSS導入時にChromeで1440 / 768 / 390 / 320pxの最小起動画面の共通文字・背景・横溢れを確認済み。一時的なVue fixtureでscoped参照・フォーム文字継承・Tabの可視リング・Spaceでのチェック操作・disabledも確認した。これは実装時の確認記録であり、完成したアプリの検証結果ではない。

CSS専用のテストと確認用画面は保持しない。既存の単体・Vue部品テストと最小起動画面のChrome E2E、Playwright設定は維持する。各画面幅の横溢れとキーボード操作は、後続のページ・部品実装時に実画面のE2Eで確認する。
