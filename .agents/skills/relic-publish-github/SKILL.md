---
name: relic-publish-github
description: Relicの検証・コミット済み変更を、明示された範囲だけGitHubへpushし、必要に応じてDraft Pull Requestを作成または更新する。push、リモートブランチ反映、Draft PR作成、PR本文更新、公開前の秘密情報検査に使う。コミット作成はrelic-commit、タグ・Draft Release・Release公開はrelic-release、GitHub Actionsの設計変更はrelic-change-ci、Issue対応はrelic-issueを優先し、明示されていないブランチ作成・push・PR・公開は行わない。
---

# Relic GitHub Publication

## 公開権限と対象を固定する

1. `git status --short`、現在ブランチ、upstream、remote URL、未push commitを確認し、今回公開するcommitと既存差分を分ける。
2. push、ブランチ作成、Pull Request作成・更新のうち、ユーザーが明示した操作だけを行う。PR依頼をmainへの直接push許可に読み替えない。
3. main上でPR作成を依頼されても、明示なしに作業ブランチを作らない。ブランチ名または作成許可がなければ、確認済み状態と必要な選択肢を報告して停止する。
4. `git add -A`、`git add .`、自動生成した任意件名、履歴書換え、force pushを使わない。未コミット変更の処理が必要なら `$relic-commit` に委ねる。
5. タグ、配布物、Draft Release、Release公開は `$relic-release` に委ねる。

## remoteと送信差分を確認する

1. remoteの現在値はGitHub連携または `git ls-remote` で確認し、古いremote-tracking refだけで公開状態を断定しない。
2. 対象remote branch、local HEAD、remote SHA、共通祖先を確認し、意図しないcommit、merge、巻き戻しが送信範囲へ入らないことを `git log` と差分で確認する。
3. non-fast-forward、remote側の新しいcommit、branch保護、認証失敗がある場合は、rebase、merge、force pushを自動選択せず停止する。
4. 新規remote branchでは、意図した基準branchとの共通祖先からHEADまでを公開対象として確認する。
5. `.githooks/secret-guard.sh --range <outgoing-range>` を明示実行する。`core.hooksPath` の設定有無だけに秘密情報検査を依存させず、検査失敗時はpushしない。

## pushとPull Requestを実行する

1. remote名、local branch、remote branchを明示した通常のpushを使う。upstream設定も依頼された公開に必要な場合だけ行う。
2. push後はGitHub側のbranch SHAがlocal HEADと一致することを一次情報で確認する。
3. Pull Request作成が明示されている場合は、同じhead・baseの既存Open PRを先に確認し、重複作成しない。
4. ready状態が明示されていなければDraft PRとし、目的、変更内容、確認結果、影響、未確認事項を本文へ記載する。
5. PR本文、ラベル、reviewer、担当者、milestone、merge、ready化は、依頼された項目だけ変更する。
6. GitHub上のcheck失敗を調査する場合は `github:gh-fix-ci` で一次情報を取得し、修正領域に応じたRelic Skillへ渡す。

## 完了状態を確認する

1. remote branch、公開済みcommit SHA、PR番号・URL・Draft状態、実行した秘密情報検査を確認する。
2. 関連するIssueがある場合は、remote到達の確認結果を `$relic-issue` へ渡す。remote到達は公開状態の情報として扱い、Issue完了やcloseの条件へ追加しない。
3. pushしていないcommit、未反映のremote変更、未実施checkを明確に分ける。
4. 公開先、公開したcommit、PR状態、検査結果、未実施の外部操作を報告する。
