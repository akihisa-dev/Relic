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

---

## リリースでの扱い

Draft Release workflowでは、配布ZIPとchecksumに加えて、`THIRD_PARTY_NOTICES.md` と `sbom/relic-dependencies.cdx.json` をRelease Assetsへ添付する。
リリース前には、Relic本体のライセンスが `LICENSE`、外部依存関係の一覧が `THIRD_PARTY_NOTICES.md`、機械可読の依存一覧がSBOMで確認できることを確認する。

## 依存関係更新の継続確認

`.github/dependabot.yml` では、`app/` のnpm依存関係とリポジトリ全体のGitHub Actionsを週次で確認する。

Dependabotによる更新Pull Requestでは、`pnpm.overrides` の固定がまだ必要かを確認する。
固定を外せる状態になった場合は、対象依存関係の更新と同じPull Requestまたは別Issueで解除する。

---

## 注意

ライセンス名は各パッケージの `package.json` から取得する。
ライセンス表記が複合的、独自表記、不明、またはRelicの配布方針と矛盾する可能性がある場合は、機械生成結果だけで判断せず、人が公式リポジトリや配布パッケージを確認する。
