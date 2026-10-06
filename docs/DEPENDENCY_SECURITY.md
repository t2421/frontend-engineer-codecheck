# pnpmの依存導入手順

Node **24.16.0** / pnpm **12.8.1**を使用する。既存nvmで`nvm use 24.16.0`し、`node --version`と`pnpm --version`を確認する。package.json の `"packageManager": "pnpm@12.8.1"` と `.nvmrc` で固定する。

pnpmは[公式12.8.1配布](https://github.com/pnpm/pnpm/releases/tag/v12.8.1)から用意する。今回はMac arm64 archiveの公式SHA-256と一致を確認してタスク内へ展開した。ホーム・global・既存Corepack/Yarn設定は変更せず、この実体を絶対パスまたは作業shell内のPATHで使う。

`pnpm-workspace.yaml`の4設定で、installスクリプトを停止し、公開から7日（10080分）待ち、公開日時が欠けた場合は拒否し、直接依存を完全versionで保存する。registryとTLSは標準値を使う。独自checker・専用テストは設けない。

1. 依存追加前にpackage名・必要性・version・取得元を確認し、`pnpm add <package>@<version>`で追加する。Git／任意URLの指定は避ける。未確認の`pnpm dlx`や`pnpm create`も外部コードを実行する。
2. package.jsonとpnpm-lock.yamlの差分をレビューして両方コミットする。再現導入は`pnpm install --frozen-lockfile`を使う。
3. 導入後に`pnpm audit --audit-level=high`を実行し、結果をPRに記録する。既知の脆弱性を調べるもので、未知の攻撃を防ぐ保証ではない。
4. スクリプトが必要な依存は、対象version・理由・確認内容・承認・解除方法をPRに記録して個別に判断する。ViteとCloudflare plugin／workerdはscripts停止のままローカル起動・buildを確認した。

**制約:** 12.8.1は標準のlock検証で年齢制約も再確認する（`trustLockfile:false`が既定）。`blockExoticSubdeps:true`は推移依存向けで、直接Git／URL依存の全拒否ではない。設定はCLI等で変更できるため、例外はレビューする。`ignoreScripts`でも明示的なbuild／testやpnpmfile hookではコードが実行される。

**#12への引継ぎ:** PRの依存導入・build／test jobにはdeploy秘密情報を渡さず、最小read権限で実行する。deployは別jobで扱う。CI実装はこの変更に含めない。

**#19の確認:** pnpm 12.8.1実体で4設定を読取。一時の依存ゼロ・offline fixtureでinstall lifecycle停止を確認。自作のlocalhost metadataとlock-only操作で、公開当日の新規version・既存lockの同version・公開日時欠落を拒否することも確認した。年齢検証は模擬registry内で行い、アプリ依存のtarballは取得していない。

**#14の確認:** 実依存の固定導入、Vue最小画面、HMR、Vite buildを確認した。実依存auditの結果と残課題はREADMEを参照。Cloudflare plugin／workerd追加後の検証と監査未合格の詳細はWORKERS_SETUP.mdを参照。
