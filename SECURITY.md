# Security Policy

このリポジトリには秘密情報を置かない。

RelicはGitHub Public Repositoryとして公開する前提で管理する。脆弱性や秘密情報の混入を見つけた場合は、公開Issueに詳細を書かず、GitHub Security Advisoriesなどの非公開で連絡できる経路を優先する。

## 禁止

- `.env`、認証情報を含む `.npmrc`、認証JSON、ローカル設定JSON
- npm token、HTTP Authorization header、DB接続文字列、秘密鍵、証明書
- 個人アカウント、外部サービス、配布署名に関わる認証情報

## 必須防衛

- 認証情報はOS標準の安全な保管先に置く。
- 認証情報をRenderer、設定JSON、ワークスペース内ファイル、ログ、エラー詳細へ出さない。
- 外部サービスに接続する処理を追加する場合は、保存場所、ログ出力、エラー表示、削除方法を実装前に確認する。
- Git管理対象の `.npmrc` はプロジェクト設定だけに限定し、registry tokenなどの認証情報を絶対に書かない。
- `userData` 配下の設定ファイルと再生成可能なindex cacheは、macOS / Linuxではディレクトリを `0700`、ファイルを `0600` 相当に制限する。WindowsではユーザープロファイルのACLを前提にし、Node.jsのmode指定を同等のアクセス制御として扱わない。

## 秘密情報検知

- `.githooks/pre-commit` は、ステージ済みの差分から禁止ファイル名と秘密情報らしい文字列を検知する。
- `.githooks/pre-push` は `.githooks/secret-guard.sh --pre-push` を呼び出し、push対象コミットを検査する。
- 検知対象は、環境変数ファイル、認証情報を示すファイル名、HTTP Authorization header、provider token、秘密鍵、認証情報を含むDB接続文字列など、漏えいリスクが高い形に限定する。
- 画像、ZIP、実行ファイルなど、テキストとして検査する必要がないファイルは内容検査の対象外とする。
- 検知ルールの確認には `.githooks/secret-guard.sh --self-test` を使い、本物のtoken、秘密鍵、実在credentialをテストやログへ含めない。
- 誤検知した場合は、まず検知対象文字列を含まない安全な表現へ変更する。検知ルールを緩める場合は、対象パターンと安全性を確認する。

## GitHub Actions

- Draft Release workflowは `pnpm licenses:check` と `pnpm security:audit` を実行し、配布対象依存関係を確認する。
- GitHub Actions workflowは原則として `permissions: contents: read` を使い、checkoutでは `persist-credentials: false` を指定する。write権限が必要なworkflowを追加する場合は、必要な理由と対象操作を文書化する。

## 参照

- npm token security: https://docs.npmjs.com/about-access-tokens
