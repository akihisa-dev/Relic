---
name: relic-change-table-view
description: Relicのテーブルビューについて、共有索引からの型付きフロントマター行、検索・filter・sort、表示列、列幅・折り返し・並べ替え、固定header・列、仮想表示、プロパティ説明とcategory候補、設定保存を追加・修正する。テーブル固有の表示、列操作、drag、検索、性能、保存失敗に使う。YAML解析・ファイル内編集はrelic-change-frontmatter、共有索引はrelic-change-links-index、設定schema・更新queueはrelic-change-settings、タブ遷移はrelic-change-navigation、見た目だけはrelic-change-uiを優先または併用する。
---

# Relic Table View Change

## 対象と正本を確定する

1. 調査、説明、レビューだけの依頼では編集せず、追加、変更、修正が明示された場合だけ実装する。
2. `git status --short` を確認し、main側の行生成、取得cache、query model、表示列、仮想表示、列操作、設定保存、プロパティ説明のどこを変えるか限定する。
3. `docs/features/frontmatter.md`、`docs/features/navigation.md`、`docs/engineering/data-model.md`、`docs/design/DESIGN.md` のテーブル節を読む。IPCへ触れる場合は `docs/engineering/architecture.md` も読む。
4. Markdownとfrontmatterを正本、table行とavailable propertyを派生データ、表示列・幅・折り返し・sort・filterをワークスペース設定、検索・scroll・popoverを一時状態として扱う。

## 行と値の意味を保つ

1. 共有索引の全Markdownファイルを1行ずつ扱い、YAML不正を理由に行を除外せずwarningと空のproperty列で表す。
2. 文字列、数値、真偽値、日付、`null`、空文字、空配列、配列、objectを区別する型付き値を保持し、表示用文字列だけをsort・filterの正本にしない。
3. 同名fileは相対pathで安定して区別し、sortが同値の場合もfile名とpathで決定的な順序にする。
4. ファイル名とproperty値は表示専用とし、セル編集、行選択、書出しを追加しない。file名の操作だけ既存の同一pane表示へ接続する。
5. main側のfrontmatter parseと共有cacheを利用し、table専用の全ファイル再走査を作らない。索引構造の変更は `$relic-change-links-index` に委ねる。

## 列操作と仮想表示を一体で扱う

1. file名列を左端固定にし、property列だけを表示選択、並べ替え、幅変更、折り返し、非表示の対象にする。
2. drag中はsource列の幅を保った挿入空間と補助線を表示し、drop時だけ順序を確定・保存する。`dragend`、Escape、範囲外drop、unmountでは順序を変えず一時offsetを消す。
3. 列のvisual offsetと確定後の配列順を分離し、headerと全表示cellへ同じoffsetを適用する。source・target・before / afterを純粋modelで検証する。
4. headerとfile名列を固定し、横scrollはtable本体に閉じる。列幅合計、scroll座標、resize handle、keyboard操作の基準を一致させる。
5. 仮想表示は通常行と折り返し行の固定高を別に持ち、検索・filter・折り返し変更時に表示範囲とscroll位置を安全に更新する。可変DOM高を推測して行操作を配置しない。
6. 大量行でも表示範囲付近だけを描画し、検索・sort・filterは元の取得結果を破壊せず派生計算にする。

## 設定保存と失敗を扱う

1. 表示列、列幅、折り返し、sort、filterを既存上限で検証し、現在存在しないpropertyを除外する。schemaと互換読込は `$relic-change-settings` に委ねる。
2. UIの楽観更新と保存完了をrevisionで対応付け、古い成功・失敗を新しい操作へ反映しない。
3. 保存失敗時は操作ごとのrollback可否を明示し、失敗した設定と再試行対象を保持する。cache無効化は成功後だけ行う。
4. workspace切替後に以前の取得・保存結果を適用せず、loading、空、error、retryを別状態として表示する。
5. 固定propertyの説明と `category` 候補管理は列popoverに閉じ、個別MarkdownのYAML編集へ広げない。

## 検証して完了する

1. query modelで型付き値、同名file、search、sort、filter、空・不正YAMLを確認する。
2. 列modelでbefore / after、左右移動、同一位置、幅上限、折り返し、非表示を確認し、componentでheader・cell offset、drop確定、中断、fixed列、横scrollを確認する。
3. 仮想表示で通常・折り返し行、viewport境界、overscan、検索後のscroll reset、大量行を確認する。
4. 保存で連続操作、古い応答、失敗、rollback、retry、workspace切替を確認する。
5. `app/` で対象のtable・rendererテスト、`pnpm typecheck`、IPCやschema変更時は `pnpm architecture:check`、影響が広い場合は `pnpm verify` を実行する。
6. 見た目やdragを変え、ユーザーが実画面確認を明示した場合だけ `$relic-test-development-app` に従う。仕様を正本文書へ同期し、`git diff --check` と全差分を確認する。変更した行・列・保存契約、対象テスト、未確認事項を報告し、コミット時は `$relic-commit` に従う。
