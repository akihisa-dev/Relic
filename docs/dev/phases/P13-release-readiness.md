# P13-release-readiness.md

Relicの配布判断・リリース準備フェーズの正本。

このフェーズでは、自分用ビルドとして安心して使える状態かを確認し、GitHub機能を含む実アプリ操作と配布ビルドを重点的に検証する。

---

## 優先度

1. 機能維持
2. 配布ビルドの再現性
3. Git / GitHub操作の安全性
4. 実利用前の確認しやすさ

---

## 基本方針

- テスト用ワークスペースはRelicプロジェクトリポジトリ外に置く
- テスト用ワークスペースのGitと、Relic開発リポジトリのGitを混ぜない
- GitHub OAuth / clone / push / pull / conflict解決は実アプリ操作で確認する
- 配布確認はElectron Forge経由を正とする
- コード署名、自動アップデート、Mac App Store対応は、必要性を判断する材料を集めてから決める
- 外部サービスへ情報を送る依存関係監査やGitHub実操作は、実行前にユーザーの明示確認を取る

---

## 事前準備

- [x] テスト用ワークスペースをプロジェクト外へ移動する
- [x] 移動先: `/private/tmp/Relic Test Workspace`
- [x] Relic開発リポジトリ内にテスト用ワークスペースが残っていないことを確認する
- [ ] アプリから移動後のワークスペースを開けることを確認する

---

## 確認項目

### 1. 配布ビルド確認

- [x] `electron-forge package` で自分用アプリを生成できることを確認する
- [x] 必要に応じて `electron-forge make` で配布物を生成できることを確認する
- 生成物から起動できることを確認する
- [x] Vite単独ビルド確認とForge経由ビルド確認の役割を整理する

### 2. Git / GitHub実操作確認

- ローカルGit初期化
- コミット作成
- ブランチ作成・切り替え
- タグ作成・削除
- GitHub OAuth接続
- clone
- remote接続
- push / pull
- conflict検出・解決
- 自動同期設定OFFの安全確認

### 3. 基本機能スモーク確認

- ワークスペース作成・オープン
- ファイル作成・リネーム・移動・削除
- Markdownライブプレビュー
- wikilink / backlink
- タグ検索・全文検索
- frontmatter編集
- ファイル加工ツール

### 4. 残判断

- 自分用ビルドとして日常利用に入るか
- 第三者配布をまだ保留するか
- コード署名・自動アップデート・Mac App Store検討を次の判断に回すか

---

## 確認コマンド

基本確認:

```sh
cd app
pnpm exec tsc --noEmit
pnpm test
```

配布ビルド確認:

```sh
cd app
pnpm exec electron-forge package
pnpm exec electron-forge make
```

依存関係監査:

```sh
cd app
pnpm audit --audit-level moderate
```

注意: 依存関係監査は外部 registry に依存情報を送るため、実行前にユーザーの明示許可を得る。

---

## 完了条件

- [x] テスト用ワークスペースがプロジェクト外に分離されている
- [x] 自動テストと型チェックが成功している
- [x] Forge経由の配布ビルド確認が成功している
- [ ] Git / GitHub実操作の主要導線を確認している（P14へ移管）
- [x] 自分用ビルドとして使い始めるか、追加修正するかを判断できる

---

## 終了判断

- P13は、GitHub連携なしの自分用配布ビルドを生成できる状態まで確認して終了する。
- GitHub認証とリモート操作は未導入のため、P13内で実操作確認せず、P14「GitHub連携の安全導入」へ移管する。
- 第三者配布は、コード署名・自動アップデート・GitHub導線の確認が残るため保留する。

---

## 確認メモ

### 2026-05-09

- テスト用ワークスペースとして `/private/tmp/Relic Test Workspace` を作成し、Relic開発リポジトリ外に分離した。
- Relic開発リポジトリ内にテスト用ワークスペースが残っていないことを確認した。
- `pnpm exec tsc --noEmit` 成功。
- `pnpm test` 成功（30 files / 201 tests）。
- `pnpm exec electron-forge package` 成功。初回はサンドボックス内のDNS制限で `github.com` 解決に失敗し、ネットワーク許可後に成功。
- `pnpm exec electron-forge make` 成功。初回は `fs-xattr` のネイティブaddon未生成でDMG作成に失敗し、`node_modules/fs-xattr` で `node-gyp rebuild` 実行後に成功。
- 成果物: `app/out/Relic-darwin-arm64/Relic.app`, `app/out/make/Relic-0.0.0-arm64.dmg`, `app/out/make/zip/darwin/arm64/Relic-darwin-arm64-0.0.0.zip`。
- `codesign --verify --deep --strict` は未署名/ad-hoc署名状態のため失敗。第三者配布判断ではコード署名を別途確認する。
- Vite単独確認は開発時の型・バンドル境界確認、Forge経由確認は配布用アプリ生成・パッケージング確認として扱う。
- 生成物のGUI起動、アプリからのワークスペースオープン、GitHub実操作、依存関係監査は未実施。
