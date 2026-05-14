# P21-document-organization.md

Relicの文書整理フェーズの正本。

このフェーズでは、Relicで作ってきた文書構成・開発運用・リポジトリ構成を、今後の開発でも雛形として使える普遍的な構造へ整理する。
対象はアプリ本体の仕様書だけではなく、AI運用、フェーズ管理、開発規約、テスト方針、日誌、索引、ルール文書、READMEなど、アプリ本体以外の周辺文書も含む。

---

## フェーズの目的

- 文書同士の重複、古い前提、参照切れ、粒度のばらつきを減らす
- 現行アプリの仕様、開発フェーズ、設計判断、AI運用、検証方針の所在を分かりやすくする
- Relic固有の内容と、今後のプロジェクトにも流用できる普遍的な構造を分ける
- 次の開発で、読むべき文書と編集してよい文書を判断しやすくする
- 実装変更ではなく、文書の構造・内容・参照関係の整理を優先する

---

## 作業方針

- 最初に、整理対象の文書範囲と目的を確認してから進める
- 仕様変更、UI方針変更、技術選定変更を文書整理に混ぜない
- 古い記述を見つけた場合は、現行仕様との関係を確認してから修正する
- アプリ本体の `app/` だけでなく、ルート直下の運用ファイル、`docs/`、ビルド補助、AI向け入口文書も整理対象に含める
- Relic固有の判断は残しつつ、構造・命名・役割分担は他プロジェクトでも再利用しやすい形へ寄せる
- 文書を削除・統合する場合は、対象、理由、移動先、戻し方を説明してから進める
- `AI.md`、`AGENTS.md`、`CLAUDE.md` の役割分担は崩さない
- `docs/dev/phases.md` と `docs/journal/` は、ユーザー指示またはフェーズ区切り時だけ更新する
- コード変更が必要になった場合は、このフェーズの作業として進めず、理由を説明してユーザー確認を取る

---

## 開始時チェック

文書整理の対象ごとに、作業前に以下を確認する。

- [ ] 整理する文書範囲
- [ ] 整理したい問題
- [ ] 残す正本
- [ ] 移動・統合・削除する候補
- [ ] 参照リンクへの影響
- [ ] Relic固有の内容と汎用構造の分離
- [ ] 仕様変更を含まないこと
- [ ] 確認方法

---

## 作業候補

このフェーズでは、ユーザーが指定した範囲から順に整理する。
AIが先に全件整理リストを正本化しない。

候補として扱える範囲:

- `docs/INDEX.md` の索引と実ファイルの整合
- `docs/spec/` の現行アプリ仕様との整合
- `docs/ui/` の現行画面との整合
- `docs/architecture/` と `docs/tech/` の役割分担
- `docs/dev/phases/` の完了済みフェーズ文書の読みやすさ
- `README.md` と内部文書の役割分担
- ルート直下の入口文書（`AI.md`, `AGENTS.md`, `CLAUDE.md`, `README.md`）の役割分担
- アプリ本体以外の補助ファイル、ビルドスクリプト、運用文書の配置と命名
- 今後の開発プロジェクトへ流用できる標準構造の整理

---

## 実施記録

このフェーズでは、実施した文書整理だけを追記する。
未着手の候補一覧や日付順の作業ログはここに書かない。

### フェーズ管理文書の整理

- P21の目的を、Relic固有文書の整理ではなく、今後の開発の雛形として使える普遍的な文書・運用構造の整理へ拡張した
- アプリ本体以外のルート文書、AI運用文書、開発規約、テスト方針、日誌、補助ファイルもP21の整理対象に含めた
- `docs/dev/phases.md` の初期フェーズを、過去から連続する形で `P0` から `P4` へ振り直した
- `P0` から `P8` と `P10` のフェーズ正本文書を追加し、`P0` から `P21` まで各フェーズに対応文書がある状態にした
- `P0` から `P9` までのフェーズ文書名は、フェーズIDと同じくゼロ埋めしない形に統一した
- `docs/dev/phases.md` のフェーズ一覧で、各フェーズの正本文書を参照する形に揃えた
- `docs/dev/testing.md` のフェーズ別テスト基準も、同じ `P0` から `P7` の並びに合わせた
- 実体のない `P-hold` をフェーズ一覧と読み込みルールから削除した
- `AI.md` のフェーズ完了時ルールから `P-hold` 前提を外し、次フェーズはユーザーが明示した場合だけ `current` にする形へ整理した

### ルートとdocs構成の整理

- ルート直下の起動・ビルド補助スクリプトを `scripts/` へ移動した
- `scripts/` へ移動した補助スクリプトの作業ディレクトリを、`scripts/../app` 基準へ修正した
- プロジェクト概要、設計思想、計画、用語集を `docs/product/` へ移動した
- AIの読み込み導線を `AI.md` → `docs/product/project.md` → `docs/dev/phases.md` → 現在フェーズ正本に更新した
- 今後の開発プロジェクトへ流用する文書・リポジトリ構造テンプレートとして `docs/dev/template.md` を追加した
- `docs/INDEX.md`, `docs/_rules.md`, `README.md` の参照と説明を新しい構成に合わせた

