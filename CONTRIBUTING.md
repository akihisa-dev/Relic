# Contributing to Relic

Relicは、プロジェクトオーナー本人による開発と意思決定を基本とする、オーナー主導のオープンソースプロジェクトです。
外部からのIssue、機能要望、Pull Requestは積極的に募集していません。投稿は禁止しませんが、返信、調査、レビュー、採用、マージ、実装、対応時期のいずれも約束しません。オーナーは、Relicの方向性、品質、保守負担に照らして、対応せずに投稿をcloseする場合があります。

ソースコードを公開していることは、開発方針やロードマップを共同で決定すること、または外部からの提案を採用することを意味しません。AGPL-3.0-or-laterに基づく利用、改変、再配布の権利は、この開発方針によって制限されません。

Relicは、Markdownファイルを正本として保ちながら編集・閲覧・検索・可視化・出力を広げるローカルアプリです。変更提案では、既存のMarkdown保存形式、ローカルファイル操作、ユーザーのデータを壊さないことを特に重視してください。
開発ルールの詳細は [docs/development.md](docs/development.md) を確認してください。

## ライセンス

Relicに提出されたコード、ドキュメント、その他の変更は、特別な合意がない限り、Relic本体と同じ GNU Affero General Public License v3.0 or later（AGPL-3.0-or-later）として取り扱われます。

Pull Requestを送ることで、提出内容をAGPL-3.0-or-laterで配布・改変できることを確認したものとみなします。第三者のコード、画像、文章、生成物などを含める場合は、そのライセンスがRelicのAGPL-3.0-or-laterでの配布と矛盾しないことを確認してください。

## 外部投稿の方針

- IssueやPull Requestは一件につき一つの目的に絞り、要点を簡潔に書いてください。
- バグ報告やバグ修正では、再現手順と確認内容を書いてください。
- 大きな機能追加やUI変更は、事前の合意なく実装しても、レビューや採用を行わない場合があります。
- 既存のMarkdown保存形式、ファイル操作仕様、公開APIの意味を変える変更は、影響範囲を明記してください。
- 秘密情報、APIキー、個人情報、ローカル環境固有の設定ファイルを含めないでください。
- 可能な範囲で、型チェックや関連テストを実行してください。

AIの権限判断、外部操作、コミット、リリース、GitHub Actions、秘密情報検査に関わるファイルは、通常のコードレビューに加えてオーナー確認の対象です。対象パスは [`.github/CODEOWNERS`](.github/CODEOWNERS) を正本とします。機能別Skillの通常の改善まで一律にオーナー確認へ広げません。

GitHubへのpushは外部公開として扱います。GitHub上のcheckを公開前検証の代わりにせず、ローカルで全検証に成功した変更だけを送信してください。次の設定で `.githooks/pre-commit` と `.githooks/pre-push` を有効にすると、通常pushでは `pnpm verify:local:push`、タグpushでは配布ビルドと起動スモークを含む `pnpm verify:local:release` が自動実行されます。

```sh
git config core.hooksPath .githooks
```

設定を変更せずに確認する場合も、ステージ済み差分へ `.githooks/pre-commit` を実行し、送信予定commitへ秘密情報・version・SBOM・空白の検査を行ったうえで、`app/` の `pnpm verify:local:push` を実行します。タグ送信では代わりに `pnpm verify:local:release` を実行します。

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
