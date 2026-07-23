---
name: relic-change-search-replace
description: Relicの全文・ファイル名・タグ・フロントマター検索と、単一・一括置換、正規表現、プレビュー、競合検知、要求順序を追加・修正する。検索精度、検索上限、現行IPC入力の厳格検証、旧入力の拒否、置換安全性、検索結果状態の変更に使う。共有ワークスペース索引は利用して変更pathの再読込を要求するが、索引構造・解析キャッシュ・バックリンク・タグ派生の変更はrelic-change-links-index、クイックスイッチャーはrelic-change-navigation、ファイル書込一般はrelic-change-workspace-filesを優先または併用する。
---

# Relic Search and Replace Change

## 検索・置換の対象を確定する

1. 調査、説明、レビューだけの依頼では編集せず、追加、変更、修正が明示された場合だけ実装する。
2. `git status --short` を確認し、検索種別、入力検証、要求制御、結果表示、単一置換、プレビュー、一括置換のどこを変えるか限定する。
3. `docs/features/search.md`、`docs/engineering/data-model.md`、`docs/engineering/architecture.md` を読む。
4. 書込へ触れる場合は `docs/engineering/file-access-boundaries.md`、固定プロパティの意味を変える場合は `docs/features/frontmatter.md` も読む。
5. 現在のワークスペース内Markdownを正本、検索結果、置換プレビュー、ワークスペース索引を再生成可能な派生データとして扱う。

## 検索契約を守る

1. 通常検索を現在のワークスペース内Markdownだけに限定し、画像、PDF、別ワークスペースを混ぜない。
2. 全文検索はフロントマターを含む本文、ファイル名検索はファイル名と `aliases`、タグ検索はフロントマター `tags` だけを対象にする。
3. 本文中の `#タグ` は通常のタグ検索へ含めず、タグ入力の先頭 `#` だけを正規化して照合する。
4. フロントマター検索のUI候補を認識済み固定プロパティに限定し、未登録field、配列、真偽値、nullの現行照合規則を保つ。
5. 大文字小文字、行番号、空行表示、一致理由、検索種別ごとの結果形式を正本と共有型で一致させる。
6. 空の検索語句または未選択ワークスペースでは処理せず、古い結果、上限通知、skip件数、errorを空に戻す。
7. 結果上限、検索語句上限、2MiB境界を現行定数に合わせ、サイズ確認または読込に失敗したファイルだけをskipして検索を続ける。
8. 新しい検索要求、query変更、mode変更、workspace切替後に、遅い旧要求の結果やerrorを現在画面へ反映しない。

## IPC入力を厳格に検証する

1. Rendererからの現行入力を `query`、`mode`、必要な `frontmatterField` を持つ構造へ統一する。
2. 文字列単体、旧配列、旧query・mode keyを現行構造へ推測変換せず、必須fieldを満たさない入力としてIPC境界で拒否する。
3. 検索語句、検索種別、fieldを現行契約として検証できない場合はmain検索を呼び出さない。
4. preload、shared型、renderer clientを現行構造へ揃え、serviceや索引に旧入力の分岐を再導入しない。
5. IPC型、preload、handler登録を変える場合は `$relic-change-electron-boundaries` を併用する。

## 置換を安全に適用する

1. 空の検索語句、無効または危険な正規表現、上限を超える入力をファイル読込・書込前に拒否する。
2. 通常文字列と正規表現、大小文字、一致件数をプレビューと実適用で同じ関数・規則から導出する。
3. 置換プレビューに対象pathと内容snapshotを保持し、適用時に外部変更を検知したら古い結果を書き込まない。
4. 単一置換と一括置換をワークスペース境界内の安全書込にし、各書込直前にも対象の実体とsnapshotを確認する。
5. プレビュー中の読込失敗は対象だけをskipできるが、実適用中の読込・書込失敗は安全側で失敗させる。
6. 複数ファイル適用の途中失敗では、適用済み内容を現行契約どおり戻し、rollback中も外部変更後のファイルを古い内容で上書きしない。
7. 取消、入力error、snapshot不一致、適用失敗では、対象外ファイル、検索索引、現在タブへ部分的な副作用を残さない。

## 共有索引と協調する

1. 検索はmain側の共有ワークスペース索引とMarkdown解析結果を利用し、独自の第二索引を作らない。
2. 保存成功後は変更pathだけを再読込し、外部renameや変更path不明時だけワークスペース単位の再生成を要求する。
3. 索引や解析cacheをMarkdownより新しい正本として扱わず、破損時に実ファイルから再構築できる状態を保つ。
4. 索引record、cache lifecycle、増分無効化、aliases・tags解析を変える場合は `$relic-change-links-index` を併用し、本Skillでは検索・置換側のconsumer契約を確認する。
5. クイックスイッチャーの候補検索とタブ遷移は `$relic-change-navigation`、一般のファイル保存queueやrename・moveは `$relic-change-workspace-files` に委ねる。

## 検証する

1. 全文、ファイル名、タグ、フロントマターについて大小文字、フロントマター、aliases、タグ正規化、配列、真偽値、nullを確認する。
2. 空query、未選択workspace、結果上限、語句上限、2MiBちょうどと超過、stat・read失敗、古い要求の破棄を確認する。
3. 現行IPC入力、不正型、旧key、必須field欠落、handler未実行を確認する。
4. 置換で空文字、通常文字列、無効・危険な正規表現、snapshot不一致、部分的読込失敗、書込失敗、rollback競合、副作用なしを確認する。
5. 共有索引の増分再読込、全体再生成、workspace切替、連続検索、保存後の再検索を確認する。
6. `app/` で対象のnode・rendererテスト、`pnpm typecheck`、必要なら `pnpm architecture:check` または `pnpm verify` を実行する。
7. 索引や検索性能を変えた場合は `pnpm performance:workspace` を同条件で比較し、必要な場合だけlarge fixtureを使う。
8. ユーザーから見える振る舞いを変えた場合は検索正本を同期し、`git diff --check` と全差分を確認する。

## 完了する

変更した検索種別、入力検証、置換安全条件、索引consumer契約、更新した正本、テスト、性能確認、未確認項目を報告する。コミット時は `$relic-commit` に従う。
