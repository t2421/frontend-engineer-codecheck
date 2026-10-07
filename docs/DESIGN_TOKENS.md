# 共通CSSとデザイントークン

`src/styles/base.css`を`src/main.ts`から読み込み、`:root`のCSSカスタムプロパティをVueのscoped CSSでも参照する。追加依存はない。色・余白・角丸・線幅の名前はFigma変数と対応させ、文字はFigmaのJPスタイルを用途別に定義した。

## 参照元

Figmaの画面・部品・変数を参照します。

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
| color-series-1 / color-series-2 / color-series-3                | #1558d6 / #087d75 / #ac5710 | Figmaの3系列。県コード1〜3へ固定割当               |

`--color-series-1`〜`--color-series-47`は県コード順の固定色です。先頭3色はFigma値、残り44色は追加仕様です。色だけの判別を保証せず、県名・tooltip・代替表を併用します。[グラフ仕様](./DESIGN.md#グラフ)を参照してください。

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

共通部品の基本スタイルは`src/styles/`、画面配置と個別の調整は各Vueのscoped CSSで管理します。

フォントは`'Noto Sans JP', sans-serif`を宣言し、外部配信・ファイル同梱は行いません。端末に未導入ならsans-serifへfallbackします。実フォントでの一致は別途確認が必要です。画面のbreakpointは640 / 1024px、県一覧の列数はcontainer queryで調整します。

チェック・状態アイコンはFigma提供のSVGをローカル素材として保持します。一時URLを実装へ含めず、グラフの仮の線SVGは使用しません。
