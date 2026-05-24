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
| 4. 現在フェーズ正本 | 例: `phases/P9.md` | そのフェーズで確認・実行する項目 | 他フェーズの詳細、過去の経緯 |
| 5. 詳細参照 | `../spec/`, `../ui/`, `../tech/`, `../architecture/` | 現在作業に必要な正解だけ | 無関係な仕様・履歴 |
| 6. 履歴 | `../journal/` | 経緯確認が必要なときの過去ログ | 現在の正本としての判断 |

---

## 現在フェーズ

```yaml
current: P29
summary: P29
checklist: phases/P29.md
```

---

## フェーズ一覧

| ID | フェーズ | status | 正本・参照 |
|----|----------|--------|------------|
| P0 | P0 | done | `phases/P0.md`, `../product/principles.md`, `../product/PLAN.md` |
| P1 | P1 | done | `phases/P1.md`, `../spec/` |
| P2 | P2 | done | `phases/P2.md`, `../tech/`, `../architecture/decisions.md` |
| P3 | P3 | done | `phases/P3.md`, `conventions.md`, `testing.md`, `open-questions.md` |
| P4 | P4 | done | `phases/P4.md`, `../tech/stack.md`, `../architecture/overview.md`, `../spec/file-management.md`, `../spec/navigation.md`, `../spec/editor.md`, `../spec/markdown.md`, `../spec/links-and-tags.md`, `../spec/search.md` |
| P5 | P5 | done | `phases/P5.md`, `../spec/frontmatter.md`, `../spec/command-palette.md` |
| P6 | P6 | done | `phases/P6.md` |
| P7 | P7 | done | `phases/P7.md`, `../spec/file-tools.md` |
| P8 | P8 | done | `phases/P8.md`, `../ui/screens-macos.md`, `../ui/navigation.md`, `../ui/DESIGN.md` |
| P9 | P9 | done | `phases/P9.md` |
| P10 | P10 | done | `phases/P10.md`, `testing.md`, `../tech/stack.md` |
| P11 | P11 | done | `phases/P11.md` |
| P12 | P12 | done | `phases/P12.md`, `conventions.md`, `testing.md` |
| P13 | P13 | done | `phases/P13.md`, `../product/PLAN.md`, `../architecture/decisions.md` |
| P14 | P14 | done | `phases/P14.md`, `../architecture/decisions.md` |
| P15 | P15 | rejected | `phases/P15.md` |
| P16 | P16 | done | `phases/P16.md`, `../ui/screens-macos.md`, `../ui/navigation.md`, `../ui/DESIGN.md` |
| P17 | P17 | done | `phases/P17.md`, 必要に応じて `../spec/`, `../product/PLAN.md`, `../product/principles.md` |
| P18 | P18 | done | `phases/P18.md`, `../ui/screens-macos.md`, `../ui/navigation.md`, `../ui/DESIGN.md` |
| P19 | P19 | done | `phases/P19.md`, `conventions.md`, `testing.md`, 必要に応じて `../architecture/overview.md` |
| P20 | P20 | done | `phases/P20.md`, `conventions.md`, `testing.md`, 必要に応じて `../spec/`, `../architecture/overview.md`, `../ui/` |
| P21 | P21 | done | `phases/P21.md`, 必要に応じて `../INDEX.md`, `../spec/`, `../ui/`, `../architecture/`, `../tech/`, `../../README.md` |
| P22 | P22 | done | `phases/P22.md`, `conventions.md`, `testing.md`, 必要に応じて `../spec/navigation.md`, `../ui/screens-macos.md`, `../ui/navigation.md`, `../ui/DESIGN.md`, `../architecture/overview.md` |
| P23 | P23 | done | `phases/P23.md`, `conventions.md`, `testing.md`, 必要に応じて `../architecture/overview.md`, `../architecture/decisions.md`, `../spec/`, `../ui/` |
| P24 | P24 | done | `phases/P24.md`, `conventions.md`, `testing.md`, 必要に応じて `../spec/`, `../ui/`, `../architecture/overview.md` |
| P25 | P25 | done | `phases/P25.md`, `conventions.md`, `testing.md`, 必要に応じて `../spec/`, `../ui/`, `../architecture/overview.md` |
| P26 | P26 | done | `phases/P26.md`, `conventions.md`, `testing.md`, `../ui/DESIGN.md`, `../ui/screens-macos.md`, `../ui/navigation.md`, 必要に応じて `../spec/`, `../architecture/overview.md` |
| P27 | P27 | done | `phases/P27.md`, `conventions.md`, `testing.md`, 必要に応じて `../spec/`, `../ui/`, `../architecture/overview.md` |
| P28 | P28 | done | `phases/P28.md`, `conventions.md`, `testing.md`, 必要に応じて `../spec/`, `../ui/`, `../architecture/overview.md` |
| P29 | P29 | current | `phases/P29.md`, 必要に応じて `../spec/`, `../product/PLAN.md`, `../product/principles.md`, `../ui/`, `../architecture/overview.md`, `conventions.md`, `testing.md` |

### 取り下げた非正当フェーズ

P15はAIが先に方針を作りすぎたため、正当な開発フェーズとしては扱わない。
成果物は戻さないが、この方針自体は現在フェーズの根拠にしない。

- `phases/P15.md`

---

## 更新ルール

- フェーズ状態はこのファイルにだけ書く
- このファイルにはフェーズ別の詳細本文を置かない。詳細は必ず `phases/P*.md` の正本へ書く
- 機能確認の進捗は `phases/P9.md` にだけ書く
- 実装済み作業の細目をこのファイルへ増やさない。必要なら該当仕様・ADR・ジャーナルへリンクする
- 新しい作業が始まったら、既存フェーズに入るか、新しいフェーズを追加するかを先に判断する
