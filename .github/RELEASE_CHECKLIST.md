# Release Checklist

RelicのローカルGitタグ作成、タグのGitHubへのpush、Draft ReleaseのPublishを、それぞれ独立して確認する項目です。タグ作成の依頼はpushや公開の許可を含みません。

## タグ作成前

- [ ] `app/package.json` の `version` が配布する `MAJOR.MINOR.PATCH` になっている
- [ ] 必要なバージョン更新がコミット済みである
- [ ] 作業中の差分が残っていない
- [ ] リリース対象コミットがローカル `main` とGitHubの `main` の両方から到達できる
- [ ] `app/` で `pnpm outdated` と `pnpm audit --prod` を実行し、依存状態を確認した
- [ ] `app/` で `pnpm verify:ci` が成功した
- [ ] リポジトリルートで `git diff --check` が成功した
- [ ] 作成するGitタグが `app/package.json` の `version` と一致している
- [ ] 同名タグがローカルにもGitHubにも存在しない

## タグをGitHubへpushする前

- [ ] タグpushが明示的に依頼されている
- [ ] push対象タグが、確認済みのリリース対象コミットを指している
- [ ] push前に `.githooks/secret-guard.sh --range <outgoing-range>` が成功している
- [ ] GitHubの `main` がリリース対象コミットへ到達できることを再確認した
- [ ] 同名のremote tagが存在しない

GitタグをGitHubへpushすると、`.github/workflows/draft-release.yml` が配布物を作成してDraft Releaseへ添付する。

## 成果物

- [ ] Release tagが `app/package.json` の `version` と一致している
- [ ] `Relic-macOS-arm64.zip` が添付されている
- [ ] `Relic-macOS-arm64.zip.sha256` が添付されている
- [ ] `Relic-Windows.zip` が添付されている
- [ ] `Relic-Windows.zip.sha256` が添付されている
- [ ] `THIRD_PARTY_NOTICES.md` が添付されている
- [ ] `relic-dependencies.cdx.json` が添付されている
- [ ] workflowが `release-assets` に集めた確認済みファイルだけが添付され、途中生成物や未確認の成果物が混ざっていない

## 公開前確認

- [ ] Draft Release workflowが成功している
- [ ] Release本文に主要変更と既知の注意点が書かれている
- [ ] macOS配布物がApple Silicon向けであることが分かる
- [ ] Windows配布物がZIP配布であることが分かる
- [ ] 未署名・未公証ビルドであることが分かる
- [ ] checksumで配布ZIPの整合を確認できることが分かる

## ローカルで事前確認する場合

タグを作成する前にGitHub Actionsの `Pre-release Verification` を手動実行すると、macOSとWindowsのrunnerでRelease workflowと同じ安全ビルドを確認できる。このworkflowはタグ、Release、push、リポジトリ内容を変更せず、成果物も公開しない。失敗した場合はタグを作成せず、該当OSの `build:mac:safe` または `build:win:safe` の最初の失敗を修正して再実行する。

ローカルでmacOS向け成果物まで確認する場合は、`app/` で `pnpm verify:ci` と `pnpm build:mac:safe` を実行する。Windows向けの最終確認は、Windows環境の `pnpm build:win:safe` と起動確認を対象にする。

## 未署名・未公証の注意

現時点の配布物は、macOSのコード署名・公証、Windowsのコード署名を行わない。

macOSでは、初回起動時に未確認の開発元として警告される可能性がある。
Windowsでは、初回起動時に保護警告が表示される可能性がある。

この制約が許容できない配布段階に進む場合は、署名・公証・インストーラー方式を別作業として決める。
