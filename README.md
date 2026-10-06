# frontend-engineer-codecheck

依存導入前に[依存パッケージのサプライチェーン対策](./docs/DEPENDENCY_SECURITY.md)を確認してください。

```sh
nvm use
npm run security:test
npm run security:bootstrap
```

現在は依存ゼロ・lock未作成の初期段階です。実依存追加後は `npm run security:check` を必須にし、`npm ci`で導入します。
