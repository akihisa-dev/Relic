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
| 履歴 | `docs/development/phases/P0.md` 以降の各フェーズ正本の「作業記録」 | 旧フェーズ文書と旧日誌から統合した過去記録はP0に残し、現在の作業記録は現在フェーズ正本に追記する |

現行実装と文書の整合を確認する場合は、現行正本を実装に合わせて更新する。
統合済み履歴は、過去記録としての意味を保つため、現行仕様に合わせた書き換え対象にしない。
検索で統合済み履歴が見つかった場合も、現行仕様の根拠にはせず、必ず上記分類の正本文書を確認する。

---

## ドキュメントマップ

| ファイル | 内容 |
|----------|------|
| [document-rules.md](document-rules.md) | ドキュメント作成・管理の全体ルール |
| [project/overview.md](project/overview.md) | Relicの目的、対象ユーザー、判断思想、リポジトリ構成 |
| [project/terms.md](project/terms.md) | 用語定義。コード・UI・ドキュメントで使う言葉の統一基準 |
| [features/](features/) | 機能の振る舞い・詳細仕様 |
| [design/DESIGN.md](design/DESIGN.md) | デザイン正本。デザインシステム、画面一覧と構成、画面遷移フロー |
| [engineering/architecture.md](engineering/architecture.md) | アーキテクチャ全体像 |
| [engineering/data-model.md](engineering/data-model.md) | データモデル定義 |
| [engineering/decisions.md](engineering/decisions.md) | 設計上の意思決定記録 |
| [engineering/stack.md](engineering/stack.md) | 技術スタック |
| [engineering/editor-engine.md](engineering/editor-engine.md) | エディタエンジン選定 |
| [development/phases.md](development/phases.md) | 開発フェーズ管理の正本。現在位置と読む文書を判断する入口 |
| [development/phases/P0.md](development/phases/P0.md) | P0正本。開発環境再構築フェーズの記録と、旧フェーズ文書・旧日誌から統合した過去記録を含む |
| [development/phases/P1.md](development/phases/P1.md) | P1正本。暦設定の実装フェーズの対象範囲、ルール、作業記録 |
| [development/phases/P2.md](development/phases/P2.md) | P2正本。マークダウンエディタとファイルビュー関連フェーズの対象範囲、ルール、作業記録 |
| [development/phases/P3.md](development/phases/P3.md) | P3正本。UI/UX改善フェーズの対象範囲、ルール、作業記録 |
| [development/phases/P4.md](development/phases/P4.md) | P4正本。機能追加フェーズの対象範囲、ルール、作業記録 |
| [development/phases/P5.md](development/phases/P5.md) | P5正本。実用機能の実装と細部の調整フェーズの対象範囲、ルール、作業記録 |
| [development/phases/P6.md](development/phases/P6.md) | P6正本。コンセプト再定義と安定化準備フェーズの対象範囲、ルール、作業記録 |
| [development/phases/P7.md](development/phases/P7.md) | P7正本。AIワークスペースフェーズの対象範囲、ルール、作業記録 |
| [development/phases/P8.md](development/phases/P8.md) | P8正本。UI・ビジュアルデザインフェーズの対象範囲、ルール、作業記録 |
| [development/phases/P9.md](development/phases/P9.md) | P9正本。全リファクタリングフェーズの対象範囲、ルール、作業記録 |
| [development/phases/P10.md](development/phases/P10.md) | P10正本。機能改善・追加・小規模修正フェーズの対象範囲、ルール、作業記録 |
| [development/phases/P11.md](development/phases/P11.md) | 現在フェーズ正本。マークダウンエディタ改善フェーズの対象範囲、ルール、作業記録 |
| [development/questions.md](development/questions.md) | 未決定事項の正本 |
| [development/coding-rules.md](development/coding-rules.md) | コーディング規約 |
| [development/testing-rules.md](development/testing-rules.md) | テスト方針 |
| [development/versioning-rules.md](development/versioning-rules.md) | バージョン管理ルール |

`AGENTS.md` はAIエージェント向けルールの正本です。
別のAI向け入口文書は作らず、ルールは `AGENTS.md` にだけ置きます。

Relicのライセンスはリポジトリルートの `LICENSE` を正本とし、SPDX表記は `AGPL-3.0-or-later` とします。コントリビューション方針は `CONTRIBUTING.md` を参照します。
