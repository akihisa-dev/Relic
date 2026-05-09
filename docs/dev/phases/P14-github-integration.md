# P14-github-integration.md

RelicのGitHub連携を、安全性最優先で導入するフェーズの正本。

P13ではGitHub連携なしの自分用配布ビルド生成まで確認した。P14では、未導入のGitHub認証とリモート操作を、ユーザー操作を前提に段階的に実装・確認する。

---

## 優先度

1. セキュリティ
2. ユーザー確認と取り消し不能操作の防止
3. ローカルファイルとGit履歴の保護
4. GitHub未接続でも使える体験の維持
5. 実装範囲の小ささと検証しやすさ

---

## 最初に読む

- `../spec/github.md`
- `../tech/git-implementation.md`
- `../architecture/decisions.md`

必要になったときだけ読む:

- IPC / Electron境界を確認する: `../architecture/overview.md`
- 実装規約とテスト方針を確認する: `conventions.md`, `testing.md`
- UI導線を確認する: `../ui/screens-macos.md`, `../ui/navigation.md`, `../ui/DESIGN.md`

---

## 公式参照

- GitHub OAuth Apps: https://docs.github.com/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps
- GitHub Apps user access token: https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app
- GitHub Apps token refresh: https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/refreshing-user-access-tokens
- GitHub App best practices: https://docs.github.com/enterprise-cloud@latest/apps/creating-github-apps/setting-up-a-github-app/best-practices-for-creating-a-github-app
- GitHub Apps permissions: https://docs.github.com/rest/reference/permissions-required-for-github-apps
- GitHub secret scanning supported patterns: https://docs.github.com/en/code-security/secret-scanning/secret-scanning-patterns
- GitHub push protection: https://docs.github.com/en/code-security/secret-scanning/introduction/about-push-protection
- GitHub secret scanning detection scope: https://docs.github.com/en/code-security/secret-scanning/troubleshooting-secret-scanning

---

## 基本方針

- Relic本体は、特定のGitHubアカウント・Organization・リポジトリ・Client IDに依存させない。
- P14でユーザー本人のGitHubを使う場合は、実操作確認のための検証環境として扱う。
- 自分用ビルドであっても、GitHub連携の設計は将来ほかのユーザーが各自のGitHub設定で使える普遍的な構造にする。
- Client IDは公開可能なアプリ識別子として外部設定から読む。access token / client secret / private key はRelic本体・リポジトリ・設定JSONに入れない。
- 将来第三者配布する場合は、Relic公式のGitHub Appを用意するか、ユーザー自身のGitHub App / OAuth設定を登録できる導線を検討する。
- GitHub連携の方式は、実装前にGitHub公式ドキュメントを基準に確認する。
- OAuth Appより、細かい権限・リポジトリ単位アクセス・短命トークンを扱えるGitHub Appを第一候補にする。
- GitHub Appでユーザーアクセストークンを使う場合は、期限付きトークンを有効にする。
- 認証フローは、client secretをアプリ本体・リポジトリ・設定ファイルに置かない方式を優先する。
- P14では、バックエンドサーバーを持たないデスクトップアプリでclient secretを保存しないため、GitHub AppのDevice Flowを採用する。
- GitHub公式ベストプラクティスでは、public clientではPKCEも推奨され、Device Flowは理由なく有効化しない注意がある。第三者配布前には、GitHub App Web application flow + PKCE + client secret管理方式を再評価する。
- GitHub認証情報は設定JSONやワークスペース内ファイルに保存しない。
- 認証情報はmacOS Keychainなど、OS標準の安全な保管先を使う。
- GitHub接続済みのユーザー情報からGit author / taggerを決定し、通常UIで作者名・メールを入力させない。
- UIではGitの正式用語を必要な範囲で使い、コミットに「ローカル」などの冗長な開発者向け修飾は使わない。
- GitHub OAuth / clone / remote接続 / push / pull は、ユーザーの実操作と明示確認を前提にする。
- 自動pull / 自動pushはデフォルトOFFのままにする。
- push / pull / branch切り替え / conflict解決など、取り消しづらい操作は差分・対象・結果を確認できる導線を置く。
- 外部サービスへ通信する操作は、実行前にユーザーの明示確認を取る。
- テスト用ワークスペースはRelic開発リポジトリ外に置く。
- Relic開発リポジトリのGitと、テスト用ワークスペースのGitを混ぜない。
- GitHub側のSecret scanning / Push protectionを前提防衛として使い、ローカルhookはその手前の追加防衛として使う。
- GitHub公式のpush protectionには検出範囲・サイズ・パターン上の限界があるため、リポジトリ側とローカル側の両方で止める。
- hookは「推測」ではなく、GitHub公式のsecret scanning対象に含まれるGitHub token、private key、HTTP認証ヘッダー、DB接続文字列、npm tokenなどの既知カテゴリを明示的に止める。

