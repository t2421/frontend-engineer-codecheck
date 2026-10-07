# 共通CSS

色・文字・余白・角丸・focusのCSS変数は[src/styles/base.css](../src/styles/base.css)を正本とし、各Vueのscoped CSSから`var(--変数名)`で使います。汎用部品の基本スタイルは`src/styles/`、画面配置は各Vueで管理します。[Figma参照](./DESIGN.md#figma参照)を確認し、同じ値を個別に複製しません。

- 文字サイズ/行高はremで、利用者の文字設定に追従します。ルートfont-sizeを固定しません。
- フォントは`'Noto Sans JP', sans-serif`。外部配信・ファイル同梱は行わず、未導入端末ではfallbackします。実フォントとの一致確認は別途必要です。
- 系列色は県コード順の固定トークン。Figmaの先頭3色と追加44色を使い、色だけに識別を依存させません。
- チェック・状態アイコンはFigma提供SVGをローカルで保持し、一時URLを実装へ含めません。グラフの仮の線SVGは使いません。

resetは初期余白・box-sizing・フォーム文字継承などに限定し、ネイティブ操作とfocusを保持します。横溢れを隠して解決せず、リフロー・reduced motion・forced colorsを実画面で確認します。
