# dev/phases.md

Relicの開発フェーズを管理する正本。
AIは `AI.md` と `docs/product/project.md` の次にこのファイルを読み、現在フェーズと必要文書を判断する。

---

## 読み方

- `status: current` が現在の作業フェーズ
- `status: done` は完了済み。通常は詳細文書を読まない
- `status: future` は未着手。現在フェーズに関係するときだけ読む
- このファイルには、現在フェーズ、フェーズ一覧、フェーズ状態、正本文書への参照だけを書く
- チェックリスト本文はこのファイルに複製しない。進捗は `checklist` に書かれた正本を参照する
- 現在フェーズでは `checklist` の正本を最初に読む。フェーズ別の詳しい読み込みルールは各フェーズ正本に書く
- フェーズ別の注意、作業方針、読み込みルール、進捗、完了条件はこのファイルへ追記しない
- 現在フェーズが変わったら、このファイルの `status` と `current` を更新する
- フェーズが完了しても次フェーズへ自動遷移しない。ユーザーが次フェーズを明示した場合だけ `current` を更新する

---

## コンテキスト階層

各文書は、自分の階層で必要なことだけを扱う。
上位文書に下位文書の詳細を混ぜない。

| 階層 | 文書 | ここで認識すること | ここでは認識しないこと |
|------|------|--------------------|------------------------|
| 1. AI行動規約 | `../../AI.md` | AIの行動制約、確認ルール、編集ルール | Relic固有の仕様・現在地・実装詳細 |
| 2. プロジェクト概要 | `../product/project.md` | Relicが何のアプリか、対象ユーザー、リポジトリ構成 | 詳細仕様、現在フェーズ、作業チェックリスト |
| 3. 開発フェーズ | `phases.md` | 今どのフェーズか、読むべき正本文書 | チェック項目本文、仕様本文、実装細目 |
| 4. 現在フェーズ正本 | 例: `phases/P9-feature-checklist.md` | そのフェーズで確認・実行する項目 | 他フェーズの詳細、過去の経緯 |
| 5. 詳細参照 | `../spec/`, `../ui/`, `../tech/`, `../architecture/` | 現在作業に必要な正解だけ | 無関係な仕様・履歴 |
| 6. 履歴 | `../journal/` | 経緯確認が必要なときの過去ログ | 現在の正本としての判断 |

---

## 現在フェーズ

```yaml
current: P26
summary: デザイン・UI刷新
checklist: phases/P26-design-ui-refresh.md
```

---

## フェーズ一覧

