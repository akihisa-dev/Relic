# development/release-rules.md

RelicのGitHub Releasesを使ったリリース手順。
GitHub ActionsでDraft Release作成までを自動化し、公開判断だけを人が行う運用を定義する。

---

## 目的

- GitHub ReleasesをRelicの配布場所として使う
- リリースごとに、どのバージョンの成果物かをGitタグとGitHub Releasesで明確にする
- `v*` タグがGitHubへpushされたときだけ、自動ビルドとDraft Release作成を行う
- アプリ本体の自動更新機能はまだ追加しない
- 署名、公証、App Store、外部サービスログイン、Publishまでの完全自動化は別作業として扱う

ユーザーにとっての「更新」は、GitHub Releasesから新しい配布ファイルを取得し、古いRelicと置き換える運用とする。

---

## 正本

- アプリのバージョン正本は `app/package.json` の `version`
- Gitタグは `vMAJOR.MINOR.PATCH` 形式
- バージョンの上げ方は `docs/development/versioning-rules.md`
- Draft Release作成の自動化は `.github/workflows/draft-release.yml`
- リリース本文はGitHub Releasesの説明欄
- 配布ファイルはGitHub ReleasesのAssets
- GitHub Releasesの操作はGitHub公式ドキュメントの [Managing releases in a repository](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository) を参照する

---

## リリース前に確認すること

1. `app/package.json` の `version` が、配布したい番号になっていることを確認する
2. `docs/development/versioning-rules.md` に従い、必要なバージョン更新がコミット済みであることを確認する
3. 作業中の差分がないことを確認する
4. リリースしたいコミットがGitHubの `main` にpush済みであることを確認する
5. `app/` で `pnpm verify` を実行して成功することを確認する
6. リポジトリルートで `git diff --check` を実行して成功することを確認する

---

## Gitタグ

バージョン更新コミット後に、`app/package.json` の `version` と同じ番号でタグを作る。
タグをGitHubへpushすると、`Draft Release` workflowが実行される。
タグ名と `app/package.json` の `version` が一致しない場合、workflowはビルド前に失敗する。

例:

```sh
version="$(node -p "require('./app/package.json').version")"
git tag "v${version}"
git push origin "v${version}"
```

`main` のpushがまだの場合は、タグpushより先に次を実行する。

```sh
git push origin main
```

pushはユーザーが明示的に指示した場合だけ実行する。

---

## Draft Release作成

`.github/workflows/draft-release.yml` は、`v*` タグがpushされたときだけ実行される。
通常のブランチpushやPull Requestでは実行しない。

workflowは次を自動で行う。

1. `github.ref_name` と `app/package.json` の `version` から作るタグ名が一致するか確認する
2. macOS runnerで `app/` の依存関係をインストールする
3. macOS runnerで `pnpm build:mac:safe` を実行する
4. `app/out/darwin/` で生成された `Relic.app` を `Relic-macOS-arm64.zip` にまとめる
5. Windows runnerで `app/` の依存関係をインストールする
6. Windows runnerで `pnpm build:win:safe` を実行する
7. `app/out/win32/` で生成されたWindows向けアプリを `Relic-Windows.zip` にまとめる
8. `GITHUB_TOKEN` でGitHub Draft Releaseを確認し、存在しない場合だけ作成する
9. `Relic-macOS-arm64.zip` と `Relic-Windows.zip` をAssetsに添付する

workflow全体の権限は `contents: read` に抑え、Release作成を行う `draft-release` ジョブだけ `contents: write` を持つ。
Releaseが存在しない場合は `gh release create "$TAG_NAME" --draft --generate-notes` で作成する。
Assetsアップロードは `--clobber` を付け、途中失敗後の再実行でも同名Assetsを更新できるようにする。

Draft Release作成後、GitHub上でRelease本文とAssetsを確認し、問題がなければPublishする。

Publishは自動化しない。間違った成果物や説明文をそのまま公開しないため、最後の公開判断は人が行う。

---

## ローカル確認

GitHub Actions実行前に手元で事前確認する場合は `app/` で次を実行する。

```sh
pnpm verify
pnpm build:mac:safe
```

Windows向けの最終確認は、Windows環境で起動確認できた成果物だけを対象にする。

---

## Assets

GitHub ReleasesのAssetsには、workflowが作成した配布ファイルを添付する。

- macOS Apple Silicon: `Relic-macOS-arm64.zip`
- Windows: `Relic-Windows.zip`

Intel Mac向け配布は今回は別作業とする。

未確認の成果物、途中生成物、`app/out/` の中身を説明なくまとめたファイルは添付しない。
OS別出力先のうち、GitHub Releasesに添付するのはworkflowが `release-assets` に集めた配布用ファイルだけとする。

---

## やらないこと

この運用では、次のことはまだ行わない。

- アプリ起動時の自動更新確認
- アプリ内の更新通知
- `electron-updater` などの自動更新ライブラリ導入
- Publishまでの完全自動化
- コード署名、公証、App Store配布、インストーラー方式の変更
- 個人ログイン情報、パスワード、外部サービス認証情報の利用

これらが必要になった場合は、配布方式、署名、Windows/macOSの確認方法を別作業として決めてから進める。
