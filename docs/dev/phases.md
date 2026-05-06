# dev/phases.md

Relicの開発フェーズを管理する正本。
AIはセッション開始時にこのファイルだけを読み、現在フェーズと必要文書を判断する。

---

## 読み方

- `status: current` が現在の作業フェーズ
- `status: done` は完了済み。通常は詳細文書を読まない
- `status: future` は未着手。現在フェーズに関係するときだけ読む
- チェックリスト本文はこのファイルに複製しない。進捗は `checklist` に書かれた正本を参照する
- 現在フェーズが変わったら、このファイルの `status` と `current` を更新する

---

## コンテキスト階層

各文書は、自分の階層で必要なことだけを扱う。
上位文書に下位文書の詳細を混ぜない。

| 階層 | 文書 | ここで認識すること | ここでは認識しないこと |
|------|------|--------------------|------------------------|
| 1. AI行動規約 | `../../AI.md` | AIの行動制約、確認ルール、編集ルール | Relic固有の仕様・現在地・実装詳細 |
| 2. プロジェクト概要 | `../../README.md` | Relicが何のアプリか、対象ユーザー、リポジトリ構成 | 詳細仕様、現在フェーズ、作業チェックリスト |
| 3. 開発フェーズ | `phases.md` | 今どのフェーズか、読むべき正本文書 | チェック項目本文、仕様本文、実装細目 |
| 4. 現在フェーズ正本 | 例: `feature-checklist.md` | そのフェーズで確認・実行する項目 | 他フェーズの詳細、過去の経緯 |
| 5. 詳細参照 | `../spec/`, `../ui/`, `../tech/`, `../architecture/` | 現在作業に必要な正解だけ | 無関係な仕様・履歴 |
| 6. 履歴 | `../journal/` | 経緯確認が必要なときの過去ログ | 現在の正本としての判断 |

---

## 現在フェーズ

```yaml
current: P9-runtime-verification
summary: 実機稼働検証と不具合修正
checklist: feature-checklist.md
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
| P9 | 実機稼働検証・不具合修正 | current | `feature-checklist.md` |
| P10 | 自分用ビルド安定化 | future | `testing.md`, `../tech/stack.md` |
| P11 | 配布判断・リリース準備 | future | `../PLAN.md`, `../architecture/decisions.md` |

---

## フェーズ別の読み込みルール

### P9-runtime-verification

今の通常作業。

最初に読む:

- `feature-checklist.md`

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

## 更新ルール

- フェーズ状態はこのファイルにだけ書く
- 機能確認の進捗は `feature-checklist.md` にだけ書く
- 実装済み作業の細目をこのファイルへ増やさない。必要なら該当仕様・ADR・ジャーナルへリンクする
- 新しい作業が始まったら、既存フェーズに入るか、新しいフェーズを追加するかを先に判断する
