---
name: relic-commit
description: Relicリポジトリの変更を安全に検証・分割・ステージし、stage-onlyまたは日本語のConventional Commits形式によるコミットを実行する。ユーザーがステージだけ、コミット、コミット整理、作業完了時の既定コミットを求めた場合に使う。コミット時の次版決定はrelic-manage-versionを必ず併用し、pushだけの依頼には使わない。
---

# Relic Commit

## 手順

1. 依頼をstage-onlyとcommitに分ける。stage-onlyでは指定差分の検証とステージだけを行い、version更新、コミット、pushへ広げない。commitでは `AGENTS.md`、`docs/development.md`、`app/package.json` を確認し、次版の決定と検証に `$relic-manage-version` を使う。
2. 「コミットしないで」はstage-onlyが明示されている場合だけステージ許可として扱う。pushだけの依頼をstageやcommitの許可に読み替えない。
3. `git status --short`、作業ツリー差分、ステージ済み差分を確認し、依頼に必要な差分と無関係な既存差分を分ける。無関係な差分を変更、取消、ステージしない。
4. 変更目的とConventional Commitsのtypeでコミット単位を決める。複数のtypeや独立した目的がある場合は分け、各目的に必要なコード、テスト、文書を同じコミットへ含める。
5. commitモードでは各コミットで `app/package.json` のversionを更新する。オーナーが製品世代の更新を明示した場合だけMAJOR、主目的が `feat` ならMINOR、それ以外はPATCHとする。MAJORでは本文へ `Version-Impact: major` を記録する。バージョン更新を単独コミットにせず、複数コミットではコミットごとに順次更新する。stage-onlyではversionを変更しない。
6. version更新の直後に `app/` で `pnpm sbom:generate` と `pnpm licenses:check` を実行し、`app/package.json` と `sbom/relic-dependencies.cdx.json` を同じコミットへ含める。依存関係を変更した場合は `pnpm licenses:generate` を使い、noticesも同期する。生成や整合検査が失敗した場合はコミットしない。
7. 変更リスクに対応する検証を完了する。失敗を解消できない場合はコミットせず、失敗内容を報告する。
8. 対象パスまたはhunkを明示してステージする。`git add .` と `git add -A` を使わない。`git diff --cached --check`、`git diff --cached`、`app/` で `pnpm version:check-staged`、`.githooks/pre-commit` を明示実行し、hook設定の有無に依存せず、ステージしたversionとSBOM、対象、機密情報、意図しない差分を再確認する。stage-onlyはこの結果を報告して終了する。
9. 件名を `<type>[!]: <version> <日本語の説明>` とする。typeは `feat`、`fix`、`docs`、`style`、`refactor`、`perf`、`test`、`build`、`ci`、`chore`、`revert` から1つだけ選ぶ。件名にscopeを書かない。破壊的変更では `!` または `BREAKING CHANGE:` を使う。
10. 本文を日本語で書き、原則として `scope:`、`目的:`、`内容:`、`確認:`、`影響:` を含める。複数ファイル、削除、仕様・運用変更、バージョン更新を含む場合は省略しない。秘密情報、個人情報、認証情報、内部URL、ローカル絶対パス、環境変数値、機微なエラー値は伏せるか一般化する。
11. コミット後にコミットIDと残存差分を確認する。完了報告で検証、コミットID、未コミットの無関係差分、未pushであることを示す。
12. pushはユーザーが明示した場合だけ実行する。
