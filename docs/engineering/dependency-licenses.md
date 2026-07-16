# 依存関係ライセンスとSBOM

Relicの配布物に含まれ得る外部ライブラリの確認方法を定義する。
この文書は法的な最終判断ではなく、依存関係のライセンスとSBOMを継続的に確認しやすくするための運用ルールである。

---

## 対象

配布物向けの notices とSBOMでは、`app/package.json` の `dependencies` を対象にする。
`devDependencies` は型チェック、テスト、ビルド、開発補助に使う依存関係として扱い、配布物向け notices には含めない。

依存関係の最終的な同梱範囲を判断する必要がある場合は、Electron Forgeの成果物、`app/out/` の内容、生成されたSBOM、各パッケージの公式ライセンス情報を合わせて確認する。

---

## 管理ファイル

| ファイル | 役割 |
|----------|------|
| `THIRD_PARTY_NOTICES.md` | production dependencies の package name、version、license、repository を人が確認する一覧 |
| `sbom/relic-dependencies.cdx.json` | production dependencies をCycloneDX形式で確認するためのSBOM |
| `app/scripts/generate-third-party-notices.mjs` | notices生成・差分確認スクリプト |
| `app/scripts/generate-sbom.mjs` | SBOM生成・差分確認スクリプト |

---

## 依存関係の更新方針

- npm / pnpm依存関係とGitHub Actionsの更新確認に、自動更新Pull RequestやDependabotを使わない
- `.github/dependabot.yml` は作成せず、必要なタイミングでローカルから更新候補を確認する
- 更新候補は影響の小さいものから適用し、検証に通ったものだけを採用する
- 更新で検証が壊れた場合は、その作業で導入した依存変更だけを戻し、既存の差分には触れない
- `pnpm.overrides` の対象がまだ必要か確認し、不要になった固定は依存更新と同じ作業または別作業で外す
- ビルド基盤やElectronなど配布成果物に影響する依存を更新した場合は、対象OSの安全ビルドまたはパッケージ確認を行う

## 更新手順

依存関係を追加・削除・更新した場合は、`app/` で次を実行する。

```sh
pnpm licenses:generate
pnpm licenses:check
pnpm verify
pnpm docs:index:check
git -C .. diff --check
```

`pnpm licenses:generate` は `THIRD_PARTY_NOTICES.md` と `sbom/relic-dependencies.cdx.json` を更新する。
`pnpm licenses:check` は生成結果がGit管理中のファイルと一致しているか確認する。
`pnpm verify` と `pnpm verify:full` も同じ整合確認を含み、通常の変更やバージョン更新で生成漏れをpush前に検出する。
更新候補とproduction dependenciesの既知リスクを確認する場合は、`app/` で `pnpm outdated` と `pnpm audit --prod` を実行する。

---

## リリースでの扱い

Draft Release workflowでは、配布ZIPとchecksumに加えて、`THIRD_PARTY_NOTICES.md` と `sbom/relic-dependencies.cdx.json` をRelease Assetsへ添付する。
リリース前には、Relic本体のライセンスが `LICENSE`、外部依存関係の一覧が `THIRD_PARTY_NOTICES.md`、機械可読の依存一覧がSBOMで確認できることを確認する。

## 依存関係更新の継続確認

依存関係は、リリース前、依存更新作業、大きな実装後など、必要な区切りでローカルから確認する。
Gitタグを作成するリリース作業では、タグ作成前に `pnpm outdated` と `pnpm audit --prod` を実行する。

---

## 注意

ライセンス名は各パッケージの `package.json` から取得する。
ライセンス表記が複合的、独自表記、不明、またはRelicの配布方針と矛盾する可能性がある場合は、機械生成結果だけで判断せず、人が公式リポジトリや配布パッケージを確認する。
