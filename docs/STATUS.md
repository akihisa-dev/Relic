# docs/STATUS.md

AIがセッション開始時に読む**ドキュメント整備状況リスト**。
このファイルを見るだけで「何が整備済みで何が未着手か」を把握できる。

> 更新ルール：ドキュメントの状態が変わったら必ずこのファイルも更新すること。

---

## 凡例

| 記号 | 意味 |
|------|------|
| ✅ | 整備済み（実用レベルの内容あり） |
| 🔶 | 着手済みだが薄い（骨格のみ・追記が必要） |
| ❌ | 未着手（ヘッダーのみ） |

---

## 計画・方針

| ファイル | 状態 | 備考 |
|----------|------|------|
| [PLAN.md](PLAN.md) | ✅ | 確定事項・機能一覧・技術スタック記載済み。未決定事項が複数残存 |
| [FEATURES.md](FEATURES.md) | ✅ | 空（全機能をspec/に移行済み） |
| [glossary.md](glossary.md) | ✅ | 用語定義済み |
| [principles.md](principles.md) | ✅ | 設計思想・ターゲットユーザー・用語方針・設計哲学を定義済み |

---

## 仕様書（spec/）

| ファイル | 状態 | 備考 |
|----------|------|------|
| [spec/editor.md](spec/editor.md) | ✅ | エディタモード・表示設定・ツールバーボタン仕様あり |
| [spec/file-management.md](spec/file-management.md) | ✅ | 作成・削除・リネーム・移動・複製・ワークスペース構造を記載 |
| [spec/github.md](spec/github.md) | ✅ | OAuth・同期・差分・ブランチ管理・Gitタグの仕様あり |
| [spec/links-and-tags.md](spec/links-and-tags.md) | ✅ | 内部リンク・バックリンク・タグ仕様あり |
| [spec/markdown.md](spec/markdown.md) | ✅ | サポートするMarkdown記法の範囲と挙動を記載 |
| [spec/navigation.md](spec/navigation.md) | ✅ | サイドバー・タブ・分割表示・アウトラインパネル・テーマ仕様あり |
| [spec/search.md](spec/search.md) | ✅ | 全文・ファイル名・タグ・正規表現検索、置換まで記載 |
| [spec/file-tools.md](spec/file-tools.md) | ✅ | マージ・分割・タイトル一覧・目次生成の仕様あり。リリース後に拡充予定 |
| [spec/frontmatter.md](spec/frontmatter.md) | ✅ | フィールド種類・組み込み/固定/ユーザー定義/自由の4分類・上限20個・設定画面連携を定義済み |

---

## アーキテクチャ（architecture/）

| ファイル | 状態 | 備考 |
|----------|------|------|
| [architecture/overview.md](architecture/overview.md) | ✅ | 全体構成・コンポーネント一覧・データの流れ・ストレージ定義済み |
| [architecture/data-model.md](architecture/data-model.md) | ✅ | ワークスペース・ファイル・リンク・タグ・Git関連のデータ構造定義済み |
| [architecture/decisions.md](architecture/decisions.md) | ✅ | 主要な意思決定8件を記録済み |

---

## 技術選定（tech/）

| ファイル | 状態 | 備考 |
|----------|------|------|
| [tech/stack.md](tech/stack.md) | ✅ | 確定スタック・未選定項目を記載 |
| [tech/editor-engine.md](tech/editor-engine.md) | ✅ | CodeMirror 6 に決定。選定理由・比較記載済み |
| [tech/git-implementation.md](tech/git-implementation.md) | ✅ | isomorphic-git に決定。選定理由・比較記載済み |

---

## UI（ui/）

| ファイル | 状態 | 備考 |
|----------|------|------|
| [ui/DESIGN.md](ui/DESIGN.md) | ✅ | カラー・タイポ・スペーシング・モーション・ダークモード定義済み |
| [ui/screens-macos.md](ui/screens-macos.md) | ✅ | 2カラムレイアウト・サイドバービュー・メインエリア構成を定義済み |
| [ui/navigation.md](ui/navigation.md) | ✅ | 起動・ファイルを開く・タブ・分割・ビュー切り替えフロー定義済み |
| [mockups/](mockups/) | 🔶 | 名称ラベル版の画面モックあり（メイン・検索・Git・設定・初回起動）。実動UIではない |

---

## 開発（dev/）

| ファイル | 状態 | 備考 |
|----------|------|------|
| [dev/roadmap.md](dev/roadmap.md) | ❌ | 凍結中（open-questions総点検が一段落するまで作成しない） |
| [dev/open-questions.md](dev/open-questions.md) | 🔶 | 総点検中。P0〜P3で未決定事項を分類済み |
| [dev/conventions.md](dev/conventions.md) | ❌ | 凍結中（open-questions総点検が一段落するまで作成しない） |
| [dev/testing.md](dev/testing.md) | ❌ | 凍結中（open-questions総点検が一段落するまで作成しない） |

---

## 未決定事項（要対応）

未決定事項の本体は [dev/open-questions.md](dev/open-questions.md) に集約する。

特に優先して確認するもの：

- [x] ワークスペース保存場所：任意フォルダ方式で確定。iCloud Drive固定方針との矛盾は解消済み
- [x] クラウド同期フォルダはアプリ機能ではなく、通常のローカルフォルダとして扱う方針で確定
- [ ] 複数ワークスペース間をまたいだ検索・リンクをサポートするか
- [ ] サイドバーのビュー切り替えUI（タブ / アイコンボタン / ドロップダウンなど）
- [x] 機能トグルの対象機能：主要な追加機能のみ対象にする方針で確定

## 決定済み事項（参照用）

- **料金モデル**：現時点では設計対象外。まず自分用に作って使い、良ければ収益化を検討
- **macOS 最低対応バージョン**：macOS 15 Sequoia 以降
- **配布方法**：まず自分用ビルド。第三者に配る段階でコード署名・自動アップデートを検討し、一般ユーザー向けに継続提供する価値が見えたらMac App Storeも検討
- **Git実装**：isomorphic-git（ユーザー環境にgit不要のため）
- **エディタエンジン**：CodeMirror 6
- **ワークスペース**：ユーザーが任意のローカルフォルダを登録する方式（Obsidianと同じ）
