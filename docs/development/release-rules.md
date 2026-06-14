# development/release-rules.md

RelicのGitHub Releasesを使ったリリース手順。
GitHub ActionsでDraft Release作成までを自動化し、公開判断だけを人が行う運用を定義する。

---

## 目的

- GitHub ReleasesをRelicの配布場所として使う
- リリースごとに、どのバージョンの成果物かをGitタグとGitHub Releasesで明確にする
- GitHub Actionsで検証、ビルド、タグ作成、Draft Release作成、Assets添付を行う
- アプリ本体の自動更新機能はまだ追加しない
- 署名、公証、インストーラー、Publishまでの完全自動化は別作業として扱う

ユーザーにとっての「更新」は、GitHub Releasesから新しい配布ファイルを取得し、古いRelicと置き換える運用とする。

---

## 正本

- アプリのバージョン正本は `app/package.json` の `version`
- Gitタグは `vMAJOR.MINOR.PATCH` 形式
- バージョンの上げ方は `docs/development/versioning-rules.md`
- リリース本文はGitHub Releasesの説明欄
- 配布ファイルはGitHub ReleasesのAssets
- GitHub Releasesの操作はGitHub公式ドキュメントの [Managing releases in a repository](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository) を参照する
- Draft Release作成の自動化は `.github/workflows/draft-release.yml`

---

## リリース前に確認すること

1. `app/package.json` の `version` が、配布したい番号になっていることを確認する
2. `docs/development/versioning-rules.md` に従い、必要なバージョン更新がコミット済みであることを確認する
3. 作業中の差分がないことを確認する
4. リリースしたいコミットがGitHubにpush済みであることを確認する

`Draft Release` workflowは、`app/package.json` の `version` から `vMAJOR.MINOR.PATCH` タグを作る。
同じタグがすでにGitHub上にある場合、workflowは失敗する。

---

## Draft Release作成

GitHubのActions画面で `Draft Release` workflowを手動実行する。
このworkflowはタグとReleaseを作成するため、GitHubリポジトリ側でActionsのWorkflow permissionsがRead and writeになっている必要がある。

workflowは次を自動で行う。

1. `app/package.json` からバージョンを読む
2. 既存タグと重複していないか確認する
3. `pnpm verify` とコミット済み差分の空白確認を実行する
4. macOSで `pnpm build:mac:safe` を実行する
5. Windowsで `pnpm build:win:safe` を実行し、Windows向けZIPを作る
6. `vMAJOR.MINOR.PATCH` タグを作成してpushする
7. GitHub Draft Releaseを作成する
8. macOS向けDMG/ZIPとWindows向けZIPをAssetsに添付する

ローカル生成物はOS別に分ける。

- macOS: `app/out/darwin/`
- Windows: `app/out/win32/`

`pnpm build:mac:safe` と `pnpm build:win:safe` は、それぞれ対象OSの出力先だけを削除してから生成する。
片方のビルドで、もう片方のOS向け生成物を削除しない。

Draft Release作成後、GitHub上でRelease本文とAssetsを確認し、問題がなければPublishする。

Publishは自動化しない。間違った成果物や説明文をそのまま公開しないため、最後の公開判断は人が行う。

---

## ローカル確認

GitHub Actionsを使わず、手元で事前確認する場合は `app/` で次を実行する。

```sh
pnpm verify
pnpm build:mac:safe
```

Windows向けの最終確認は、Windows環境で起動確認できた成果物だけを対象にする。

---

## Release notes

workflowが作るRelease notesは下書きとして扱う。
Publish前に、実際の変更内容に合わせて必要な範囲で編集する。

Release titleはタグと同じにする。

例:

```text
v0.3.2
```

Release notesは、次の順で短く書く。

1. このリリースで変わったこと
2. 更新時の注意
3. 配布ファイルの選び方

例:

```text
## 変更内容

- リリース運用文書を追加しました。

## 更新時の注意

- アプリ内自動更新はまだありません。GitHub Releasesから新しい配布ファイルを取得してください。

## 配布ファイル

- macOS: RelicのmacOS向けファイルを使用してください。
- Windows: Windows環境で確認済みのファイルがある場合だけ使用してください。
```

---

## Assets

GitHub ReleasesのAssetsには、workflowが作成した配布ファイルだけを添付する。

- macOS: `pnpm build:mac:safe` で生成されたDMG/ZIP
- Windows: `pnpm build:win:safe` で生成された未署名アプリをZIP化したもの

未確認の成果物、途中生成物、`app/out/` の中身を説明なくまとめたファイルは添付しない。
OS別出力先のうち、GitHub Releasesに添付するのはworkflowが `release-assets` に集めた配布用ファイルだけとする。

---

## やらないこと

この手動運用では、次のことはまだ行わない。

- アプリ起動時の自動更新確認
- アプリ内の更新通知
- `electron-updater` などの自動更新ライブラリ導入
- Publishまでの完全自動化
- コード署名、公証、インストーラー方式の変更

これらが必要になった場合は、配布方式、署名、Windows/macOSの確認方法を別作業として決めてから進める。
