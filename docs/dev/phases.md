# dev/phases.md

Relicの開発フェーズを管理する正本。
AIは `AI.md` と `docs/project.md` の次にこのファイルを読み、現在フェーズと必要文書を判断する。

---

## 読み方

- `status: current` が現在の作業フェーズ
- `status: done` は完了済み。通常は詳細文書を読まない
- `status: future` は未着手。現在フェーズに関係するときだけ読む
- `P-hold` はフェーズ完了後の駐留地点。次の作業フェーズをユーザーと決めるために使う
- チェックリスト本文はこのファイルに複製しない。進捗は `checklist` に書かれた正本を参照する
- 現在フェーズが変わったら、このファイルの `status` と `current` を更新する
- フェーズが完了しても次フェーズへ自動遷移しない。完了フェーズを `done` にし、いったん `P-hold` を `current` にする

---

## コンテキスト階層

各文書は、自分の階層で必要なことだけを扱う。
上位文書に下位文書の詳細を混ぜない。

| 階層 | 文書 | ここで認識すること | ここでは認識しないこと |
|------|------|--------------------|------------------------|
| 1. AI行動規約 | `../../AI.md` | AIの行動制約、確認ルール、編集ルール | Relic固有の仕様・現在地・実装詳細 |
| 2. プロジェクト概要 | `../project.md` | Relicが何のアプリか、対象ユーザー、リポジトリ構成 | 詳細仕様、現在フェーズ、作業チェックリスト |
| 3. 開発フェーズ | `phases.md` | 今どのフェーズか、読むべき正本文書 | チェック項目本文、仕様本文、実装細目 |
| 4. 現在フェーズ正本 | 例: `phases/P09-feature-checklist.md` | そのフェーズで確認・実行する項目 | 他フェーズの詳細、過去の経緯 |
| 5. 詳細参照 | `../spec/`, `../ui/`, `../tech/`, `../architecture/` | 現在作業に必要な正解だけ | 無関係な仕様・履歴 |
| 6. 履歴 | `../journal/` | 経緯確認が必要なときの過去ログ | 現在の正本としての判断 |

---

## 現在フェーズ

```yaml
current: P12
summary: 大規模リファクタリング・安全性強化
checklist: phases/P12-refactoring-security-plan.md
```

---

## フェーズ一覧

| ID | フェーズ | status | 正本・参照 |
|----|----------|--------|------------|
| P-4 | プロダクト意図・対象ユーザー整理 | done | `../principles.md`, `../PLAN.md` |
| P-3 | 機能収集・仕様化 | done | `../spec/` |
| P-2 | 技術選定・設計判断 | done | `../tech/`, `../architecture/decisions.md` |
| P-1 | 実装前ドキュメント整備 | done | `conventions.md`, `testing.md`, `open-questions.md` |
| P0 | プロジェクト基盤 | done | `../tech/stack.md`, `../architecture/overview.md` |
| P1 | ワークスペースとファイル管理 | done | `../spec/file-management.md`, `../spec/navigation.md` |
| P2 | エディタ基本体験 | done | `../spec/editor.md`, `../spec/markdown.md` |
| P3 | Markdownライブプレビュー | done | `../spec/editor.md`, `../spec/markdown.md`, `../spec/links-and-tags.md` |
| P4 | リンク・タグ・検索 | done | `../spec/links-and-tags.md`, `../spec/search.md` |
| P5 | フロントマターとコマンド操作 | done | `../spec/frontmatter.md`, `../spec/command-palette.md` |
| P6 | Git・GitHub連携 | done | `../spec/github.md`, `../tech/git-implementation.md` |
| P7 | ファイル加工ツールと仕上げ | done | `../spec/file-tools.md`, `../spec/github.md` |
| P8 | UI総点検・設計照合 | done | `../ui/screens-macos.md`, `../ui/navigation.md`, `../ui/DESIGN.md` |
| P9 | 機能確認・不具合修正 | done | `phases/P09-feature-checklist.md` |
| P10 | 自分用ビルド安定化 | done | `testing.md`, `../tech/stack.md` |
| P11 | 文書・コード整合化 | done | `phases/P11-doc-code-alignment.md` |
| P-hold | 駐留・次フェーズ判断 | done | `phases.md`, 必要に応じて直前フェーズの正本 |
| P12 | 大規模リファクタリング・安全性強化 | current | `phases/P12-refactoring-security-plan.md`, `conventions.md`, `testing.md` |
| P13 | 配布判断・リリース準備 | future | `../PLAN.md`, `../architecture/decisions.md` |