### プロダクト文書の整理

- 方向性: `docs/product/` は、現行Relicのプロダクト前提だけを書く場所として整理する。プロダクト文書ではローカルMarkdownワークスペース、現行UI用語、現在の利用フローを正とする
- 実施: `docs/product/principles.md` を、「書く、整理する、探す、読み返す」を中心に書き直した
- 実施: `docs/product/glossary.md` の用語説明を、現行UIと現在のワークスペース概念に合わせて修正した
- 実施: `docs/product/PLAN.md` を、現行のフロントマターテンプレートとローカルフォルダ前提に合わせた
- 確認: `docs/product/` 内の相対リンク先として `docs/dev/phases.md` と `docs/tech/stack.md` が存在することを確認した
- 残り: 今回範囲の `docs/product/` 整理は完了。`docs/spec/` や `docs/ui/` の詳細整合は、P21の別作業範囲として扱う

### 仕様/UI文書の整合

- 方向性: `docs/spec/` と `docs/ui/` は、現行Relicの「左レール + ファイルサイドバー + タブ式メインエリア」を正として整理する。コード変更、仕様変更、新規機能追加は含めない
- 実施: `docs/spec/editor.md` を、ライブプレビュー / ソースモード / タイプライターモードの現行構成に合わせた。ソースモードではフロントマターをフォーム化せずYAMLとして表示することを明記した
- 実施: `docs/ui/screens-macos.md`, `docs/ui/navigation.md`, `docs/spec/navigation.md` を、ファイルはファイルサイドバー、ダッシュボード・グラフ・ファイル加工・フロントマター設定・設定はパネルタブ、年表 / 日付チャートはチャートタブとして開く構造へ整理した
- 実施: `docs/spec/frontmatter.md` を、ファイル単位のフロントマター編集はファイルタブ内、入力能力や固定プロパティの管理はフロントマター設定パネルタブで行う構造へ整理した。右パネルはアウトラインとリンク一覧に限定した
- 実施: `docs/spec/search.md` と `docs/spec/command-palette.md` の検索・設定導線を、ファイルサイドバー検索と設定パネルタブの現行導線に合わせた
- 確認: `docs/spec docs/ui` 内の古い画面構成表現を確認し、`ダッシュボード`, `グラフ`, `チャート`, `フロントマター`, `ソースモード` の現行導線用語が残っていることも確認した
- 確認: `docs/spec docs/ui` 内のMarkdownリンクを確認し、対象リンク先として `docs/spec/search.md`, `docs/spec/frontmatter.md`, `docs/spec/links-and-tags.md`, `docs/spec/markdown.md` が存在することを確認した
- 残り: 今回範囲の仕様/UI文書整合は完了。現行アプリの実操作確認や、仕様として残す将来機能の棚卸しはP21の別作業範囲として扱う

### 仕様文書の過去フェーズ表現整理

- 方向性: `docs/spec/markdown.md`, `docs/spec/command-palette.md`, `docs/spec/file-tools.md` は、現行仕様として読める表現へ整理する。コード変更、仕様変更、新規機能追加は含めない
- 実施: `docs/spec/markdown.md` の外部URL画像説明から初期仕様前提を外し、現行の表示対象外仕様として整理した
- 実施: `docs/spec/command-palette.md` と `docs/spec/file-tools.md` から初期リリース前提の表現を外し、現行の対象カテゴリ・対象機能として整理した
- 実施: `AI.md` の指示解釈ルールに、解釈は長い段落ではなく箇条書きで提示することを追記した
- 確認: `rg` で対象仕様文書に `初期仕様`, `初期リリース`, `初期対象` が残っていないことを確認した
- 残り: 今回範囲の仕様文書表現整理とAI運用ルール追記は完了。`docs/dev/phases.md` と `docs/journal/` はフェーズ区切り指示がないため更新しない

### 設計/技術文書の整合

