---
name: relic-change-visualizations
description: Relicのグラフビューと年表について、Markdown由来の派生データ、Canvas 2D、Web Worker、pan・zoom・drag・hit判定・性能を一貫して実装または修正する。グラフのノード・リンク・力学・検索・強調、年表のchronicle解析・配置・操作の変更に使う。見た目だけはrelic-change-ui、YAML規則はrelic-change-frontmatter、設定schema・保存はrelic-change-settings、IPC境界だけはrelic-change-electron-boundaries、性能監査だけはrelic-audit-code-healthを優先する。
---

# Relic Visualization Change

## 対象と正本を決める

1. 調査、レビュー、性能診断だけの依頼では編集しない。変更が明示されている場合だけ実装する。
2. `git status --short` を確認し、グラフと年表のどちらを変更するか限定する。
3. `docs/engineering/architecture.md`、`docs/engineering/data-model.md` と対象機能の正本を確認する。
4. グラフでは `docs/features/links.md` とnavigation、design、関連設計判断、年表ではfrontmatterとdesignを読む。

## 正本と派生データを守る

1. グラフのノードとリンクをMarkdown、タグ、添付、未解決リンクから生成する派生データとして扱う。
2. コードブロック内の記法、外部URL、ワークスペース外参照をグラフへ追加しない。
3. 同じ始点・終点・種別のリンクを現行規則どおり集約し、ファイルとタグの意味を混同しない。
4. グラフ座標、物理配置、一時ドラッグをMarkdownやワークスペース設定へ書き戻さない。
5. グラフ表示設定だけをrendererのブラウザー保存領域へ保持する。
6. 年表を `chronicle` frontmatterから生成し、不正値を勝手に修正せず表示対象から除外する。
7. 年表のpan、zoom、配置、一時ドラッグを永続化しない。暦設定について正本と実装が食い違う場合は、一方を推測で削除せず変更目的に照らして整合を回復する。

## 描画パイプラインを実装する

1. Markdown解析とワークスペース派生データ生成をmainまたはsharedの純粋処理へ置く。
2. Canvas座標変換、配置、hit判定、filter、検索、描画命令をReactコンポーネントからmodelへ分ける。
3. CanvasのCSS寸法とdevice pixel ratioを分け、resize後も座標系とポインター位置を一致させる。
4. panとzoomでは画面座標、world座標、zoom中心、慣性、選択閾値を同じ変換規則で扱う。
5. グラフ物理演算では既存のWeb Worker境界を保ち、座標転送と停止処理を明示する。
6. React stateを毎frame更新せず、描画用refとrequestAnimationFrameを使い、破棄時にworkerとframeを止める。
7. staleなworker応答、連続検索、ワークスペース切替後の古い結果を現在画面へ反映しない。
8. `SharedArrayBuffer` はcross-origin isolationの設計確認なしに導入しない。

## 検証する

1. グラフ派生データはworkspace graph、描画model、interaction、search、simulationの対象テストで確認する。
2. 年表はchronicle parse、時間変換、配置、renderer、Canvas操作の対象テストで確認する。
3. pan、zoom、drag、hover、右クリック、keyboard、resize、低倍率、空データを影響に応じて確認する。
4. 乱数や物理演算はseedまたは純粋入力を固定し、壊れやすい画像比較だけへ依存しない。
5. `app/` で `pnpm typecheck` と対象のNode・rendererテストを実行する。
6. IPCやプロセス責務へ触れた場合は `pnpm architecture:check`、影響が広い場合は `pnpm verify` を実行する。
7. 大規模データへの影響は `pnpm performance:workspace` またはlarge版を同条件で比較する。
8. 遅延chunkや描画依存へ影響する場合は `pnpm build:size:check` を実行する。
9. 見た目や操作を変えた場合は `$relic-change-ui` の状態別・テーマ別・開発版確認も行う。
10. 仕様をlinks、frontmatter、navigation、design、architecture、data-modelの該当正本へ同期する。
11. `git diff --check` と全差分を確認し、一時fixture、性能出力を残さない。

## 完了する

変更した派生データ、描画・操作、永続化しない状態、性能条件、テスト、実画面確認、未確認項目を報告する。
