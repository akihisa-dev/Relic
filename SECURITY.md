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

## CIでの確認

- 通常CIは `.githooks/secret-guard.sh --self-test` を実行し、秘密情報検出ルールが壊れていないことを確認する。
- Secret Guard workflowはPull Requestと`main`へのpushで `.githooks/secret-guard.sh --range <range>` を実行し、対象差分に秘密情報らしい文字列や禁止ファイル名が含まれる場合に失敗する。
- 通常CIは `cd app && pnpm licenses:check` を実行し、`THIRD_PARTY_NOTICES.md` と `sbom/relic-dependencies.cdx.json` がproduction dependenciesと一致しない場合に失敗する。
- 通常CIは `cd app && pnpm security:audit` を実行し、production dependenciesの既知リスクを確認する。初期導入段階では警告扱いとし、CIの失敗条件にはしない。高深刻度以上のadvisoryが継続する場合は、依存更新または例外理由をIssueやPull Requestで明示する。
- GitHub Actions workflowは原則として `permissions: contents: read` を使い、checkoutでは `persist-credentials: false` を指定する。write権限が必要なworkflowを追加する場合は、必要な理由と対象操作を文書化する。

## 参照

- npm token security: https://docs.npmjs.com/about-access-tokens