- 方向性: `docs/architecture/` と `docs/tech/` は、現行Relicの「ローカルMarkdownワークスペース」「左レール + ファイルサイドバー + タブ式メインエリア」を正として整理する。コード変更、仕様変更、新規機能追加は含めない
- 実施: `docs/architecture/decisions.md` の `009` を、常にエディタを表示する前提から、ファイルタブを編集体験の中心にしつつ補助機能をパネルタブ / チャートタブとして扱う判断へ更新した
- 実施: `docs/architecture/overview.md` を、メインプロセスはファイル操作・検索/リンク/タグ/年表/グラフ生成・設定保存・IPC境界、レンダラーは左レール・ファイルサイドバー・ファイルタブ・パネルタブ・チャートタブ・右パネル・CodeMirrorエディタを担う構成へ整理した
- 実施: `docs/architecture/data-model.md` のアプリ設定とワークスペース設定を、現行の `editorSettings`, `featureToggles`, `userDefinedFields`, `frontmatterTemplates`, `lastWorkspaceId`, `workspaces`, `workspacePath`, `pinnedPaths`, `ganttCharts` に合わせた。Relic専用必須フォルダを自動作成しない判断は維持した
- 実施: `docs/tech/stack.md` と `docs/tech/editor-engine.md` に、Markdownプレビューとフロントマター処理で使う `marked`, `DOMPurify`, `highlight.js`, `KaTeX`, `js-yaml` を必要最小限で追記した
- 確認: `rg` で `docs/architecture docs/tech` 内に古い画面構成が採用済み機能として残っていないことを確認した。`タブ式メインエリア`, `ファイルサイドバー`, `パネルタブ`, `frontmatterTemplates`, `ganttCharts` の現行前提が残っていることも確認した
- 確認: `docs/architecture docs/tech` 内のMarkdownリンクを確認し、対象リンク先として `docs/tech/editor-engine.md`, `docs/spec/frontmatter.md` が存在することを確認した
- 残り: 今回範囲の設計/技術文書整合は完了。`docs/dev/conventions.md` と `docs/dev/testing.md` は下記の別作業範囲で整理した

### 技術・設計文書の時期依存表現整理

- 方向性: `docs/architecture/decisions.md` と `docs/tech/stack.md` は、現行の技術選定・設計判断として読める表現へ整理する。コード変更、仕様変更、技術選定変更は含めない
- 実施: `docs/architecture/decisions.md` の Vitest / Zustand 採用理由から、時期依存の `将来的に` と `初期段階` 表現を外した
- 実施: `docs/tech/stack.md` の対象OS説明を、macOS / Windows を現行対象、iOS を現行スタック対象外の別検討対象として整理した
- 確認: `rg` で `docs/architecture/decisions.md` と `docs/tech/stack.md` に `初期段階`, `将来的に` が残っていないことを確認した
- 残り: 今回範囲の技術・設計文書の時期依存表現整理は完了。`docs/dev/phases.md` と `docs/journal/` はフェーズ区切り指示がないため更新しない

### 開発規約・テスト方針の整合

- 方向性: `docs/dev/conventions.md` と `docs/dev/testing.md` は、現行Relicの「Relic専用必須フォルダを自動作成しない」「フロントマターテンプレートはアプリ設定」「文書整理では対象文書と正本の整合を確認する」を正として整理する。コード変更、仕様変更、新規機能追加は含めない
- 実施: `docs/dev/conventions.md` から初期実装段階の表現、`attachments/` / `templates/` 自動作成前提、専用添付フォルダ前提、毎回の日誌更新前提を外し、現行のワークスペース・画像・テンプレート・文書更新規則に合わせた
- 実施: `docs/dev/testing.md` から `attachments/` / `templates/` 自動作成を期待するテスト前提と初期段階向け表現を外し、P8以降の確認・安定化・文書整理で使う確認方針を追記した
- 確認: `rg` で `docs/dev/conventions.md` と `docs/dev/testing.md` を確認し、`attachments`, `初期実装`, `初期段階`, `プロジェクト作成後`, `Git`, `GitHub` が残っていないことを確認した。`templates` は、ワークスペース内テンプレートフォルダへ依存しないという否定文としてのみ残した
- 確認: `docs/spec/file-management.md`, `docs/spec/markdown.md`, `docs/spec/links-and-tags.md`, `docs/architecture/data-model.md` の現行前提と矛盾しないことを確認した
- 残り: 今回範囲の `docs/dev/conventions.md` と `docs/dev/testing.md` 整理は完了。`docs/dev/phases.md` と `docs/journal/` はフェーズ区切り指示がないため更新しない

### 現行機能だけを書く整理

- 方向性: 正本文書は、現行Relicに存在する機能・構成・運用を中心に書く。存在しないものを否定文として説明するための文書や節は置かない。ただし、仕様境界として必要な否定は残す
- 実施: `README.md`, `SECURITY.md`, `AI.md`, `docs/product/`, `docs/spec/`, `docs/tech/`, `docs/architecture/`, `docs/dev/conventions.md`, `docs/dev/testing.md` を、現行機能中心の説明へ整理した
- 実施: 現行仕様の正本として不要になった専用仕様文書と技術判断文書を削除し、参照していたフェーズ正本を現在の名前と内容へ整理した
- 実施: 完了済みフェーズ文書のうち、次回参照に不要な過去の詳細が多いものは、目的・完了状態・現在の参照先が分かる短い正本へ圧縮した
- 確認: 入口文書、プロダクト文書、仕様文書、UI文書、設計文書、技術文書、開発規約、テスト方針、フェーズ管理文書に、削除済み文書への参照が残っていないことを確認した
- 残り: `docs/journal/` と `docs/archive/` は時系列ログ・アーカイブとして扱い、今回の正本文書整理の対象外にした
