# Contributing to Relic

Relicへのコントリビューションを歓迎します。

Relicは、Markdownファイルを正本として保ちながら編集・閲覧・検索・可視化・出力を広げるローカルアプリです。変更提案では、既存のMarkdown保存形式、ローカルファイル操作、ユーザーのデータを壊さないことを特に重視してください。
開発ルールの詳細は [docs/development.md](docs/development.md) を確認してください。

## ライセンス

Relicに提出されたコード、ドキュメント、その他の変更は、特別な合意がない限り、Relic本体と同じ GNU Affero General Public License v3.0 or later（AGPL-3.0-or-later）として取り扱われます。

Pull Requestを送ることで、提出内容をAGPL-3.0-or-laterで配布・改変できることを確認したものとみなします。第三者のコード、画像、文章、生成物などを含める場合は、そのライセンスがRelicのAGPL-3.0-or-laterでの配布と矛盾しないことを確認してください。

## Pull Request 方針

- 変更の目的をPull Request本文に簡潔に書いてください。
- バグ修正では、再現手順と修正後の確認内容を書いてください。
- 機能追加やUI変更は、先にIssueやDiscussionで目的と範囲を相談してください。
- 既存のMarkdown保存形式、ファイル操作仕様、公開APIの意味を変える変更は、影響範囲を明記してください。
- 秘密情報、APIキー、個人情報、ローカル環境固有の設定ファイルを含めないでください。
- 可能な範囲で、型チェックや関連テストを実行してください。

AIの権限判断、外部操作、コミット、リリース、GitHub Actions、秘密情報検査に関わるファイルは、通常のコードレビューに加えてオーナー確認の対象です。対象パスは [`.github/CODEOWNERS`](.github/CODEOWNERS) を正本とします。機能別Skillの通常の改善まで一律にオーナー確認へ広げません。

Pull RequestではGitHub Actionsが変更コミットの秘密情報パターンを検査します。ローカルでも次の設定で `.githooks/pre-commit` と `.githooks/pre-push` を有効にし、公開前に同じ検査を行ってください。AIエージェントのコミット・公開手順は、設定の有無にかかわらずhookまたはguardを明示実行します。

```sh
git config core.hooksPath .githooks
```

設定を変更せずに確認する場合は、ステージ済み差分へ `.githooks/pre-commit`、送信予定commitへ `.githooks/secret-guard.sh --range <range>` を実行します。

## 開発ルール

文書更新を含む開発ルールは [docs/development.md](docs/development.md) に従ってください。

## 開発

アプリ本体の作業は `app/` 配下で行います。

```sh
cd app
pnpm install
pnpm verify
```

開発版の起動は以下です。

```sh
cd app
pnpm start
```

## セキュリティ

脆弱性や秘密情報の混入を見つけた場合は、公開Issueに詳細を書かないでください。GitHub Public Repositoryとして公開後は、GitHub Security Advisoriesなど、非公開で連絡できる経路を優先してください。
