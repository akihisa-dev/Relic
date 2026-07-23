---
name: relic-change-links-index
description: Relicの内部リンク・Markdown相対リンク・ファイル埋め込み、別名、バックリンク、アウトゴーイングリンク、未リンク参照、タグ派生データと、検索・カード・テーブル・グラフ・スフィア・クロニクルが共有するワークスペースMarkdown索引・解析キャッシュを追加・修正する。リンク解決、解析、派生一覧、索引構造、増分更新、再構築の変更に使う。各consumer固有の表示はrelic-change-card-view・relic-change-table-view・relic-change-graph・relic-change-sphere・relic-change-chronicle、検索・置換はrelic-change-search-replace、ファイル実操作はrelic-change-workspace-filesを優先または併用する。
---

# Relic Links and Shared Index Change

## 対象と正本を確定する

1. 調査、説明、レビューだけの依頼では編集せず、追加、変更、修正が明示された場合だけ実装する。
2. `git status --short` を確認し、リンクparse、解決、派生一覧、タグ、共有索引、cache無効化のどこを変えるか限定する。
3. `docs/features/links.md`、`docs/engineering/data-model.md`、`docs/engineering/architecture.md` を読む。
4. ファイル書換えへ触れる場合は `docs/engineering/file-access-boundaries.md`、表示やタブ遷移へ触れる場合は `docs/features/navigation.md` も読む。
5. ワークスペース内Markdownを正本とし、索引、解析cache、aliases、tags、バックリンク、未リンク参照を再生成可能な派生データとして扱う。

## 共有ワークスペース索引を守る

1. ワークスペース内Markdownだけをrecord化し、相対path、表示名、size、mtime、読込状態、行単位textと現行の解析結果を一つの共有境界から提供する。
2. 検索、バックリンク、タグ、aliases、グラフ、クロニクルが同じ要求中にrecordとparse結果を共有し、機能ごとの第二索引や全文再parseを作らない。
3. 索引をRelicの設定領域へ保存する再作成可能な控えとして扱い、Markdownより新しい正本やワークスペース専用形式にしない。
4. アプリ内保存では変更pathだけを再読込し、外部rename、path不明、監視復旧時だけワークスペース単位で再生成する。
5. recordのmtime・sizeだけで内容一致を断定せず、外部変更競合を扱う書込経路では内容snapshotを使う。
6. workspace切替、監視世代変更、再構築中の遅い応答を別workspaceまたは新しい世代へ反映しない。
7. 破損・schema不一致・読込失敗時は実ファイルから再構築し、一部fileを読めない場合のskipと全体failureをconsumer契約に合わせる。

## リンク解決契約を守る

1. pathを持たない内部リンクはリンク元と同じfolderを優先し、その後にワークスペース内で一意な同名Markdownだけを解決する。
2. 同名Markdownで解決できない場合は一意な `aliases` を解決し、別名リンクも通常リンクと同じくバックリンクへ集計する。
3. Markdown相対リンクはリンク元folder基準で解決し、必要な `.md` 補完を行う。外部URL、protocol付きURL、page内anchorだけをローカルfileとして開かない。
4. 見出し、block ID、表示text、埋め込みの構文情報をparse、表示、open、rename追跡の間で失わない。
5. 未作成リンクからの作成先をリンク元基準の安全なworkspace相対pathに限定し、既存fileを上書きしない。
6. `![[...]]` のMarkdown埋め込みを現行の一段階・容量制限で表示し、nested埋め込み、workspace外参照、非Markdownを読み込まない。
7. code block内の内部リンク、Markdownリンク、埋め込み記法を通常の解決、書換え、派生集計から除外する。
8. 画像Wiki埋め込みやMarkdown画像リンクの構文判定はshared parserと協調し、対応画像形式と安全な読込は `$relic-change-attachments` に委ねる。

## 派生リンクとタグを生成する

1. アウトゴーイングリンクは開いている本文、バックリンク、aliases、tags、未リンク参照はmain側共有索引から生成する。
2. 通常リンクと埋め込み、未作成、見出し、block ID、同一sourceの複数参照を失わず、現行件数上限と一部表示通知を保つ。
3. バックリンク集計で一部fileを読めない場合は対象だけをskipし、結果全体を破棄しない。
4. 未リンク参照では既存内部リンク、埋め込み、Markdownリンク、code blockを候補外にし、sourceの行番号、行text、内容snapshotを保持する。
5. 未リンク参照のlink化時にsourceが外部変更されていれば古い位置へ書き込まず、再読込を要求する。
6. 同名fileが曖昧な場合は、表示文字列を保つpath付き内部リンクとしてlink化する。
7. 通常のtagsはフロントマター固定プロパティ `tags` だけから集め、階層、日本語、先頭 `#` の正規化を現行規則に合わせる。
8. 本文中の `#タグ` は通常のtag一覧、候補、検索へ混ぜず、グラフ専用派生として `$relic-change-graph` に渡す。

## 書換えとconsumer境界を整合させる

1. rename・moveの実行順、保存flush、実path操作、rollbackは `$relic-change-workspace-files` に委ね、本Skillはリンクparse、対象特定、書換え規則を所有する。
2. 複数fileのリンク書換えでは内容snapshotを確認し、安全書込と外部変更を保護する。途中失敗のrollbackでも新しい外部内容を上書きしない。
3. 全文・file名・tag・frontmatter検索と置換のquery契約は `$relic-change-search-replace` に委ね、索引recordまたは無効化を変えた場合だけ両Skillを併用する。
4. グラフはlink・tag・attachmentの解析結果をconsumerとして利用し、node・edge集約、描画、simulationは `$relic-change-graph` に委ねる。
5. クロニクルはfrontmatter parse結果とfile recordをconsumerとして利用し、chronicle値の解釈と年表生成は `$relic-change-chronicle` に委ねる。
6. IPC型、preload、main handlerを変える場合は `$relic-change-electron-boundaries` を併用する。

## 検証する

1. 同folder優先、一意basename、aliases、一意性の衝突、path付きlink、見出し、block、表示text、未作成を確認する。
2. Markdown相対linkでsource folder、拡張子補完、外部URL、anchor、traversal、バックスラッシュ区切りを確認する。
3. 埋め込みで一段階、容量上限、nested、非Markdown、読込失敗、内部link操作を確認する。
4. バックリンク、outgoing、未リンク参照、tagsについて重複集約、上限、code除外、読込失敗、snapshot競合、曖昧pathを確認する。
5. 共有索引で初期構築、変更pathだけの再読込、全体再構築、破損復旧、workspace世代、consumer間parse共有を確認する。
6. `app/` で対象のnode・rendererテスト、`pnpm typecheck`、必要なら `pnpm architecture:check` または `pnpm verify` を実行する。
7. 索引や解析性能を変えた場合は `pnpm performance:workspace` を同条件で比較し、必要な場合だけlarge fixtureを使う。
8. ユーザーから見える仕様を変えた場合はlinks、data-model、navigation、file-accessの該当正本を同期し、`git diff --check` と全差分を確認する。

## 完了する

変更したリンク契約、派生データ、共有索引、増分更新、consumer境界、更新した正本、テスト、性能確認、未確認項目を報告する。コミット時は `$relic-commit` に従う。
