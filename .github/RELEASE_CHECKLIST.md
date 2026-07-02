# Release Checklist

RelicのDraft ReleaseをPublishする前に、人が確認する項目です。

## 成果物

- [ ] Release tagが `app/package.json` の `version` と一致している
- [ ] `Relic-macOS-arm64.zip` が添付されている
- [ ] `Relic-macOS-arm64.zip.sha256` が添付されている
- [ ] `Relic-Windows.zip` が添付されている
- [ ] `Relic-Windows.zip.sha256` が添付されている
- [ ] `THIRD_PARTY_NOTICES.md` が添付されている
- [ ] `relic-dependencies.cdx.json` が添付されている

## 公開前確認

- [ ] Draft Release workflowが成功している
- [ ] Release本文に主要変更と既知の注意点が書かれている
- [ ] macOS配布物がApple Silicon向けであることが分かる
- [ ] Windows配布物がZIP配布であることが分かる
- [ ] 未署名・未公証ビルドであることが分かる
- [ ] checksumで配布ZIPの整合を確認できることが分かる

## 未署名・未公証の注意

現時点の配布物は、macOSのコード署名・公証、Windowsのコード署名を行わない。

macOSでは、初回起動時に未確認の開発元として警告される可能性がある。
Windowsでは、初回起動時に保護警告が表示される可能性がある。

この制約が許容できない配布段階に進む場合は、署名・公証・インストーラー方式を別作業として決める。
