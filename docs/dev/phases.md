# dev/phases.md

Relicの開発フェーズを管理する正本。
AIは `AI.md` と `docs/product/project.md` の次にこのファイルを読み、現在フェーズと必要文書を判断する。

---

## 読み方

- `status: current` が現在の作業フェーズ
- `status: done` は完了済み。通常は詳細文書を読まない
- `status: future` は未着手。現在フェーズに関係するときだけ読む
- チェックリスト本文はこのファイルに複製しない。進捗は `checklist` に書かれた正本を参照する
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
current: P21
summary: 文書整理
checklist: phases/P21-document-organization.md
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
| P21 | 文書整理 | current | `phases/P21-document-organization.md`, 必要に応じて `../INDEX.md`, `../spec/`, `../ui/`, `../architecture/`, `../tech/`, `../../README.md` |

### 取り下げた非正当フェーズ

P15はAIが先に方針を作りすぎたため、正当な開発フェーズとしては扱わない。
成果物は戻さないが、この方針自体は現在フェーズの根拠にしない。

- `phases/P15-rejected-ai-ui-ux-polish.md`

---

## フェーズ別の読み込みルール

### P21-document-organization

Relicの文書整理フェーズ。

AIはこのフェーズを前提にユーザーへ接する。
Relicで作ってきた文書構成・開発運用・リポジトリ構成を、今後の開発でも雛形として使える普遍的な構造へ整える。
対象はアプリ本体だけではなく、AI運用、開発規約、テスト方針、日誌、索引、README、補助ファイルなど、アプリ本体以外の周辺構成も含む。

最初に読む:

- `phases/P21-document-organization.md`

必要になったときだけ読む:

- 文書索引: `../INDEX.md`
- 文書ルール: `../_rules.md`
- AI向け入口: `../../AI.md`, `../../AGENTS.md`, `../../CLAUDE.md`
- 対象機能の正解: 対応する `../spec/*.md`
- UI文書: `../ui/screens-macos.md`, `../ui/navigation.md`, `../ui/DESIGN.md`
- アーキテクチャ文書: `../architecture/overview.md`, `../architecture/decisions.md`, `../architecture/data-model.md`
- 技術文書: `../tech/`
- 対外説明: `../../README.md`

注意:

- 仕様変更、UI方針変更、技術選定変更を文書整理に混ぜない
- ユーザーが指定した文書範囲を越えて編集しない
- Relic固有の内容と、他プロジェクトにも流用できる構造を分けて扱う
- 文書の削除・統合・大きな移動は、対象と理由を説明してから進める
- コード変更が必要になった場合は、文書整理として実施せずユーザーに確認する
- `docs/dev/phases.md` と `docs/journal/` は、ユーザー指示またはフェーズ区切り時だけ更新する

---

### P20-major-feature-addition

Relicに大型機能を追加するフェーズ。

AIはこのフェーズを前提にユーザーへ接する。
大型機能は影響範囲が広いため、実装前に目的・対象ユーザー・現在の仕様との差分・UI導線・保存形式・テスト方法を確認してから進める。

最初に読む:

- `phases/P20-major-feature-addition.md`

必要になったときだけ読む:

- 実装規約: `conventions.md`
- テスト方針: `testing.md`
- 対象機能の正解: 対応する `../spec/*.md`
- UIへの影響がある場合: `../ui/screens-macos.md`, `../ui/navigation.md`, `../ui/DESIGN.md`
- アーキテクチャ前提: `../architecture/overview.md`, `../architecture/decisions.md`

注意:

- ユーザーが指定した大型機能だけを対象にする
- 仕様・UI・保存形式・IPC APIを勝手に決めない
- 実装前に、最小の縦切り単位と検証方法を明示する
- 変更後は `pnpm typecheck` と、対象に応じたテストを確認する
- P20正本に日誌を書かない。フェーズ文書には、機能ごとの判断・進捗だけを残す

---

### P19-refactoring-organization

Relicのコード・文書・構成を、既存挙動を保ったまま整理するフェーズ。

AIはこのフェーズを前提にユーザーへ接する。
AIが先に大規模な全面改修へ進まず、対象を小さく区切って、目的・影響範囲・確認方法を明示してから作業する。

最初に読む:

- `phases/P19-refactoring-organization.md`

