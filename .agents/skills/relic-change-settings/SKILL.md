---
name: relic-change-settings
description: Relicのアプリ設定・ワークスペース別設定について、schema、既定値、入力検証、互換移行、安全書き込み、設定ファイル単位の更新queue、IPC、設定パネルの保存挙動を変更する。テーマ、表示言語の選択・保存・system解決、エディタ設定、機能トグル、登録ワークスペース情報、ピン留め、チャート・フロントマター候補、同時更新・保存失敗などの永続化追加・修正に使う。翻訳内容・用語はrelic-change-localization、見た目だけはrelic-change-ui、実ファイル操作はrelic-change-workspace-files、グラフ・クロニクル固有設定は対応するrelic-change-graph・relic-change-chronicle、IPC境界はrelic-change-electron-boundariesを併用する。調査・レビューだけでは編集しない。
---

# Relic Settings Change

## 依頼と保存範囲を確定する

1. 調査、説明、レビューだけの依頼では編集しない。変更が明示されている場合だけ実装する。
2. `git status --short` を確認し、新しい値、既存値変更、移行、保存障害、設定UIのどれを扱うか限定する。
3. ワークスペース登録操作は `$relic-change-workspace-files` に委ね、登録情報のschema・保存だけを本スキルで扱う。
4. `docs/features/navigation.md` の設定節、`docs/engineering/data-model.md`、`docs/engineering/architecture.md` を読む。
5. `docs/INDEX.md` から設定対象機能の正本を選び、エディタ、フロントマター、可視化、ワークスペースなど対応する実装スキルを併用する。
6. アプリ設定、ワークスペース別設定、rendererのブラウザー保存領域を区別し、明示仕様なしに値を別の保存先へ移さない。

## データ境界を守る

1. アプリ設定はElectronの `userData` 配下、ワークスペース別設定は安全なworkspace IDの個別JSONへ保存する。
2. 設定JSON、索引、画面状態をユーザーのMarkdownや実ワークスペースへ埋め込まない。
3. workspace IDを既存の安全な形式へ限定し、危険なIDでは設定ファイルのパスを作らない。
4. ワークスペース相対パス値は正規化し、絶対パス、`..`、NUL、重複を復元しない。
5. 秘密情報、認証情報、内部URL、環境固有値を設定schema、ログ、エラー、fixtureへ追加しない。
6. 設定エラーをRendererへ返す場合は、不要なローカル絶対パスと認証情報らしい文字列を伏せる。

## schemaと互換性を変更する

1. 追加する値の所有型、既定値、読込parse、保存serialize、IPC validatorを一組で更新する。
2. 不正な既存値は項目ごとの初期値へ戻すか無効項目だけ除外し、他の正常な設定を捨てない。
3. 保存IPCの不正入力は丸めて保存せず、検証失敗として処理前に返す。
4. schema変更では形式versionを更新し、旧形式から現形式への変換を互換アダプタへ隔離する。
5. 現行parse・serializeへ旧キー分岐を広げず、保存時は現行キーだけを書き込む。
6. version未指定は旧version 0として移行し、不正なversionと現行より新しいversionは明示的に拒否して上書きしない。
7. 移行書戻しに失敗しても、安全に正規化できた読込結果まで失わない既存方針を保つ。
8. 削除する設定値は既存利用者の読込経路、既定値、UI、文書、移行期間を確認してから除去する。

## 保存処理を安全に保つ

1. JSONは一時ファイルからの原子的置換で保存し、保存先を正規化したpath単位で、同じ設定ファイルへの全更新入口を一つのqueueへ直列化する。別pathの設定ファイルは同じglobal queueへ入れず、並行して更新できるようにする。
2. 対応OSでは設定ディレクトリと設定ファイルの既存private権限を保つ。
3. 壊れたJSONは既存規則で退避し、設定objectでない値は安全な初期状態として扱う。
4. 読込不能や移行不能がアプリ全体を不意に停止させないよう、呼出側の失敗処理まで確認する。
5. 設定パネルは現行の保存導線を保ち、保存方式を変える場合は正本文書と失敗表示を同時に更新する。
6. UIへ先に反映する場合は、保存失敗をユーザーへ明示し、成功したと誤認させない。
7. エディタ設定変更でも、本文、選択、履歴、スクロール、フォーカスを可能な限り維持する。
8. 機能トグル変更では入口、右パネル、既存タブ、ショートカットの状態遷移を仕様と照合する。
9. queue内の更新は、現在処理中の同じpathへ公開更新API経由で戻って自己待機しない。queue外の入口と、queue内で使う非queue版のread・merge・write処理を分ける。
10. 先行更新の失敗はその呼出側へ返すが、queue末尾は回復させ、後続更新を実行できる状態にする。失敗した一部書込を成功扱いせず、別pathの更新を巻き込まない。

## IPCとUIを整合させる

1. 機能別shared型、契約定義、preload、main handler、renderer clientを同時に更新する。
2. IPC契約やvalidatorを変更する場合は `$relic-change-electron-boundaries` の入力上限と契約テストも適用する。
3. editor設定と一般設定の既存IPC所有範囲を保ち、巨大な共通設定APIへ統合しない。
4. 選択肢、数値範囲、真偽値をmain境界で検証し、rendererだけの検証へ依存しない。
5. 設定項目を追加した場合は初期値と機能トグルによる入口表示を確認し、表示文言、英語fallback、日英辞書は `$relic-change-localization` と整合させる。
6. 見た目や操作感も変える場合は `$relic-change-ui` の状態別確認を追加する。

## 検証する

1. 初期値、部分的な不正値、非object、壊れたJSON、重複、危険なID、未正規化パスを対象テストで確認する。
2. 旧schema移行、現行保存形式、将来version、移行書戻し失敗、壊れたファイル退避を確認する。
3. 同時更新では同じpathの全入口が順番どおりにmergeされること、内部非queue版が自己待機しないこと、別pathが並行できること、先行更新の失敗後も後続更新が継続することを確認する。安全書き込み、private権限、保存失敗時の副作用も一時userDataで確認する。
4. IPC validator、契約、preload、設定hook、設定パネル、機能トグルの関連テストを確認する。
5. schema parser、移行・保存の仕様分岐、ファイル操作、IPC入力検証を追加・変更した場合は対象テストまたは回帰テストを追加し、`app/` で `pnpm verify` を実行する。その他の変更でも対象のnode・rendererテストと `pnpm typecheck` を実行し、必要なら `pnpm architecture:check` または `pnpm verify` を実行する。
6. ユーザーが実画面確認を明示的に指示した場合だけ、その作業で起動した開発版と専用の `RELIC_DEV_USER_DATA_DIR` を使う。
7. 正本文書、既定値、保存JSON、差分、検証結果を照合し、コミット時は `$relic-commit` に従う。
