# アクセシビリティ基準

WCAG 2.2の適用可能なA・AA基準を参考にします。ネイティブのbutton/input/labelを優先し、ARIAは意味・状態の補完に使います。キーボード操作・可視focus・ラベル・状態通知・グラフの代替情報を備え、色だけに識別を依存させません。読み込み通知をbusy領域で保留させず、重複通知や不要なfocus移動を避けます。

## 自動検査

`pnpm test:e2e`で[共通axe検査](../tests/e2e/accessibility.ts)を実行します。violationsはCI失敗、incompleteはJSONを手動確認し、問題なしとは扱いません。ルール・要素の無条件除外は設けません。

対象は初期・選択・全解除・開閉・読み込み・失敗/retry・区分切替・グラフと代替表、および共通部品です。ケースは[accessibility.spec.ts](../tests/e2e/accessibility.spec.ts)と[app-integration.spec.ts](../tests/e2e/app-integration.spec.ts)などの機能別E2Eにあります。

追加・変更時は該当E2Eから共通検査を呼びます。実APIはrouteモック/合成loaderで分離し、未定義の通信を防ぎ、対象状態の表示を待って検査します。固定sleepやモック成功で実API疎通を判定しません。Canvas実描画はChromeで確認します。

結果JSONはテスト成果物へ添付します。CIの保存条件は[Checks](../.github/workflows/checks.yml)、ローカルレポートは[開発手順](./DEVELOPMENT.md)を参照してください。

## 手動確認

PRに確認方法・結果・未確認事項と影響を残します。

- キーボードだけで主要操作でき、focus順序・可視性・開閉後の位置が適切か。
- スクリーンリーダーでラベル・選択・読み込み/失敗・グラフ値を理解でき、通知が重複しないか。
- 狭い幅・拡大・リフローでも内容と操作を失わないか。
- グラフを色やマウスだけに頼らず読み取れるか。axeのincompleteを確認したか。

自動検査の成功だけで準拠や手動確認完了とは判定しません。参考：[Playwright](https://playwright.dev/docs/accessibility-testing)、[axe API](https://github.com/dequelabs/axe-core/blob/develop/doc/API.md)。
