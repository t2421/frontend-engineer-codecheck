# 共通CSS

色・文字・余白・角丸・focusのCSS変数とベース指定は[src/styles/base.css](../src/styles/base.css)を参照してください。共通値は`var(--変数名)`で参照し、共通ラベルのスタイルは[src/styles/control-label.css](../src/styles/control-label.css)、部品固有の見た目・配置は各Vueのscoped CSSで管理します。[Figma参照](./DESIGN.md#figma参照)も確認してください。

- 文字サイズ/行高はremで、利用者の文字設定に追従します。ルートfont-sizeを固定しません。
- フォントは`'Noto Sans JP', sans-serif`。外部配信・ファイル同梱は行わず、未導入端末ではfallbackします。実フォントとの一致確認は別途必要です。
- 系列色は県コード順の固定トークン。Figmaの先頭3色と追加44色を使い、色だけに識別を依存させません。
- チェック・状態アイコンはFigma提供SVGをローカルで保持し、一時URLを実装へ含めません。グラフの仮の線SVGは使いません。

ベースCSSは初期余白・box-sizing・フォーム文字継承と共通focusを指定します。実際のfocus表示は部品CSSも参照してください。[SingleSelectGroup](../src/components/shared/SingleSelectGroup.vue)はラベルのoutline、現行[Checkbox](../src/components/shared/Checkbox.vue)は内側のbox-shadowで表示します。全操作が同じリング表示になるわけではありません。

横溢れを隠して解決せず、リフロー・reduced motion・forced colorsは[a11y基準](./ACCESSIBILITY.md)に従って実画面で確認します。
