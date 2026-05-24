# docs/INDEX.md

このファイルはドキュメント群の索引です。
AIのセッション開始時は、`../AGENTS.md` から [product/project.md](product/project.md)、[dev/phases.md](dev/phases.md) の順に進みます。

---

## 文書分類

| 分類 | 対象 | 扱い |
|------|------|------|
| 現行正本 | `README.md`, `AGENTS.md`, `docs/product/`, `docs/spec/`, `docs/ui/`, `docs/architecture/`, `docs/tech/`, `docs/dev/phases.md`, 現在フェーズ正本, `docs/dev/conventions.md`, `docs/dev/testing.md`, `docs/dev/open-questions.md` | 現行の実装・仕様・運用判断に使う |
| 入口・索引 | `docs/INDEX.md`, `docs/_rules.md` | 正本への導線と文書運用だけを扱う |
| テンプレート | `docs/spec/_template.md`, `docs/dev/template.md`, `docs/journal/_template.md` | 新規文書や今後の開発へ流用する形式。Relic固有仕様の正本ではない |
| 履歴 | `docs/journal/` | 当時の作業・判断の記録。現在の正本として扱わず、過去記述を現行基準で書き換えない |
| アーカイブ | `docs/archive/` | 過去の静的モックや検討資料。現行仕様判断では参照しない |
| 素材 | `docs/assets/` | ロゴ案などの検討素材。仕様・運用の正本ではない |

現行実装と文書の整合を確認する場合は、現行正本を実装に合わせて更新する。
履歴・アーカイブは、過去記録としての意味を保つため、現行仕様に合わせた書き換え対象にしない。

### 履歴資料の読み方

- `docs/journal/` は、作業の時系列、当時の判断理由、経緯確認にだけ使う。現在の仕様や実装状態は、現行正本と実装アプリで確認する
- `docs/archive/` は、過去の静的モックや検討資料を残す場所。画面構成、操作、UI文言、技術構成の現行判断には使わない
- 完了済み・取り下げ済みの過去フェーズ文書は履歴として扱う。現在の作業判断は `dev/phases.md` の `current` と現在フェーズ正本を優先する
- 履歴と現行正本が食い違う場合は、履歴を書き換えず、現行正本側を実装アプリに合わせて更新する

---

## ドキュメントマップ

| ファイル | 内容 |
|----------|------|
| [_rules.md](_rules.md) | ドキュメント作成・管理の全体ルール |
| [product/project.md](product/project.md) | 内部向けプロジェクト概要。AIがプロジェクト前提を把握する入口 |
| [product/PLAN.md](product/PLAN.md) | アプリ設計計画書。確定事項・技術スタックの大枠 |
| [product/principles.md](product/principles.md) | 設計思想・対象ユーザー・ポジショニング |
| [product/glossary.md](product/glossary.md) | 用語定義。コード・UI・ドキュメントで使う言葉の統一基準 |
| [product/](product/) | プロジェクト固有のプロダクト前提 |
| [dev/phases.md](dev/phases.md) | 開発フェーズ管理の正本。現在位置と読む文書を判断する入口 |
| [dev/phases/](dev/phases/) | 各フェーズ専用の計画・チェックリスト・判断メモ |
| [dev/template.md](dev/template.md) | 今後の開発プロジェクトへ流用する文書・リポジトリ構造テンプレート |
| [dev/open-questions.md](dev/open-questions.md) | 未決定事項の正本 |
| [dev/conventions.md](dev/conventions.md) | コーディング規約 |
| [dev/testing.md](dev/testing.md) | テスト方針 |
| [spec/](spec/) | 機能の振る舞い・詳細仕様 |
| [architecture/overview.md](architecture/overview.md) | アーキテクチャ全体像 |
| [architecture/data-model.md](architecture/data-model.md) | データモデル定義 |
| [architecture/decisions.md](architecture/decisions.md) | 設計上の意思決定記録（ADR） |
| [tech/](tech/) | 技術スタック・技術選定 |
| [ui/DESIGN.md](ui/DESIGN.md) | デザインシステム。カラーパレット・タイポグラフィ・スペーシング・コンポーネント定義 |
| [ui/screens-macos.md](ui/screens-macos.md) | macOSの画面一覧と構成 |
| [ui/navigation.md](ui/navigation.md) | 画面遷移フロー |
| [assets/](assets/) | ロゴ案などの設計・検討素材 |
| [journal/_template.md](journal/_template.md) | 開発日誌のエントリーテンプレート |

`AGENTS.md` はAIエージェント向けルールの正本です。
別のAI向け入口文書は作らず、ルールは `AGENTS.md` にだけ置きます。
