# 文書索引

この文書は、作業内容から参照すべき正本へ進むための索引です。
すべての文書を毎回読むのではなく、最初の入口を確認したあと、対象に直接関係する文書だけを参照します。
Gitで管理している全ファイルのツリーは文書へ保存せず、必要な場合に `app/` で `pnpm docs:tree` を実行して確認します。

---

## 最初の入口

| 対象 | 正本 |
|------|------|
| AIエージェントの行動、権限、確認、コミット、Issue対応 | [AGENTS.md](../AGENTS.md) |
| Relicの目的、対象ユーザー、判断思想 | [プロジェクト概要](project/overview.md) |
| 開発範囲、実装、検証、バージョン、リリース | [開発ルール](development.md) |
| 文書とコードの参照先 | [この文書](INDEX.md) |
| 対外的な説明と利用・開発案内 | [README](../README.md) |

## 作業別の参照先

| 作業 | 最初に読む文書 | 必要に応じて追加で読む文書 |
|------|----------------|--------------------------------|
| 目的、対象ユーザー、機能追加の妥当性 | [プロジェクト概要](project/overview.md) | [用語集](project/terms.md) |
| エディタ、保存、出力 | [エディタ仕様](features/editor.md) | [Markdown仕様](features/markdown.md)、[エディタエンジン](engineering/editor-engine.md) |
| ファイル、フォルダ、ワークスペース | [ファイル仕様](features/files.md) | [ファイルアクセス境界](engineering/file-access-boundaries.md)、[データモデル](engineering/data-model.md) |
| 検索、置換 | [検索仕様](features/search.md) | [アーキテクチャ](engineering/architecture.md) |
| リンク、タグ | [リンク仕様](features/links.md) | [データモデル](engineering/data-model.md) |
| フロントマター | [フロントマター仕様](features/frontmatter.md) | [データモデル](engineering/data-model.md) |
| コマンド、クイックスイッチャー | [コマンド仕様](features/commands.md) | [ナビゲーション仕様](features/navigation.md) |
| ファイル加工ツール | [ツール仕様](features/tools.md) | [ファイル仕様](features/files.md) |
| デザイン原則、画面構成、操作導線、テーマ | [デザイン正本](design/DESIGN.md) | [ナビゲーション仕様](features/navigation.md) |
| プロセス境界、データ構造、技術選定 | [アーキテクチャ](engineering/architecture.md) | [データモデル](engineering/data-model.md)、[設計判断](engineering/decisions.md)、[技術スタック](engineering/stack.md) |
| 依存関係、ライセンス、SBOM | [依存関係ライセンス](engineering/dependency-licenses.md) | [開発ルール](development.md) |
| リリース | [開発ルール](development.md) | [リリースチェックリスト](../.github/RELEASE_CHECKLIST.md) |

## 文書の責務

| 分類 | 場所 | 扱う内容 |
|------|------|----------|
| AI行動規範 | [AGENTS.md](../AGENTS.md) | AIエージェントの対話、判断、権限、GitHub対応 |
| プロジェクト | [docs/project/](project/overview.md) | Relicの目的、対象ユーザー、判断思想、用語 |
| 機能 | [docs/features/](features/editor.md) | ユーザーから見える機能の振る舞い |
| デザイン | [docs/design/](design/DESIGN.md) | 画面構成、画面遷移、デザインシステム |
| エンジニアリング | [docs/engineering/](engineering/architecture.md) | アーキテクチャ、データモデル、技術選定、設計判断 |
| 開発運用 | [docs/development.md](development.md) | 実装規約、検証、バージョン、リリース |

同じ判断を複数文書へ重複して書かず、上の責務に対応する正本へ反映します。

## 正本文書カタログ

この区間は `pnpm docs:index:check` の検査対象です。リンクを重複させず、正本文書を1回ずつ掲載します。

<!-- docs-catalog:start -->

### 共通・運用

