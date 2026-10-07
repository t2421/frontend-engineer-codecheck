# テスト用UIページ

`*.html`を開発serverの`/tests/preview/対象.html`で開きます。ローカル・CIのE2E/a11y専用で、PR Preview・本番buildへ含めません。[開発手順](../../docs/DEVELOPMENT.md)を参照してください。

ページ専用entry/Vueはこの場所、合成データは`tests/fixtures/`へ置きます。複数ページで使う`FixtureLayout.vue`は共通の検証レイアウトです。合成loaderとrouteモックは実API疎通を証明しません。
