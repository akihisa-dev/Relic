---
name: relic-change-ci
description: RelicのGitHub Actions workflow、trigger、permissions、concurrency、runner、Action入力、credential保持、秘密情報検査、Git hook、CODEOWNERSを安全に追加・修正する。CI設計、workflow YAML、PR検証、Secret Guard、repository保護経路の変更に使う。Actionのversion更新だけはrelic-update-dependencies、GitHub上の失敗調査はgithub:gh-fix-ci、タグ起点の配布処理はrelic-release、package成果物の内容はrelic-debug-packagingを優先する。
---

# Relic CI Change

## 依頼と実行境界を限定する

1. 調査、説明、check結果の確認だけでは編集しない。workflow、hook、検査、所有規則の変更が明示されている場合だけ実装する。
2. `git status --short`、`.github/workflows/`、`.githooks/`、`.github/CODEOWNERS`、`SECURITY.md`、`CONTRIBUTING.md`、`app/package.json` を確認する。
3. trigger、権限、同時実行、runner、Action、実行script、secret guard、所有者のどこを変えるかを分ける。
4. GitHub上だけの失敗は `github:gh-fix-ci` でjob・step・logを確認してから、原因を所有するSkillへ渡す。
5. Action参照のversionだけを変える場合は `$relic-update-dependencies`、配布成果物の構成は `$relic-debug-packaging`、タグとRelease操作は `$relic-release` に委ねる。

## workflowの権限と起動条件を守る

1. `permissions` を明示し、workflow全体は読取権限を基本とする。書込権限は必要なjobへ限定し、理由と対象resourceを確認する。
2. `pull_request_target`、fork由来コードとwrite tokenの同居、未信頼入力のshell展開を、明示的な安全設計なしに導入しない。
3. checkoutでは履歴深度の必要性を決め、認証情報が後続stepに不要なら `persist-credentials: false` を保つ。
4. `concurrency` のgroupをworkflow・PR・ref単位で衝突しない値にし、検証workflowとrelease workflowでcancel方針を分ける。
5. runnerとshellのOS差を確認し、bash専用構文をPowerShell stepへ、POSIX専用コマンドをWindows既定shellへ持ち込まない。
6. GitHub式とshell変数を混同せず、外部入力は `env` 経由で渡し、command injectionにつながる直接展開を避ける。

## Actionと検査scriptを変更する

1. Action変更では公式の `action.yml`、release notes、対応runner、必須input、権限を一次情報で確認する。major tagだけから互換性を推測しない。
2. workflowから呼ぶpackage scriptと実在パスを現行HEADへ照合し、ローカルで再現できるCode CI検査は `pnpm verify:ci` へ集約する。Pull Requestのbase/headなどイベント固有入力を使う検査は別stepとして差分を明示する。
3. Secret Guardはstaged内容、送信commit range、CIのPR rangeで同じ検知規則を使い、hook設定がなくてもSkillから明示実行できる状態を保つ。
4. guard自身のfixtureに実在credentialを入れず、分割した架空値で正常系と拒否系を検証する。
5. workflow、hook、権限判断、外部操作Skillを変更した場合は `.github/CODEOWNERS` の保護対象を同期する。
6. 自動更新PR、外部送信、新しいsecret、repository設定変更を、workflowファイル変更の許可へ含めない。

## 検証する

1. `app/` で `pnpm ci:workflows:check` を実行し、全workflowのYAML、trigger、permissions、concurrency、Action参照、checkout credential設定を確認する。
2. Node.jsは `app/package.json` の `engines.node`、pnpmは `packageManager` を正本とし、workflowのsetup、Corepack、frozen lockfileとの整合も同じ検査で確認する。
3. Secret Guard変更では `.githooks/secret-guard.sh --self-test` とstaged・rangeの対象ケースを確認する。
4. workflowが呼ぶ対象scriptのテスト、`pnpm typecheck`、必要な `pnpm verify` または `pnpm verify:ci` を実行する。
5. Actionのremote実行、OS別runner、repository権限などローカルで証明できない項目は未確認として分ける。
6. `git diff --check` とworkflow差分を確認し、秘密情報、内部URL、ローカル絶対パス、不要なwrite権限がないことを確かめる。

## 完了する

変更したtrigger・権限・Action・script・guard、ローカル検証、remoteでのみ確認できる事項、更新した所有規則を報告する。外部checkの再実行、push、repository設定変更は明示指示がある場合だけ行う。
