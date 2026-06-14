# development/release-rules.md

RelicのGitHub Releasesを使った手動リリース手順。
アプリ内自動更新やGitHub Actionsによる自動ビルドを導入する前の、手作業で迷わず配布するための運用を定義する。

---

## 目的

- GitHub ReleasesをRelicの配布場所として使う
- リリースごとに、どのバージョンの成果物かをGitタグとGitHub Releasesで明確にする
- アプリ本体の自動更新機能はまだ追加しない
- 署名、公証、インストーラー、自動ビルドは別作業として扱う

ユーザーにとっての「更新」は、GitHub Releasesから新しい配布ファイルを取得し、古いRelicと置き換える運用から始める。

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
4. `git diff --check` を実行し、差分の空白・改行問題がないことを確認する
5. コード変更を含むリリースでは、`app/` で必要な検証を実行する

文書整理だけのリリースでは、コードテストではなく対象文書、現在フェーズ正本、参照先文書の整合を確認する。

---

## ビルド

macOS向けの配布物を作る場合は、`app/` で次を実行する。

```sh
pnpm build:mac:safe
```

このコマンドは、既存の安全確認として `app/out/` に禁止成果物が混ざっていないことを確認する。

Windows向けは、現時点ではこのMac環境だけで配布品質を判断しない。
Windows向け配布物をGitHub Releasesへ載せる場合は、Windows環境で起動確認できた成果物だけを対象にする。

---

## Gitタグ

バージョン更新コミット後に、`app/package.json` の `version` と同じ番号でタグを作る。

例:

```sh
git tag v0.3.2
git push origin main
git push origin v0.3.2
```

pushはユーザーが明示的に指示した場合だけ実行する。

---

## GitHub Releases作成

GitHub上で、対象タグから新しいReleaseを作成する。
Assetsの添付漏れを避けるため、まずDraft releaseとして作成し、配布ファイルを添付してから公開する。

Release titleはタグと同じにする。

例:

```text
v0.3.2
```

Release notesには、次の順で短く書く。

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

- macOS: `pnpm build:mac:safe` 後に生成された確認済みファイル
- Windows: Windows環境で起動確認したファイル

未確認の成果物、途中生成物、`app/out/` の中身をまとめた説明不足のファイルは添付しない。

---

## やらないこと

この手動運用では、次のことはまだ行わない。

- アプリ起動時の自動更新確認
- アプリ内の更新通知
- `electron-updater` などの自動更新ライブラリ導入
- GitHub Actionsによる自動ビルド
- コード署名、公証、インストーラー方式の変更

これらが必要になった場合は、配布方式、署名、Windows/macOSの確認方法を別作業として決めてから進める。