---

## フェーズ別の読み込みルール

### P9-runtime-verification

今の通常作業。
AIはこのフェーズを前提にユーザーへ接する。
汎用的な「何をしますか？」ではなく、`phases/P09-feature-checklist.md` の次に進める範囲を具体的に提示する。

最初に読む:

- `phases/P09-feature-checklist.md`

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

### P-hold

フェーズ完了後の駐留地点。
AIは次フェーズへ自動的に進まず、完了した内容・残っているリスク・次の候補を短く整理して、ユーザーに次へ進むか、追加確認するかを確認する。

最初に読む:

- `phases.md`

必要になったときだけ読む:

- 直前に完了したフェーズの正本
- 次候補フェーズの正本
- 経緯確認が必要な場合の `../journal/` 該当日

作業の進め方:

1. 直前フェーズが本当に `done` になっていることを確認する
2. 次候補フェーズを提示する
3. ユーザーが明示した場合だけ、次フェーズを `current` に変更する

注意:

- `P-hold` 中に次フェーズの実装へ勝手に着手しない
- 次フェーズへ進む前に、必要なら未コミット差分・テスト状況・残リスクを確認する

---

### P12-refactoring-security

大規模リファクタリングとGitHub本格導入前の安全性強化フェーズ。

AIはこのフェーズを前提にユーザーへ接する。
優先度は、1. 機能維持、2. セキュリティ、3. 安定性、4. 軽量化。
大きな変更は小さい単位に分け、各単位で型検査・自動テストを確認する。

最初に読む:

- `phases/P12-refactoring-security-plan.md`

必要になったときだけ読む:

- 実装規約と安全ルール: `conventions.md`
- テスト方針: `testing.md`
- Git / GitHub の正解: `../spec/github.md`, `../tech/git-implementation.md`
- Electron / アーキテクチャ判断: `../architecture/overview.md`, `../architecture/decisions.md`
- UI変更を伴う場合: `../ui/screens-macos.md`, `../ui/navigation.md`, `../ui/DESIGN.md`

作業の進め方:

1. `phases/P12-refactoring-security-plan.md` の順序に従い、1回の変更範囲を小さく切る
2. 変更前に対象ファイル・影響範囲・確認方法を短く説明する
3. 機能維持を最優先し、既存UI・既存IPC API・既存データ形式を不用意に変えない
4. GitHub / Electron / IPC / ファイル操作は、セキュリティ境界を弱めない
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
5. 変更後、`phases/P09-feature-checklist.md` と関連する spec ファイルを更新する

注意:

- 1セッションで全項目を解決しようとしない。決定→修正→確認のサイクルを短くする
- 「コード正」の場合は文書だけを変更する。「実装」の場合はコード変更も伴う
- 実装を伴う変更は、変更前に影響範囲をユーザーに説明してから着手する

---

## 更新ルール

- フェーズ状態はこのファイルにだけ書く
- 機能確認の進捗は `phases/P09-feature-checklist.md` にだけ書く
- 実装済み作業の細目をこのファイルへ増やさない。必要なら該当仕様・ADR・ジャーナルへリンクする
- 新しい作業が始まったら、既存フェーズに入るか、新しいフェーズを追加するかを先に判断する