---

## GitHub側で最初に確認する設定

この確認が終わるまで、GitHub OAuth / push / pull / clone の実操作へ進まない。

- [ ] Repository Settings > Security で Secret scanning が有効であることを確認する
- [ ] Repository Settings > Security で Push protection が有効であることを確認する
- [ ] Push protection bypass を通常運用で使わない方針にする
- [ ] GitHub Appを使う場合、必要最小限のRepository permissionsだけを付与する
- [ ] GitHub Appを使う場合、User-to-server token expirationを有効にする
- [ ] OAuth Appを使う場合、client secretをアプリ本体・リポジトリ・設定JSON・`.env`へ保存しない方式で実装できるか確認する
- [ ] それができない場合、OAuth AppではなくGitHub App / Device Flowへ寄せる
- [ ] 検証用GitHub App / OAuth設定と、Relic本体の汎用設計を混同しない

---

## GitHub App最小権限案

RelicがGitHub連携で行うことは、ユーザーが選んだリポジトリに対するGit操作に限定する。

必要:

- Repository permissions > Contents: Read and write
  - clone / pull / fetch で読み取りが必要
  - commit push / tag push で書き込みが必要

通常は不要:

- Actions: No access
- Administration: No access
- Checks: No access
- Codespaces: No access
- Commit statuses: No access
- Deployments: No access
- Discussions: No access
- Issues: No access
- Metadata: GitHub Appに必須の読み取り権限のみ
- Pull requests: No access
- Secrets: No access
- Webhooks: 不要。Relicはローカルアプリなので、GitHubからサーバー通知を受けない
- Workflows: No access

運用:

- インストール対象リポジトリは、ユーザーが明示的に選択する。
- P14の検証ではRelic用テストリポジトリだけを対象にし、Relic開発リポジトリへのpush確認は行わない。
- GitHub AppのClient IDは外部設定として扱う。
- GitHub Appのprivate key / client secret / webhook secretはRelic本体では使わず、リポジトリにも保存しない。

---

## 検証用GitHub App作成案

この設定はP14の実操作確認用。Relic本体のコードに値を固定しない。

入力値:

- GitHub App name: `Relic Dev`
- Homepage URL: `https://github.com/akihisa-dev/relic`
- Callback URL: 未使用。Device Flowを使うため、Relic本体はローカルHTTPコールバックを要求しない
- Webhook: Disabled
- Device Flow: Enabled
- Expire user authorization tokens: Enabled
- Request user authorization during installation: Enabled

Repository permissions:

- Contents: Read and write
- Metadata: Read-only（GitHub Appの必須権限）
- その他: No access

インストール:

- P14検証では、Relic開発リポジトリではなく、専用のテストリポジトリだけにインストールする。
- Relic開発リポジトリへのpush / pull検証は行わない。

Relicへ渡す値:

- `RELIC_GITHUB_CLIENT_ID`: GitHub App作成後に表示されるClient ID

Relicへ渡さない値:

- Client secret
- Private key
- Webhook secret
- Access token
- Refresh token

---

## 導入順序

### 0. リポジトリ安全設定

- [x] 秘密情報・認証情報・ローカル設定ファイルをGit管理対象外にするignoreを強化する
- [x] コミット前にGitHub token / client secret / private key / HTTP認証ヘッダー / DB接続文字列 / `.env` を検出して止めるローカルhookを用意する
- [x] push前に送信対象コミットを同じ基準で走査するローカルhookを用意する
- [x] このリポジトリでローカルhookが有効になるように設定する
- [ ] GitHub側のsecret scanning / push protectionの有効状態をユーザー操作で確認する
- [ ] GitHub OAuth App / GitHub Appのclient secretをリポジトリへ保存しない運用を確認する

### 1. 現状確認

- [x] GitHub App / OAuth App / Device Flow の選択肢を、GitHub公式ドキュメント基準で比較する
- [x] Relicに必要な最小GitHub権限を洗い出す
- [x] 検証環境にだけ必要な値と、Relic本体に必要な設定項目を分けて整理する
- [x] 既存のローカルGit機能の実装範囲を確認する
- [x] 既存のGitHub関連コードの有無と責務を確認する
- [ ] 仕様上必要なGitHub導線と未実装部分を整理する
- [x] 認証情報の保存先とIPC境界を確認する

### 2. 認証基盤

- [x] GitHub OAuthの方式を仕様に沿って確認する
- [x] 認証開始・コールバック・トークン保存・ログアウトの流れを設計する
- [x] トークンをRendererへ露出させない
- [x] 認証失敗・キャンセル・期限切れの扱いを実装する
- [x] 認証状態表示を実装する
- [x] コミット作成時のGit authorをGitHub接続情報から内部決定し、通常UIから作者名・メール入力をなくす
- [x] メモ付きタグ作成時のtaggerをGitHub接続情報から内部決定し、通常UIから作者名・メール入力をなくす

