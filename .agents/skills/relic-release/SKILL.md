---
name: relic-release
description: Relicのリリース準備、バージョン確認、配布ビルド、local・remote Gitタグ、Draft Release、Publishを現行WorkflowとChecklistに従って安全に進める。ユーザーがリリース確認、配布成果物、タグ作成、タグまたはmainのpush、Draft Release、公開を明示的に依頼した場合に使う。tag、push、Draft作成、Publishは依頼された操作だけを行い、通常ブランチやPull Requestの公開はrelic-publish-githubを優先する。
---

# Relic Release

## 手順

1. 依頼された範囲を、準備確認、ローカルビルド、タグ作成、main push、タグpush、Draft確認、Publishに分ける。ある操作の依頼を、後続操作の許可に広げない。
2. 実行時に `docs/development.md` のバージョン・リリース節、`app/package.json`、`.github/workflows/draft-release.yml`、`.github/RELEASE_CHECKLIST.md` を読み、現在の正本に従う。記憶した手順や古い成果物名を使わない。
3. `app/package.json` のversionが `MAJOR.MINOR.PATCH` 形式で配布予定番号と一致し、必要なバージョン更新がコミット済みで、作業ツリーがcleanで、対象コミットがリリース対象として妥当か確認する。実配布で `0.0.0` を使わない。GitHub連携または `git ls-remote` でremote mainを取得し、対象コミットがremote mainから到達可能であることを確認する。
4. 現行リリース前確認に従い、`app/` で依存状態、production dependency監査、`pnpm verify` を確認し、リポジトリルートで `git diff --check` を実行する。外部アクセスやsandbox承認が必要なら、理由を示して正規の承認経路を使う。
5. ローカル配布ビルドを依頼された場合だけ、現在のpackage scriptsからmacOSの安全ビルドコマンドを選ぶ。他OSの成果物を作成、推測、検証対象に含めない。
6. タグ作成を明示された場合だけ、local tagとremote tagを別々に確認し、`app/package.json` のversionと完全一致する未使用のタグを対象コミットへ作成する。既存タグを移動、上書き、削除しない。
7. mainのpushとタグのpushを、それぞれ明示された場合だけ実行する。main pushは `$relic-publish-github` のremote差分確認を使い、いずれのpush前にも `.githooks/secret-guard.sh --range <outgoing-range>` を明示実行する。タグpushがDraft Release Workflowを起動することを実行前に示す。mainが未pushなら、許可なくpushせず阻害条件として報告する。
8. タグpush後の確認を依頼された場合は、Workflowのタグ検証、依存検査、macOSビルド、checksum、Draft Release、Assetsの結果を確認する。公開済みReleaseや既存Assetを上書きしない。再実行に既存Draft Assetの削除が必要なら、人の判断を求める。
9. Publishを明示された場合だけ、`.github/RELEASE_CHECKLIST.md` を項目ごとに確認し、Release本文、全Assets、checksum、未署名・未公証、対応OSの注意を確認して公開する。Publishを自動で推測しない。
10. 自動更新、署名、公証、ストア配布、インストーラー変更、認証情報利用をリリース作業へ追加しない。公開済みAssetsを差し替えず、重大問題は新しいPATCHのHotfixとして扱う。
11. 完了報告で、確認したversion、local・remote mainとtag、実行した検証とsecret guard、作成したタグ、push範囲、Workflow・Draft・Publishの状態、未実施操作と理由を示す。
