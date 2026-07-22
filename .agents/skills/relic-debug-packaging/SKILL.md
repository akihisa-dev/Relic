---
name: relic-debug-packaging
description: RelicのElectron Forge・ViteによるmacOS向けpackage・make、ASAR内容、追加resources、アイコン、配布成果物の構成変更と障害を扱い、現行のsafe buildで再検証する。配布設定・成果物構成・アイコン・resourcesの変更、配布ビルド失敗、起動ファイル欠落、ASAR検査、不要ファイル混入、ローカルでのCI build原因分析に使う。調査だけでは読み取り専用とし、GitHub上のcheck調査はgithub:gh-fix-ci、タグ・push・Draft・Publishはrelic-release、依存更新はrelic-update-dependenciesを優先する。
---

# Relic Packaging Debug

## 診断範囲を決める

1. 調査、原因説明、ログ解析だけの依頼では編集しない。修正が明示されている場合だけ変更する。
2. `git status --short` を確認し、既存差分と生成済み成果物を今回の結果として混同しない。
3. macOSの実行環境、使用コマンド、最初に失敗した段階、期待する成果物を特定する。
4. `app/package.json`、`app/forge.config.ts`、対象Vite設定、`app/build-tools/`、`app/scripts/` を確認する。
5. CI失敗では現行workflowの対象jobを正本とする。
6. 調査だけの依頼ではログ、設定、既存成果物への読み取り専用checkまでに限定し、出力を削除・作り直すbuildは実行しない。

## 失敗段階を切り分ける

1. 依存導入、Vite build、Forge package、maker、ASAR監査、legal resources、ZIP生成を分ける。
2. ログ末尾だけで決めず、最初の失敗と、その直前に作成されたファイルを確認する。
3. package処理だけなら現行のmacOS package script、makerまでならmacOS make scriptで狭く再現する。
4. 既存成果物の内容確認だけならmacOS safe checkを使い、古い成果物の成功を現行buildの成功としない。
5. 修正依頼またはビルド実行が明示された場合の最終再現では、macOSの現行safe buildを使う。
6. safe buildが対象の出力を作り直す範囲を確認し、別用途の成果物を巻き込まない。
7. macOS以外の成果物を作成、推測、検証対象に含めない。
8. package版は `RELIC_DEV_USER_DATA_DIR` の切替対象外なので、明示なしに起動して実ユーザーデータへ接続しない。

## 成果物を確認する

1. macOSの実行ファイルとresources内の `app.asar` を確認する。
2. ASARにpackage manifest、main、preload、rendererのentryとassets、必要なiconがあることを確認する。
3. source map、ソース、テスト、設定、不要な依存など、許可外entryがASARへ混入していないことを確認する。
4. `LICENSE`、`THIRD_PARTY_NOTICES.md`、SBOMがASAR外のresourcesに含まれることを確認する。
5. 現行方針外のinstaller・更新用成果物を残さない。
6. macOS workflowのpackage・make・ZIP化を現行定義どおり保つ。
7. 現行成果物を未署名・未公証として扱い、署名、公証、自動更新を診断修正へ混ぜない。

## 修正して再検証する

1. 失敗を隠すためだけにpackage ignore、必須entry、safe checkを緩めない。
2. package内容を変える場合はpackage contentsの定義とそのテストを同じ作業で更新する。
3. build補助scriptを変える場合は、引数、macOS対象、出力先、終了code、signal失敗の回帰テストを更新する。
4. アイコン変更では生成元とmacOS用icon、必要なpackage entryを整合させる。
5. `app/` で対象scriptテスト、`pnpm typecheck`、必要に応じて `pnpm verify` を実行する。
6. macOSのsafe buildを再実行し、成功表示だけでなくASAR reportと成果物構成を確認する。
7. 配布内容や運用を変えた場合は `docs/development.md`、README、workflow、release checklistを同期する。
8. タグ前のmacOS確認は手動の `Pre-release Verification` workflowで既存safe buildを再利用する。タグ、Release、pushを行わず、remote runnerの結果はローカルで実行済みと表現しない。
9. `git diff --check` と全差分を確認し、`out/`、一時ログ、ローカル絶対パスをコミット対象へ含めない。

## 完了する

原因、失敗段階、修正内容、確認したOSと成果物、ASAR・legal resourcesの結果、未確認OS、未実施の公開操作を報告する。
