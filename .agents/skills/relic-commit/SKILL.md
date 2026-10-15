---
name: relic-commit
description: Relicリポジトリの変更を安全に検証・分割・ステージし、stage-onlyまたは日本語のConventional Commits形式によるコミットを実行する。ユーザーがステージだけ、コミット、コミット整理、作業完了時の既定コミットを求めた場合に使う。番号を更新する依頼の判定と検証はrelic-manage-versionを併用し、pushだけの依頼には使わない。
---

# Relic Commit

## 手順

1. 依頼をstage-onlyとcommitに分ける。stage-onlyでは指定差分の検証とステージだけを行い、version更新、コミット、pushへ広げない。commitでは `AGENTS.md`、`docs/development.md`、`app/package.json` を確認し、通常コミットか更新専用コミットかを `$relic-manage-version` で判定する。通常コミットでは次版を計算しない。
2. 「コミットしないで」はstage-onlyが明示されている場合だけステージ許可として扱う。pushだけの依頼をstageやcommitの許可に読み替えない。
3. `git status --short`、作業ツリー差分、ステージ済み差分を確認し、依頼に必要な差分と無関係な既存差分を分ける。無関係な差分を変更、取消、ステージしない。
4. 変更目的とConventional Commitsのtypeでコミット単位を決める。複数のtypeや独立した目的がある場合は分け、各目的に必要なコード、テスト、文書を同じコミットへ含める。
5. 通常の実装・修正・Issue対応ではversionを据え置く。番号の更新を依頼された場合だけ `$relic-manage-version` に従い、未反映コミットを古い順に評価した更新専用コミットを別に作る。
6. 依存関係を変更した場合は `app/` で `pnpm licenses:generate`、`pnpm sbom:generate`、`pnpm licenses:check` を実行し、必要な生成物を同期する。番号更新時もSBOMのapplication versionを同期する。生成・整合検査が失敗した場合はコミットしない。
7. 変更リスクに対応する検証を完了する。失敗を解消できない場合はコミットせず、失敗内容を報告する。
8. 対象パスまたはhunkを明示してステージする。`git add .` と `git add -A` を使わない。`git diff --cached --check`、`git diff --cached`、`app/` で `pnpm version:check-staged`、`.githooks/pre-commit` を明示実行し、hook設定の有無に依存せず、ステージしたversionとSBOM、対象、機密情報、意図しない差分を再確認する。stage-onlyはこの結果を報告して終了する。
9. 通常コミットの件名を `<type>[!]: <日本語の説明>` とし、件名・本文にバージョン番号、採番区分、将来の更新予定を付け加えない。更新専用コミットだけは `$relic-manage-version` の件名・本文を使う。typeは `feat`、`fix`、`docs`、`style`、`refactor`、`perf`、`test`、`build`、`ci`、`chore`、`revert` から1つだけ選ぶ。件名にscopeを書かない。破壊的変更では `!` または `BREAKING CHANGE:` を使う。
10. 本文を日本語で書き、原則として `scope:`、`目的:`、`内容:`、`確認:`、`影響:` を含める。複数ファイル、削除、仕様・運用変更、バージョン更新を含む場合は省略しない。秘密情報、個人情報、認証情報、内部URL、ローカル絶対パス、環境変数値、機微なエラー値は伏せるか一般化する。
11. コミット後にコミットIDと残存差分を確認する。完了報告で検証、コミットID、未コミットの無関係差分、未pushであることを示す。
12. 通常コミットのpushは明示依頼時だけ行う。バージョン更新の実行依頼に含まれるpushと反映確認は `$relic-manage-version` と `$relic-publish-github` に従い、ローカルのみの指定を優先する。