必要になったときだけ読む:

- 実装規約: `conventions.md`
- テスト方針: `testing.md`
- アーキテクチャ前提: `../architecture/overview.md`
- 対象機能の正解: 対応する `../spec/*.md`
- UIへの影響がある場合: `../ui/screens-macos.md`, `../ui/navigation.md`, `../ui/DESIGN.md`

注意:

- 仕様変更・機能追加・UI変更をリファクタリングに混ぜない
- 1回の変更範囲を小さくし、挙動維持を確認できるテストまたは型チェックを行う
- 整理のために既存のユーザー確認済み挙動を戻さない
- 大きな分割・削除・依存整理が必要な場合は、対象と戻し方を説明してから進める

---

### P18-ui-ux-design-fixes

RelicのUX/UIデザインを、ユーザーが指定した画面・状態・違和感を起点に修正するフェーズ。

AIはこのフェーズを前提にユーザーへ接する。
AIが先に全体チェックリスト・修正案一覧・デザイン方針を作らず、ユーザーが気になっている画面や状態を聞いてから作業範囲を決める。

最初に読む:

- `phases/P18-ui-ux-design-fixes.md`

必要になったときだけ読む:

- UI構成を確認する: `../ui/screens-macos.md`, `../ui/navigation.md`
- デザイン原則を確認する: `../ui/DESIGN.md`
- 挙動の正解を確認する: 対応する `../spec/*.md`
- 実装規約とテスト方針を確認する: `conventions.md`, `testing.md`

注意:

- ユーザーが指定した画面・場所・操作対象だけを変更する
- 見た目の修正に機能追加・導線追加・仕様変更を混ぜない
- 実装したUX/UI判断は、実施したことだけをチェックリストとして記録する
- `../ui/DESIGN.md` は、ユーザーがこのファイル自体の原則変更を明示した場合だけ編集する

---

### P17-feature-reconsideration

Relicの機能を、ユーザーへのヒアリングを起点に再考するフェーズ。

AIはこのフェーズを前提にユーザーへ接する。
AIが先に機能一覧・削除案・追加案・再設計案を作らず、ユーザーが気になっている機能や違和感を聞いてから作業範囲を決める。

最初に読む:

- `phases/P17-feature-reconsideration.md`

必要になったときだけ読む:

- プロダクト意図を確認する: `../product/principles.md`, `../product/PLAN.md`
- 既存仕様を確認する: 対応する `../spec/*.md`
- UIへの影響を確認する: `../ui/screens-macos.md`, `../ui/navigation.md`, `../ui/DESIGN.md`
- 実装規約とテスト方針を確認する: `conventions.md`, `testing.md`

注意:

- 機能追加・削除・仕様変更は、対象機能と方向性がユーザーと合意されてから行う
- 「便利そう」だけを理由に機能を増やさない
- 既存機能を削る場合は、影響範囲・代替手段・戻しやすさを確認してから進める

---

### P16-ui-ux-polish

RelicのUI/UXを、ユーザーへのヒアリングを起点に洗練するフェーズ。

AIはこのフェーズを前提にユーザーへ接する。
AIが先に方針・チェックリスト・実装内容を作らず、ユーザーの違和感や希望を聞いてから作業範囲を決める。

最初に読む:

- `phases/P16-ui-ux-polish.md`

必要になったときだけ読む:

- UI構成を確認する: `../ui/screens-macos.md`, `../ui/navigation.md`
- デザイン原則を確認する: `../ui/DESIGN.md`
- 挙動の正解を確認する: 対応する `../spec/*.md`
- 実装規約とテスト方針を確認する: `conventions.md`, `testing.md`

注意:

- 見た目だけでなく、書く道具としての気持ちよさ、主従関係、操作の流れを重視する
- ユーザーが「やりたい」「こうしたい」と言っただけで、仕様・フェーズ・チェックリスト・デザイン方針を勝手に作らない
- 方針化・正本化・実装の前に、必ずユーザーへヒアリングする

---

### P9-runtime-verification

今の通常作業。
AIはこのフェーズを前提にユーザーへ接する。
汎用的な「何をしますか？」ではなく、`phases/P9-feature-checklist.md` の次に進める範囲を具体的に提示する。

最初に読む:

- `phases/P9-feature-checklist.md`

必要になったときだけ読む:

- 挙動の正解を確認する: 対応する `../spec/*.md`
- UI構成を確認する: `../ui/screens-macos.md` または `../ui/navigation.md`
- デザイン原則を確認する: `../ui/DESIGN.md`
- 実装規約を確認する: `conventions.md`
- テスト方針を確認する: `testing.md`
- 過去の経緯を確認する: `../journal/` の該当日

読まない:

- 完了済みフェーズの詳細文書
- ジャーナル全体
- モックアップ一式

注意:

- `../ui/DESIGN.md` は通底するデザイン原則。個別アプリの開発状況・機能仕様・設定・判断を書き込まない
- `../ui/DESIGN.md` は、ユーザーがこのファイル自体のデザイン原則を変更すると明示した場合だけ編集する

---

### P12-refactoring-security

大規模リファクタリングと安全性強化フェーズ。

AIはこのフェーズを前提にユーザーへ接する。
優先度は、1. 機能維持、2. セキュリティ、3. 安定性、4. 軽量化。
大きな変更は小さい単位に分け、各単位で型検査・自動テストを確認する。

最初に読む:

- `phases/P12-refactoring-security-plan.md`

必要になったときだけ読む:

- 実装規約と安全ルール: `conventions.md`
- テスト方針: `testing.md`
- Electron / アーキテクチャ判断: `../architecture/overview.md`, `../architecture/decisions.md`
- UI変更を伴う場合: `../ui/screens-macos.md`, `../ui/navigation.md`, `../ui/DESIGN.md`

作業の進め方:

1. `phases/P12-refactoring-security-plan.md` の順序に従い、1回の変更範囲を小さく切る
2. 変更前に対象ファイル・影響範囲・確認方法を短く説明する
3. 機能維持を最優先し、既存UI・既存IPC API・既存データ形式を不用意に変えない
4. Electron / IPC / ファイル操作は、セキュリティ境界を弱めない
5. 変更後は `pnpm exec tsc --noEmit` と `pnpm test` を基本確認にする
6. 依存関係監査など外部サービスへ情報を送る確認は、ユーザーの明示許可を得てから実施する

注意:

- 大規模リファクタリング中も仕様変更を混ぜない
- 挙動変更が必要になった場合は、理由・選択肢・影響を説明してユーザーに確認する
- セキュリティ強化で既存機能に影響が出る場合は、機能維持と安全性のトレードオフを明示する

---

### P11-doc-code-alignment

文書とコードの不一致を解消するフェーズ。

AIはこのフェーズを前提にユーザーへ接する。
最初に `phases/P11-doc-code-alignment.md` の「判断が必要な項目まとめ」を提示し、
1項目ずつユーザーに決定を求めること。決定後、合意した方向でコードまたは文書を修正する。

最初に読む:

- `phases/P11-doc-code-alignment.md`

必要になったときだけ読む:

- 修正対象のコード: `app/src/` 配下の該当ファイル
- 修正対象の仕様書: `../spec/` 配下の該当ファイル
- 修正対象の設計書: `../architecture/` 配下の該当ファイル
- 過去の判断経緯: `../journal/` の該当日

作業の進め方:

1. `phases/P11-doc-code-alignment.md` の「判断が必要な項目 まとめ」表を開く
2. 🔴 の項目から順に、ユーザーに「コード正・実装・省略」を1問ずつ確認する
3. 決定したら `phases/P11-doc-code-alignment.md` の「決定」欄を埋める
4. 全項目の決定が終わったら、合意した変更をコードまたは文書に反映する
5. 変更後、`phases/P9-feature-checklist.md` と関連する spec ファイルを更新する

注意:

- 1セッションで全項目を解決しようとしない。決定→修正→確認のサイクルを短くする
- 「コード正」の場合は文書だけを変更する。「実装」の場合はコード変更も伴う
- 実装を伴う変更は、変更前に影響範囲をユーザーに説明してから着手する

---

## 更新ルール

- フェーズ状態はこのファイルにだけ書く
- 機能確認の進捗は `phases/P9-feature-checklist.md` にだけ書く
- 実装済み作業の細目をこのファイルへ増やさない。必要なら該当仕様・ADR・ジャーナルへリンクする
- 新しい作業が始まったら、既存フェーズに入るか、新しいフェーズを追加するかを先に判断する
