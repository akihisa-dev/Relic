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

- [ ] テスト用ワークスペースをプロジェクト外へ移動する
- [ ] 移動先の例: `~/Desktop/Relic Test Workspace`
- [ ] Relic開発リポジトリ内にテスト用ワークスペースが残っていないことを確認する
- [ ] アプリから移動後のワークスペースを開けることを確認する

---

## 確認項目

### 1. 配布ビルド確認

- `electron-forge package` で自分用アプリを生成できることを確認する
- 必要に応じて `electron-forge make` で配布物を生成できることを確認する
- 生成物から起動できることを確認する
- Vite単独ビルド確認とForge経由ビルド確認の役割を整理する

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

- [ ] テスト用ワークスペースがプロジェクト外に分離されている
- [ ] 自動テストと型チェックが成功している
- [ ] Forge経由の配布ビルド確認が成功している
- [ ] Git / GitHub実操作の主要導線を確認している
- [ ] 自分用ビルドとして使い始めるか、追加修正するかを判断できる