| ID | フェーズ | status | 正本・参照 |
|----|----------|--------|------------|
| P0 | プロダクト意図・対象ユーザー整理 | done | `phases/P0-product-principles.md`, `../product/principles.md`, `../product/PLAN.md` |
| P1 | 機能収集・仕様化 | done | `phases/P1-specification.md`, `../spec/` |
| P2 | 技術選定・設計判断 | done | `phases/P2-tech-architecture.md`, `../tech/`, `../architecture/decisions.md` |
| P3 | 実装前ドキュメント整備 | done | `phases/P3-preimplementation-docs.md`, `conventions.md`, `testing.md`, `open-questions.md` |
| P4 | 基礎実装 | done | `phases/P4-foundation-implementation.md`, `../tech/stack.md`, `../architecture/overview.md`, `../spec/file-management.md`, `../spec/navigation.md`, `../spec/editor.md`, `../spec/markdown.md`, `../spec/links-and-tags.md`, `../spec/search.md` |
| P5 | フロントマターとコマンド操作 | done | `phases/P5-frontmatter-command.md`, `../spec/frontmatter.md`, `../spec/command-palette.md` |
| P6 | 変更管理検討 | done | `phases/P6-change-safety.md` |
| P7 | ファイル加工ツールと仕上げ | done | `phases/P7-file-tools.md`, `../spec/file-tools.md` |
| P8 | UI総点検・設計照合 | done | `phases/P8-ui-audit.md`, `../ui/screens-macos.md`, `../ui/navigation.md`, `../ui/DESIGN.md` |
| P9 | 機能確認・不具合修正 | done | `phases/P9-feature-checklist.md` |
| P10 | 自分用ビルド安定化 | done | `phases/P10-build-stabilization.md`, `testing.md`, `../tech/stack.md` |
| P11 | 文書・コード整合化 | done | `phases/P11-doc-code-alignment.md` |
| P12 | 大規模リファクタリング・安全性強化 | done | `phases/P12-refactoring-security-plan.md`, `conventions.md`, `testing.md` |
| P13 | 配布判断・リリース準備 | done | `phases/P13-release-readiness.md`, `../product/PLAN.md`, `../architecture/decisions.md` |
| P14 | 外部連携の安全検討 | done | `phases/P14-external-safety.md`, `../architecture/decisions.md` |
| P15 | UI/UXの洗練（AI起案・取り下げ） | rejected | `phases/P15-rejected-ai-ui-ux-polish.md` |
| P16 | UI/UXの洗練（ヒアリング起点） | done | `phases/P16-ui-ux-polish.md`, `../ui/screens-macos.md`, `../ui/navigation.md`, `../ui/DESIGN.md` |
| P17 | 機能再考（ヒアリング起点） | done | `phases/P17-feature-reconsideration.md`, 必要に応じて `../spec/`, `../product/PLAN.md`, `../product/principles.md` |
| P18 | UX/UIデザイン修正 | done | `phases/P18-ui-ux-design-fixes.md`, `../ui/screens-macos.md`, `../ui/navigation.md`, `../ui/DESIGN.md` |
| P19 | リファクタリングおよび整理 | done | `phases/P19-refactoring-organization.md`, `conventions.md`, `testing.md`, 必要に応じて `../architecture/overview.md` |
| P20 | 大型機能追加 | done | `phases/P20-major-feature-addition.md`, `conventions.md`, `testing.md`, 必要に応じて `../spec/`, `../architecture/overview.md`, `../ui/` |
| P21 | 文書整理 | done | `phases/P21-document-organization.md`, 必要に応じて `../INDEX.md`, `../spec/`, `../ui/`, `../architecture/`, `../tech/`, `../../README.md` |
| P22 | チャートビューアップグレード | done | `phases/P22-chart-view-upgrade.md`, `conventions.md`, `testing.md`, 必要に応じて `../spec/navigation.md`, `../ui/screens-macos.md`, `../ui/navigation.md`, `../ui/DESIGN.md`, `../architecture/overview.md` |
| P23 | 大規模リファクタリング | done | `phases/P23-large-refactoring.md`, `conventions.md`, `testing.md`, 必要に応じて `../architecture/overview.md`, `../architecture/decisions.md`, `../spec/`, `../ui/` |
| P24 | 全般修正 | done | `phases/P24-general-fixes.md`, `conventions.md`, `testing.md`, 必要に応じて `../spec/`, `../ui/`, `../architecture/overview.md` |
| P25 | グラフビューアップグレード | done | `phases/P25-graph-view-upgrade.md`, `conventions.md`, `testing.md`, 必要に応じて `../spec/`, `../ui/`, `../architecture/overview.md` |
| P26 | デザイン・UI刷新 | current | `phases/P26-design-ui-refresh.md`, `conventions.md`, `testing.md`, `../ui/DESIGN.md`, `../ui/screens-macos.md`, `../ui/navigation.md`, 必要に応じて `../spec/`, `../architecture/overview.md` |

### 取り下げた非正当フェーズ

P15はAIが先に方針を作りすぎたため、正当な開発フェーズとしては扱わない。
成果物は戻さないが、この方針自体は現在フェーズの根拠にしない。

- `phases/P15-rejected-ai-ui-ux-polish.md`

---

## 更新ルール

- フェーズ状態はこのファイルにだけ書く
- このファイルにはフェーズ別の詳細本文を置かない。詳細は必ず `phases/P*.md` の正本へ書く
- 機能確認の進捗は `phases/P9-feature-checklist.md` にだけ書く
- 実装済み作業の細目をこのファイルへ増やさない。必要なら該当仕様・ADR・ジャーナルへリンクする
- 新しい作業が始まったら、既存フェーズに入るか、新しいフェーズを追加するかを先に判断する
