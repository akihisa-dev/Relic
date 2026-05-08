# Relic smoke workspace

Relicの主要機能を手動確認するための小さなテスト用ワークスペースです。

このフォルダをRelicで開き、下のファイルを順番に触ると、基本的な編集・ファイル管理・リンク・タグ・frontmatter・添付参照・検索・Git差分の確認ができます。

## 確認入口

| 機能 | 見るファイル・フォルダ |
|------|------------------------|
| Markdown編集 | `notes/markdown-basic.md` |
| ライブプレビュー | `notes/markdown-basic.md` |
| ファイル作成・移動・削除 | `drafts/`, `archive/` |
| Wikiリンク | `links/index.md`, `links/target-note.md` |
| タグ検索 | `tags/tagged-notes.md` |
| frontmatter | `frontmatter/book-note.md` |
| 添付参照 | `attachments/attachment-check.md` |
| 日本語・スペース入りパス | `日本語 フォルダ/スペース 入り ノート.md` |
| Git差分 | `git/edit-me-for-diff.md` |

## 使い方

1. Relicでこの `smoke-workspace` フォルダを開く
2. `README.md` から各ファイルへ移動する
3. `git/edit-me-for-diff.md` を編集して、差分表示やコミット操作を確認する
4. `drafts/` に新規ファイルを作成し、移動・リネーム・削除を確認する

添付確認用のファイルは軽量なダミーです。実データではありません。

## Git操作の注意

このワークスペースはRelic本体リポジトリの中にあります。
Relicが親リポジトリをGit管理対象として認識する場合、コミット操作はこのプロジェクト本体に対して行われます。

コミットまで試す場合は、事前に専用ブランチを使うか、この `smoke-workspace` をリポジトリ外へコピーしてから確認してください。