### 3. リモート接続

- [x] 既存ワークスペースへのremote登録導線を実装する
- [x] clone導線を実装する
- [x] remote URL / branch / upstreamの表示を実装する
- [x] 誤ったリポジトリ接続を避ける確認を入れる

### 4. 同期操作

- [ ] pull前に作業ツリー状態を確認する
- [ ] push前に差分と送信先を確認する
- [ ] 手動同期導線を実装する
- [ ] conflict検出と解決導線を実装する
- [ ] 自動同期OFFの安全性を確認する

### 5. 実操作確認

- [ ] GitHub OAuth接続
- [ ] clone
- [ ] remote接続
- [ ] push
- [ ] pull
- [ ] conflict検出・解決
- [ ] ログアウト後にトークンが使われないこと
- [ ] GitHub未接続でもMarkdown編集とローカルGit状態確認が動くこと

---

## 確認コマンド

基本確認:

```sh
cd app
pnpm exec tsc --noEmit
pnpm test
```

配布確認:

```sh
cd app
pnpm exec electron-forge package
```

依存関係監査:

```sh
cd app
pnpm audit --audit-level moderate
```

注意: 依存関係監査は外部 registry に依存情報を送るため、実行前にユーザーの明示許可を得る。

---

## 完了条件

- [ ] GitHub認証情報が安全な場所に保存され、Rendererや設定JSONへ露出していない
- [ ] GitHub OAuth / clone / remote接続 / push / pull / conflict解決の主要導線を実アプリ操作で確認している
- [ ] GitHub未接続でもMarkdown編集とローカルGit状態確認が維持されている
- [ ] 自動同期がデフォルトOFFで、外部送信前にユーザー確認が入る
- [ ] 型チェック・自動テスト・Forge packageが成功している

---

## 確認メモ

### 2026-05-09

- GitHub公式ドキュメントを確認し、OAuth AppのWeb application flowは `client_secret` が必要になるため、デスクトップアプリではDevice Flowを優先する方針にした。
- 既存コードには `RELIC_GITHUB_CLIENT_SECRET` 前提のWeb OAuth flowがあったため、client secretを使わないDevice Flowへ変更した。
- GitHub公式ベストプラクティスではDevice Flowにフィッシング上の注意があるため、P14では「client secretを保存しない検証用導線」と位置づけ、第三者配布前にPKCE方式とclient secret管理方式を再評価する。
- Device Flowでは、Main processでGitHubの認証コードを取得し、ユーザーへコードを表示してGitHubの認証ページを開く。Rendererにはaccess token / device codeを渡さない。
- GitHubのDevice Activation画面に入力するコードを見失わないように、GitHubページを開いた後もRelic側にコード表示ダイアログを残すようにした。
- GitHub連携設定としてClient IDとscopeだけをアプリ設定に保存できるようにした。Client secret / private key / access token / refresh tokenは設定JSONへ保存しない。
- 設定画面でClient IDを保存すると、Git画面の接続可否表示が再取得されるようにした。
- GitHub実操作確認中に、空状態の作成導線が「ノート」表記になっていたため「ファイル」表記へ修正した。
- 新規ファイル作成時に `templatePath: undefined` がIPC入力検証で不正扱いになり、ファイル名を入力していても「ファイル名を入力してください」と表示される不具合を修正した。
- OAuth scopeの既定値は空にし、`repo` のような広い権限は明示設定した場合だけ要求する。GitHub Appを使う場合はApp側の細かいRepository permissionsを優先する。
- GitHub Appの最小権限案は `Contents: Read and write` のみ。Issues / Pull requests / Actions / Administration / Secrets / Webhooks / Workflows は不要。
- 検証用GitHub App作成案を整理した。Relic本体へ渡す値は `RELIC_GITHUB_CLIENT_ID` のみで、Client secret / Private key / Webhook secret / token類は渡さない。
- access tokenはmacOS Keychainに保存する。期限付きトークンの場合は `tokenExpiresAt` を保存し、期限切れならKeychainから削除して未接続扱いにする。
- 既存originを `force: true` で上書きできる実装をやめ、別URLのoriginが存在する場合は接続を拒否するようにした。
- `pnpm exec tsc --noEmit` 成功。
- `pnpm test` 成功（30 files / 200 tests）。
- `pnpm exec electron-forge package` 成功。初回はsandbox内の名前解決制限で `github.com` に到達できず失敗したため、ユーザー承認済みのネットワーク許可つきで再実行した。
- `git diff --check` 成功。
- GitHub token / private key / Authorization header / DB接続文字列などの既知秘密情報パターン検索はヒットなし。
