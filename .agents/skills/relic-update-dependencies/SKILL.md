---
name: relic-update-dependencies
description: Relicのnpm・pnpm依存関係とGitHub Actions参照versionを候補確認から段階的に更新し、互換性、既知リスク、ライセンス、THIRD_PARTY_NOTICES、SBOM、テスト、Rendererのproduction build・初期読込境界、配布物まで安全に整合させる。依存更新、Electron・Vite・React・Action versionの更新、pnpm audit対応、outdated確認、override整理、lockfile更新に使う。workflowのtrigger・permissions・実行内容はrelic-change-ci、確認だけでは読み取り専用、リリース前確認だけはrelic-releaseを優先する。
---

# Relic Dependency Update

## 依頼と現状を確認する

1. 更新候補の確認、監査、相談だけならファイルを変更しない。追加・削除・更新・脆弱性対応が明示されている場合だけ変更する。
2. リリース準備の一部として確認するだけなら `$relic-release`、依存差分のコミットだけなら `$relic-commit` を優先する。
3. `git status --short`、`app/package.json`、`app/pnpm-lock.yaml`、`docs/engineering/dependency-licenses.md`、`THIRD_PARTY_NOTICES.md`、`sbom/relic-dependencies.cdx.json` を確認し、無関係な差分を保護する。
4. production dependency、devDependency、GitHub Actions参照version、`pnpm.overrides` を分ける。workflow設計変更は `$relic-change-ci` に委ね、production dependencyの追加は既存依存で目的を満たせない場合だけ行う。

## 候補を評価する

1. `app/` で `pnpm outdated` と `pnpm audit --prod` を使い、現在の候補とproduction dependencyの既知リスクを確認する。外部アクセスが必要なら正規の承認経路を使う。
2. runtime、ビルド基盤、テスト、型、間接依存、GitHub Actionsに分類し、影響の小さい単位から扱う。一括更新を既定にしない。
3. major更新、Electron、Vite、React、保存・parse・sanitizeに関わる依存とGitHub Actionでは、公式release notes、migration guide、`action.yml`、配布パッケージの情報を一次情報として互換性・input・runner条件を確認する。
4. package managerが示す最新版だけで採用を決めない。対象Node、Electron、TypeScript、Vite、Vitestとの組合せ、既知の不具合、Relicで使うAPIを確認する。
5. `pnpm.overrides` は元の問題が解消したことを依存グラフと検証で確認できる場合だけ外す。

## 小さく更新する

1. 関係する依存を小さなグループに分け、package manifestとlockfileの差分を都度確認する。
2. API、型、設定、生成物が変わる場合は、互換対応と対象テストを同じ更新単位に含める。依存の都合だけでMarkdown、設定schema、IPC、画面操作の互換性を壊さない。
3. 自動更新Pull RequestやDependabotを導入しない。更新できない候補は、理由と再確認条件を報告し、無理に固定を外さない。
4. 検証が壊れた場合は、その作業で導入した依存差分だけを修正または取り除き、既存差分を巻き戻さない。

## 生成物と検証を整合させる

1. `app/` で `pnpm licenses:generate` を実行し、`THIRD_PARTY_NOTICES.md` と `sbom/relic-dependencies.cdx.json` の差分を目視確認する。未知・独自・複合ライセンスは機械結果だけで判断せず公式情報を確認する。
2. `pnpm licenses:check`、`pnpm verify`、`pnpm docs:index:check`、リポジトリルートの `git diff --check` を実行する。Action参照versionを変えた場合は `$relic-change-ci` の `pnpm ci:workflows:check` も実行する。
3. Rendererのproduction buildまたは初期読込境界へ影響する場合は `pnpm renderer:production:check` を実行する。
4. Electron、Forge、Vite、native moduleなど配布成果物へ影響する場合は、macOSの現行safe buildまたはpackage検査を選ぶ。他OSの成果物を作成、推測、検証対象に含めない。
5. コミットする場合は `$relic-commit` と連携し、`app/package.json` のversion更新後に `pnpm licenses:generate` と `pnpm licenses:check` を再実行して、SBOMのアプリversionを最終状態へ同期してからステージする。
6. package manifest、lockfile、notices、SBOM、override、コード互換対応、検証結果の全差分を確認する。秘密情報、内部URL、ローカル絶対パスを含めない。

## 完了する

採用した更新、見送った候補と理由、互換対応、ライセンス・SBOM、audit、テスト、Rendererのproduction build・初期読込境界、macOS確認、未実施項目を分けて報告する。push、タグ、Releaseは明示指示がある場合だけ行う。
