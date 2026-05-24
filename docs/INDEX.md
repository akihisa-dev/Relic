# docs/INDEX.md

このファイルはドキュメント群の索引です。
AIのセッション開始時は、`../AGENTS.md` から [project/overview.md](project/overview.md)、[development/phases.md](development/phases.md) の順に進みます。

---

## 文書分類

| 分類 | 対象 | 扱い |
|------|------|------|
| 入口・索引 | `docs/INDEX.md`, `docs/document-rules.md` | 正本への導線と文書運用だけを扱う |
| プロジェクト | `docs/project/` | Relicの目的、対象ユーザー、用語 |
| 機能 | `docs/features/` | アプリ機能の振る舞い |
| デザイン | `docs/design/` | 画面構成、画面遷移、デザインシステム |
| エンジニアリング | `docs/engineering/` | アーキテクチャ、データモデル、技術選定、設計判断 |
| 開発運用 | `docs/development/` | フェーズ、開発規約、検証方針、未決定事項 |
| 履歴 | `docs/development/phases/P0.md` の「過去作業記録（統合）」 | 旧フェーズ文書と旧日誌から、今後の判断に必要な履歴だけを統合した記録 |

現行実装と文書の整合を確認する場合は、現行正本を実装に合わせて更新する。
統合済み履歴は、過去記録としての意味を保つため、現行仕様に合わせた書き換え対象にしない。

---

## ドキュメントマップ

| ファイル | 内容 |
|----------|------|
| [document-rules.md](document-rules.md) | ドキュメント作成・管理の全体ルール |
| [project/overview.md](project/overview.md) | Relicの目的、対象ユーザー、判断思想、リポジトリ構成 |
| [project/terms.md](project/terms.md) | 用語定義。コード・UI・ドキュメントで使う言葉の統一基準 |
| [features/](features/) | 機能の振る舞い・詳細仕様 |
| [design/system.md](design/system.md) | デザインシステム。カラーパレット・タイポグラフィ・スペーシング・コンポーネント定義 |
| [design/screens.md](design/screens.md) | 画面一覧と構成 |
| [design/navigation.md](design/navigation.md) | 画面遷移フロー |
| [engineering/architecture.md](engineering/architecture.md) | アーキテクチャ全体像 |
| [engineering/data-model.md](engineering/data-model.md) | データモデル定義 |
| [engineering/decisions.md](engineering/decisions.md) | 設計上の意思決定記録 |
| [engineering/stack.md](engineering/stack.md) | 技術スタック |
| [engineering/editor-engine.md](engineering/editor-engine.md) | エディタエンジン選定 |
| [development/phases.md](development/phases.md) | 開発フェーズ管理の正本。現在位置と読む文書を判断する入口 |
| [development/phases/P0.md](development/phases/P0.md) | 現在フェーズ正本。旧フェーズ文書と旧日誌から統合した過去作業記録も含む |
| [development/questions.md](development/questions.md) | 未決定事項の正本 |
| [development/coding-rules.md](development/coding-rules.md) | コーディング規約 |
| [development/testing-rules.md](development/testing-rules.md) | テスト方針 |
| [development/versioning-rules.md](development/versioning-rules.md) | バージョン管理ルール |

`AGENTS.md` はAIエージェント向けルールの正本です。
別のAI向け入口文書は作らず、ルールは `AGENTS.md` にだけ置きます。