| 文書 | 役割 |
|------|------|
| [AGENTS.md](../AGENTS.md) | AIエージェントの行動規範 |
| [README.md](../README.md) | 対外的なプロジェクト説明 |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | コントリビューション方針 |
| [CODE_OF_CONDUCT.md](../CODE_OF_CONDUCT.md) | コミュニティ行動規範 |
| [SECURITY.md](../SECURITY.md) | 秘密情報と脆弱性報告の方針 |
| [LICENSE](../LICENSE) | AGPL-3.0-or-laterのライセンス本文 |
| [docs/INDEX.md](INDEX.md) | 文書とコードの意味索引 |
| [docs/development.md](development.md) | Relic固有の開発ルール |
| [Release Checklist](../.github/RELEASE_CHECKLIST.md) | Gitタグ作成前とDraft Release公開前の確認 |

### プロジェクト・機能

| 文書 | 役割 |
|------|------|
| [project/overview.md](project/overview.md) | 目的、対象ユーザー、判断思想 |
| [project/terms.md](project/terms.md) | 日本語、英名、実装識別子の対応 |
| [features/commands.md](features/commands.md) | コマンドパレットとクイックスイッチャー |
| [features/editor.md](features/editor.md) | エディタ、保存、表示、出力 |
| [features/files.md](features/files.md) | ファイル、フォルダ、ワークスペース |
| [features/frontmatter.md](features/frontmatter.md) | フロントマターの表示、編集、設定 |
| [features/links.md](features/links.md) | 内部リンク、Markdownリンク、タグ |
| [features/markdown.md](features/markdown.md) | Markdown記法、図表、添付、プレビュー |
| [features/navigation.md](features/navigation.md) | 画面内の移動、タブ、パネル、設定 |
| [features/search.md](features/search.md) | 検索、結果表示、置換 |
| [features/tools.md](features/tools.md) | ファイル加工ツール |

### デザイン・エンジニアリング

| 文書 | 役割 |
|------|------|
| [design/DESIGN.md](design/DESIGN.md) | デザイン原則、画面構成、遷移、デザインシステムの正本 |
| [engineering/architecture.md](engineering/architecture.md) | プロセス境界、責務、データの流れ |
| [engineering/data-model.md](engineering/data-model.md) | データ構造とエンティティ間の関係 |
| [engineering/decisions.md](engineering/decisions.md) | 重要な技術・設計判断と理由 |
| [engineering/dependency-licenses.md](engineering/dependency-licenses.md) | 依存ライセンスとSBOMの運用 |
| [engineering/editor-engine.md](engineering/editor-engine.md) | エディタエンジンの選定と構成 |
| [engineering/file-access-boundaries.md](engineering/file-access-boundaries.md) | ローカルファイルアクセスの安全境界 |
| [engineering/stack.md](engineering/stack.md) | 確定した技術スタックと対象OS |

<!-- docs-catalog:end -->

## コードを探す

| 場所 | 役割 |
|------|------|
| `app/src/main/` | ファイル、設定、ワークスペース、IPCなどOS側の処理。索引の全体制御、キャッシュ、I/Oも責務別に配置する |
| `app/src/preload/` | レンダラーへ公開する安全なAPI |
| `app/src/renderer/` | React UI、エディタ、画面状態。機能別のcomponent、hook、model、styleを各責務の近くに配置する |
| `app/src/shared/` | main、preload、rendererで共有する型と純粋関数 |
| `app/scripts/` | ビルド、検証、生成、ソース肥大化確認の補助スクリプト |
| `.github/` | Issue、Pull Request、Actions、リリース設定 |
| `.githooks/` | ローカルGitフックと秘密情報検知 |

ファイル名は `rg --files`、内容は `rg '<検索語>'`、Git追跡中の全ファイルは `git ls-files` で検索します。
階層表示が必要な場合は `app/` で `pnpm docs:tree` を実行します。このコマンドは標準出力へ表示するだけで、文書を変更しません。

## 索引の検証

`app/` で `pnpm docs:index:check` を実行すると、ローカルリンクの存在とGit追跡状態、正本文書カタログの掲載漏れと重複を確認できます。
新しい正本文書を追加した場合は、役割を判断して正本文書カタログへ1回だけ追加します。
