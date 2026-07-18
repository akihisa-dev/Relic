---
name: relic-manage-version
description: Relicのコミット種別とオーナーの世代更新指示から次のMAJOR・MINOR・PATCHを決定し、app/package.json、コミット件名、Git履歴の整合を検証する。バージョン計算、バージョン更新、コミット準備、コミット検証、バージョン規則の変更に使う。実際のステージとコミットはrelic-commit、タグと配布はrelic-releaseを優先する。
---

# Relic Version Management

## 次版を決める

1. `docs/development.md` の現行規則、`app/package.json` のversion、コミットする変更の主目的を確認する。
2. オーナーが製品世代の更新を明示した場合だけMAJORを選び、`Version-Impact: major` をコミット本文へ記録する。
3. MAJORでなければ、主目的がユーザーから見える機能追加の `feat` ならMINORを選ぶ。
4. それ以外のtypeは、文書、テスト、内部整理を含めてPATCHを選ぶ。コミットする更新をversion据え置きにしない。
5. 複数の目的を一つのコミットへ含める場合は、`feat` を優先する。独立した目的は `$relic-commit` で分割し、各コミットで順次計算する。
6. `app/` で `pnpm version:next -- <現在値> <type>` を実行する。MAJORの明示指示がある場合だけ末尾へ `--major` を付け、出力値を採用する。

## 互換性を保護する

1. データ、設定、操作環境の互換性は、製品世代の自動判定に使わず、関連する機能Skillの移行・拒否・警告・テスト規則で保護する。
2. Conventional Commits上の破壊的変更を示す `!` または `BREAKING CHANGE:` が必要な差分では、MAJORの明示指示がなければコミットを止める。互換性を維持する実装へ直すか、オーナーへ世代更新の判断を求める。
3. MAJORの明示指示なしに `Version-Impact: major` を追加しない。

## 更新して検証する

1. 計算結果で `app/package.json` のversionを変更本体と同じコミット内で更新し、バージョンだけのコミットを作らない。
2. version更新の直後に `app/` で `pnpm sbom:generate` と `pnpm licenses:check` を実行し、`sbom/relic-dependencies.cdx.json` のapplication versionを必ず同期する。依存関係の変更では `pnpm licenses:generate` を使い、noticesも同期する。
3. ステージ後に `pnpm version:check-staged` を実行し、`app/package.json` とSBOMのversionがステージ内で一致しなければコミットしない。
4. 件名を `<type>[!]: <version> <説明>` とし、versionを `app/package.json` と一致させる。
5. コミット前に対象検証と `git diff --check` を完了する。
6. コミット後またはPull Requestでは、基準コミットと対象コミットを指定して `pnpm version:check -- <base> <head>` を実行する。この検査は件名、version増分、各コミットのSBOM同期を一緒に確認する。
7. 検査が不一致を報告した場合は数字を手計算で上書きせず、type、MAJOR指示、コミット分割、変更対象を確認して原因を直す。

## `$relic-commit` へ渡す

選択したtype、更新前後のversion、MAJOR指示の有無、実行した検証を保持し、ステージとコミットは `$relic-commit` に従う。pushやタグ作成へ権限を広げない。
