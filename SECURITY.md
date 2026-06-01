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

## 参照

- npm token security: https://docs.npmjs.com/about-access-tokens
