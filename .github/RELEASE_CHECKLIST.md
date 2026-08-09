# Release Checklist

RelicのローカルGitタグ作成、タグのGitHubへのpush、Draft ReleaseのPublishを、それぞれ独立して確認する項目です。タグ作成の依頼はpushや公開の許可を含みません。

## タグ作成前

- [ ] `app/package.json` の `version` が配布する `MAJOR.MINOR.PATCH` になっている
- [ ] 必要なバージョン更新がコミット済みである
- [ ] 作業中の差分が残っていない
- [ ] リリース対象コミットがローカル `main` とGitHubの `main` の両方から到達できる
- [ ] `app/` で `pnpm outdated` を実行し、依存状態を確認した
- [ ] `app/` で `pnpm verify:local:release` が成功し、既知のproduction脆弱性がなく、macOS安全ビルドと配布版起動スモークが完了した
- [ ] リポジトリルートで `git diff --check` が成功した
- [ ] 作成するGitタグが `app/package.json` の `version` と一致している
- [ ] 同名タグがローカルにもGitHubにも存在しない

## タグをGitHubへpushする前

- [ ] タグpushが明示的に依頼されている
- [ ] push対象タグが、確認済みのリリース対象コミットを指している
- [ ] push前に `.githooks/secret-guard.sh --range <outgoing-range>` が成功している
- [ ] `.githooks/pre-push` または同等の明示手順で `pnpm verify:local:release` を再実行し、失敗または未実施の検証がない
- [ ] GitHubの `main` がリリース対象コミットへ到達できることを再確認した
- [ ] 同名のremote tagが存在しない

GitタグをGitHubへpushすると、`.github/workflows/draft-release.yml` がmacOSの配布版起動スモークに成功した成果物だけをDraft Releaseへ添付する。

## 成果物

- [ ] Release tagが `app/package.json` の `version` と一致している
- [ ] `Relic-macOS-arm64.dmg` が添付され、Applicationsフォルダへコピーして導入できる
- [ ] `Relic-macOS-arm64.dmg.sha256` が添付されている
- [ ] packageディレクトリが`Relic-darwin-arm64`で、Universal Binaryまたはx64成果物が混在していない
- [ ] `THIRD_PARTY_NOTICES.md` が添付されている
- [ ] `relic-dependencies.cdx.json` が添付されている
- [ ] workflowが `release-assets` に集めた確認済みファイルだけが添付され、途中生成物や未確認の成果物が混ざっていない

## 公開前確認

- [ ] Draft Release workflowが成功している
- [ ] Release本文に主要変更と既知の注意点が書かれている
- [ ] macOS配布物がApple Silicon向けであることが分かる
- [ ] 未署名・未公証ビルドであることが分かる
- [ ] checksumで配布DMGの整合を確認できることが分かる

## ローカル公開前検証

タグを作成またはGitHubへpushする前に、Apple Silicon搭載Macの `app/` で `pnpm verify:local:release` を実行する。検証項目と公開境界の詳細は、[開発手順の公開前検証](../docs/development.md#検証とテスト)を正本とする。

GitHub Actionsの結果は公開後の別環境確認と成果物生成として扱い、ローカル公開前検証の代わりにしない。ローカル検証が失敗または未実施ならタグをpushしない。

## 未署名・未公証の注意

現時点の配布物は、macOSのコード署名・公証を行わない。

macOSでは、初回起動時に未確認の開発元として警告される可能性がある。
この制約が許容できない配布段階に進む場合は、署名・公証・インストーラー方式を別作業として決める。
