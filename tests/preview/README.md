# テスト専用の UI 確認ページ

このディレクトリの `*.html` はローカル・CI の E2E / アクセシビリティ検証で使用します。PR Preview と production build の公開対象には含まれません。

HTML と、そのページだけが使う entry / Vue を同じ場所に置きます。共通の合成テストデータは `tests/fixtures/` に置きます。
