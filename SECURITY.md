# Security Policy

RelicはGitHub連携を扱うため、このリポジトリには秘密情報を置かない。

## 禁止

- GitHub access token / refresh token / device code / OAuth code
- GitHub OAuth client secret
- GitHub App private key
- `.env`、Keychain export、認証JSON、ローカル設定JSON
- npm token、HTTP Authorization header、DB接続文字列、秘密鍵、証明書

## 必須防衛

- このリポジトリでは `core.hooksPath=.githooks` を使う。
- `.githooks/pre-commit` と `.githooks/pre-push` を無効化しない。
- GitHub側のSecret scanningとPush protectionを有効にする。
- GitHub連携の認証情報はmacOS KeychainなどOS標準の安全な保管先に置く。
- 認証情報をRenderer、設定JSON、ワークスペース内ファイル、ログ、エラー詳細へ出さない。

## GitHub連携の原則

- Relic本体は、特定のGitHubアカウント・Organization・リポジトリ・Client IDに依存させない。
- 開発中に作るGitHub App / OAuth設定は検証環境として扱い、Relic本体の普遍的な設計とは分ける。
- Client IDは公開可能なアプリ識別子として外部設定から読む。
- OAuth Appより、細かい権限・短命トークンを扱えるGitHub Appを第一候補にする。
- P14では、client secretをリポジトリやアプリ設定に置かないため、GitHub AppのDevice Flowを採用する。
- 第三者配布前には、GitHub公式ベストプラクティスに沿ってPKCE方式とclient secret管理方式を再評価する。
- GitHub AppのRepository permissionsは、原則 `Contents: Read and write` のみにする。
- Issues / Pull requests / Actions / Administration / Secrets / Webhooks / Workflows は要求しない。
- push / pull / clone / remote接続は、ユーザー操作と明示確認を前提にする。
- 自動同期はデフォルトOFFにする。

## 参照

- GitHub push protection: https://docs.github.com/en/code-security/secret-scanning/introduction/about-push-protection
- GitHub supported secret scanning patterns: https://docs.github.com/en/code-security/secret-scanning/secret-scanning-patterns
- GitHub App user access tokens: https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app
- GitHub App token refresh: https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/refreshing-user-access-tokens
- GitHub App best practices: https://docs.github.com/enterprise-cloud@latest/apps/creating-github-apps/setting-up-a-github-app/best-practices-for-creating-a-github-app
