# development/release-rules.md

RelicのGitHub Releasesを使った手動リリース手順。
GitHub Actionsを使わず、ローカルで配布ファイルを生成し、GitHub Releasesへ手動で添付する運用を定義する。

---

## 目的

- GitHub ReleasesをRelicの配布場所として使う
- リリースごとに、どのバージョンの成果物かをGitタグとGitHub Releasesで明確にする
- アプリ本体の自動更新機能はまだ追加しない
- GitHub Actionsによる自動化、署名、公証、インストーラーは使わない

ユーザーにとっての「更新」は、GitHub Releasesから新しい配布ファイルを取得し、古いRelicと置き換える運用とする。

---

## 正本

- アプリのバージョン正本は `app/package.json` の `version`
- Gitタグは `vMAJOR.MINOR.PATCH` 形式
- バージョンの上げ方は `docs/development/versioning-rules.md`
- リリース本文はGitHub Releasesの説明欄
- 配布ファイルはGitHub ReleasesのAssets
- GitHub Releasesの操作はGitHub公式ドキュメントの [Managing releases in a repository](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository) を参照する

---

## リリース前に確認すること

1. `app/package.json` の `version` が、配布したい番号になっていることを確認する
2. `docs/development/versioning-rules.md` に従い、必要なバージョン更新がコミット済みであることを確認する
3. 作業中の差分がないことを確認する
4. リリースしたいコミットがGitHubにpush済みであることを確認する
5. `app/` で `pnpm verify` を実行して成功することを確認する
6. リポジトリルートで `git diff --check` を実行して成功することを確認する

---

## ローカル生成

配布ファイルはローカルで生成する。

ローカル生成物はOS別に分ける。

- macOS: `app/out/darwin/`
- Windows: `app/out/win32/`

`pnpm build:mac:safe` と `pnpm build:win:safe` は、それぞれ対象OSの出力先だけを削除してから生成する。
片方のビルドで、もう片方のOS向け生成物を削除しない。

macOS向けの配布物を作る場合は、`app/` で次を実行する。

```sh
pnpm build:mac:safe
```

Windows向けの配布物を作る場合は、Windows環境で `app/` に入り、次を実行する。

```sh
pnpm build:win:safe
```

このMac環境だけでWindows向け配布品質を判断しない。

---

## Gitタグ

バージョン更新コミット後に、`app/package.json` の `version` と同じ番号でタグを作る。

例:

```sh
git tag v0.3.7
git push origin main
git push origin v0.3.7
```

pushはユーザーが明示的に指示した場合だけ実行する。

---

## Draft Release作成

GitHub上で、対象タグから新しいReleaseを作成する。
Assetsの添付漏れを避けるため、まずDraft releaseとして作成し、配布ファイルを添付してから公開する。

Draft Release作成後、GitHub上でRelease本文とAssetsを確認し、問題がなければPublishする。

Publishは自動化しない。間違った成果物や説明文をそのまま公開しないため、最後の公開判断は人が行う。

---

## Release notes

Release notesは手動で作成する。

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

GitHub ReleasesのAssetsには、確認済みの配布ファイルだけを添付する。

- macOS: `pnpm build:mac:safe` で生成されたDMG/ZIP
- Windows: Windows環境で `pnpm build:win:safe` を実行し、起動確認したZIP

未確認の成果物、途中生成物、`app/out/` の中身を説明なくまとめたファイルは添付しない。
OS別出力先のうち、GitHub Releasesに添付するのは配布用として確認したファイルだけとする。

---

## やらないこと

この手動運用では、次のことはまだ行わない。

- アプリ起動時の自動更新確認
- アプリ内の更新通知
- `electron-updater` などの自動更新ライブラリ導入
- GitHub Actionsによる自動リリース
- コード署名、公証、インストーラー方式の変更

これらが必要になった場合は、配布方式、署名、Windows/macOSの確認方法を別作業として決めてから進める。
