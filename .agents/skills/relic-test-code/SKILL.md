---
name: relic-test-code
description: RelicのVitest・React Testing Libraryによる自動テストについて、失敗の再現と原因切り分け、回帰テストの追加・修正、Node・jsdom環境の選択、fixture・mock・一時データの安全性、coverage gateまで扱う。ローカルのテスト失敗、flaky test、テスト追加、回帰防止、coverage不足の調査や修正に使う。機能本体の変更は対応するrelic-change系Skill、実画面確認はrelic-test-development-app、GitHub Actions上だけの失敗はgithub:gh-fix-ciを優先する。
---

# Relic Code Test

## 依頼と失敗を限定する

1. 調査、説明、失敗原因の報告だけなら編集しない。テスト追加、修正、失敗解消が明示されている場合だけ変更する。
2. `git status --short` を確認し、無関係な差分とユーザーの変更を保護する。
3. `docs/development.md` の「検証とテスト」、`docs/engineering/test-strategy.md`、`app/vitest.config.ts`、`app/package.json` の現行scriptを確認する。
4. 失敗するコマンド、test file、test name、期待値、実際値を最小の対象実行で再現する。全テストの結果だけから原因を推測しない。
5. 製品コードの不具合、古い期待値、環境選択の誤り、mock漏れ、非同期処理、共有状態、時間依存、coverage不足に分類する。
6. 製品コードを変える必要がある場合は対象機能のSkillを併用し、本Skillでは再現条件と回帰テストを所有する。

## テスト環境と配置を選ぶ

1. main、preload、shared、scripts、build-toolsでNode APIを使うテストはNode projectへ置く。
2. rendererのDOM、React component、hook、ブラウザー状態を扱うテストはjsdom projectへ置く。
3. 単体・統合のどちらも所有する実装の近くへ `*.test.ts` または `*.test.tsx` を置き、Nodeまたはrendererの既存Vitest projectに収集させる。`app/src/test/` は複数testで共有するsetup、fixture、mock、utility専用とし、同ディレクトリへtest本体を置かない。
4. rendererでは既存のsetup、store reset、`window.relic` mockなどのtest utilityを探して再利用し、同じmockを各testへ複製しない。
5. 小さな入力はtest内へ書き、大きな再利用データが本当に必要な場合だけfixtureを追加する。
6. E2E、GUI、package版が必要と決めつけず、自動テストで証明できない受入条件だけを `$relic-test-development-app` へ渡す。

## 回帰テストを設計する

1. バグ修正では、修正前に失敗する最小の再現条件を特定し、同じ不具合を再発させる入力と期待結果を固定する。
2. 実装内部の呼出回数より、ユーザーに見える結果、保存内容、状態遷移、境界での拒否、副作用の有無を優先する。
3. 正常系だけでなく、変更した分岐に対応する不正入力、空状態、境界値、途中失敗を選ぶ。網羅数を増やすこと自体を目的にしない。
4. ファイル操作、IPC入力、parser、検索、リンク更新、保存、外部変更では、成功結果と失敗時に変更が残らないことを確認する。
5. 非同期処理は完了条件を待ち、固定sleepへ依存しない。fake timerを使う場合は対象処理との対応を説明できる範囲に限定する。
6. flakyなtestはtimeoutを伸ばして隠さず、時間、順序、乱数、未終了処理、共有state、cleanup漏れを分離する。
7. coverage不足では未実行の重要分岐を確認し、数値だけを満たす無意味なtestやcoverage除外を追加しない。

## テストデータを安全に扱う

1. 実ユーザーのワークスペース、設定、ホームディレクトリ、既存Relicウインドウをtestに使わない。
2. ファイル操作testはOSの一時ディレクトリを作成して使い、終了時にその一時領域だけを削除する。
3. 破壊的操作では対象が作成した一時領域内にあることを操作直前にも確認する。
4. token、秘密鍵、個人情報、実在URL、実在ローカルパスをfixtureへ入れず、明らかな架空値と一般化したパスを使う。
5. OSのゴミ箱、clipboard、dialog、shell、外部サービスは薄い境界でmockし、通常testから実環境へ接続しない。
6. test後にmock、timer、DOM、store、listener、temporary resourceを戻し、実行順で結果が変わらないようにする。

## 段階的に検証する

1. `app/` で対象testだけを実行する。Nodeは `pnpm exec vitest run --project node <path>`、rendererは `pnpm exec vitest run --project renderer <path>` を基本形とする。
2. 対象testが通ったら、同じ機能領域の関連testと `pnpm typecheck` を実行する。
3. 仕様分岐、ファイル操作、IPC、parser、検索、リンク、保存へ影響する場合は `pnpm verify` を実行する。
4. coverageまたは広い変更が依頼範囲なら `pnpm test:coverage`、構造境界へ触れた場合は `pnpm architecture:check` を追加する。
5. テスト群の役割監査や配置変更では `pnpm test:inventory` を実行し、Electron実行・OS別packageをVitest件数へ混ぜず、不足する失敗責務を示す。
6. 失敗を解消するためにassertion、coverage threshold、安全条件を弱めない。仕様とtestが不一致なら正本と現行実装を確認して正しい側を直す。
7. `git diff --check` と全差分を確認し、一時データ、coverage生成物、debug log、機密情報が残っていないことを確かめる。

## 完了する

再現した失敗、原因分類、変更したtestと製品コード、実行環境、対象実行から広い検証までの結果、未実施項目と理由を報告する。コミットする場合は `$relic-commit` に従う。
