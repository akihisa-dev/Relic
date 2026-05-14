# P4-foundation-implementation.md

Relicの基礎実装フェーズの正本。

このフェーズでは、P0からP3までで整理した方針と仕様をもとに、Relicの基礎機能を実装した。

---

## フェーズの目的

- アプリの土台を作る
- ローカルMarkdownワークスペースとして最低限必要な操作を実装する
- エディタ、プレビュー、リンク、タグ、検索の基本体験を成立させる

---

## 正本・参照

- `../../tech/stack.md`
- `../../architecture/overview.md`
- `../../spec/file-management.md`
- `../../spec/navigation.md`
- `../../spec/editor.md`
- `../../spec/markdown.md`
- `../../spec/links-and-tags.md`
- `../../spec/search.md`

---

## 完了状態

- Electron / React / TypeScript / Vitest の基盤を作成した
- ワークスペースとファイル管理の基本機能を実装した
- Markdownエディタとライブプレビューの基本体験を実装した
- 内部リンク、タグ、検索の基本機能を実装した
- このフェーズは完了済み
