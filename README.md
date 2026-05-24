# Relic

Relicは、創作設定の作成、保管、閲覧のためのアプリです。

物語・世界観・キャラクター・用語・出来事などの設定情報をローカルMarkdownとして扱い、作成・整理・検索・閲覧をデスクトップアプリ内で行えるようにすることを目的にしています。

> ステータス: 開発中

---

## 対象ユーザー

- 物語、世界観、キャラクター、用語、出来事などの創作設定を整理したい人
- 創作設定をプレーンテキストとして長く残したい人
- 設定資料を作成し、保管し、必要なときに読み返せる道具がほしい人
- ローカルフォルダやクラウド同期フォルダを、自分で管理できる形のまま使いたい人

---

## 現在の主な機能

- Markdownエディタ（ライブプレビュー）
- ローカルワークスペース管理
- ファイル / フォルダの作成、リネーム、移動、複製、削除、ピン留め
- タブ、左右分割表示、右パネル
- 内部リンク `[[...]]`
- バックリンク / アウトゴーイングリンク
- アウトライン表示
- フロントマター（YAML）編集補助
- フロントマター設定（固定プロパティ確認・カスタムプロパティ入力能力）
- フロントマター `tags:` によるタグ扱い
- 全文検索、ファイル名検索、タグ検索、フロントマター検索、正規表現検索
- クイックスイッチャー
- コマンドパレット
- 年表 / 日付チャート
- ファイル加工ツール（マージ、分割、タイトル一覧、目次生成）
- ライト / ダーク / システム追従テーマ

---

## プラットフォーム

- macOS
- Windows

RelicはElectronアプリです。OS固有処理は必要な箇所だけに限定し、通常のファイル操作は各OSのローカルフォルダとして扱います。

---

## 技術スタック

- TypeScript
- Electron
- React
- CodeMirror 6
- Zustand
- Vitest
- Electron Forge
- pnpm

詳細は [docs/engineering/stack.md](docs/engineering/stack.md) を参照してください。

---

## リポジトリ構成

- `app/`: Electron / React アプリ本体
- `docs/`: 計画・仕様・設計・開発メモ
- `docs/project/`: Relicの目的、対象ユーザー、用語
- `docs/features/`: 機能仕様
- `docs/design/`: 画面構成、遷移、デザインシステム
- `docs/engineering/`: アーキテクチャ、データモデル、技術選定
- `docs/development/`: フェーズ、開発規約、検証方針
- `scripts/`: 起動・ビルドなどの補助スクリプト
- `AGENTS.md`: AIエージェント向けの共通ルール
- `SECURITY.md`: 秘密情報と認証情報の扱いに関する方針
- `README.md`: 対外的なプロジェクト説明

---

## 開発

アプリ本体のコマンドは `app/` で実行します。

```sh
cd app
pnpm install
pnpm start
```

OS別の起動エイリアス:

```sh
pnpm start:mac
pnpm start:win
```

`start:mac` / `start:win` は同じElectron開発起動をOS別名で呼ぶためのエイリアスです。実行するOS上で使います。

ターミナル操作を避けたい場合は、`scripts/` 配下の補助スクリプトで開発版を起動できます。

- macOS: `scripts/Relicを起動.command`
- Windows: `scripts/Relicを起動.bat`

---

## 検証

型チェックとテストをまとめて実行します。

```sh
cd app
pnpm verify
```

個別に実行する場合:

```sh
pnpm typecheck
pnpm test
```

OS別のテストエイリアス:

```sh
pnpm test:mac
pnpm test:win
```

---

## Macビルド

```sh
cd app
pnpm build:mac:safe
```

補助スクリプトを使う場合は `scripts/Relicをビルド.command` を実行します。このスクリプトも `build:mac:safe` を実行します。

`build:mac:safe` は以下を順に実行します。

1. `clean:out` で `app/out` を削除
2. `package:mac` で unpacked app を生成
3. `check:mac:safe` で成果物を検証

検証内容:

- 必須: `out/Relic-darwin-*/Relic.app/Contents/MacOS/Relic`
- 必須: `out/Relic-darwin-*/Relic.app/Contents/Resources/app.asar`
- 禁止: `Setup*.exe` / `Update.exe` / `*.nupkg` / `RELEASES`

---

## Windowsビルド

Windows版はインストーラーを使わず、ZIP展開後に `Relic.exe` を直接起動する運用です。

```sh
cd app
pnpm build:win:safe
```

補助スクリプトを使う場合は `scripts/Relicをビルド.bat` を実行します。このスクリプトも `build:win:safe` を実行します。

`build:win:safe` は以下を順に実行します。

1. `clean:out` で `app/out` を削除
2. `package:win` で unpacked app を生成
3. `check:win:safe` で成果物を検証

検証内容:

- 必須: `out/Relic-win32-x64/Relic.exe`
- 必須: `out/Relic-win32-x64/resources/app.asar`
- 禁止: `Setup*.exe` / `Update.exe` / `*.nupkg` / `RELEASES`

配布する場合は、`out/Relic-win32-x64/` フォルダをそのまま配布するかZIP化します。

---

## ドキュメント

- 文書索引・分類: [docs/INDEX.md](docs/INDEX.md)
- 現在の開発フェーズ: [docs/development/phases.md](docs/development/phases.md)
- プロジェクト概要: [docs/project/overview.md](docs/project/overview.md)
- 用語集: [docs/project/terms.md](docs/project/terms.md)
- 機能仕様: [docs/features](docs/features)
- デザイン文書: [docs/design](docs/design)
- エンジニアリング文書: [docs/engineering](docs/engineering)
- 技術スタック: [docs/engineering/stack.md](docs/engineering/stack.md)
- 開発規約・テスト方針・バージョン管理: [docs/development/coding-rules.md](docs/development/coding-rules.md), [docs/development/testing-rules.md](docs/development/testing-rules.md), [docs/development/versioning-rules.md](docs/development/versioning-rules.md)

旧フェーズ文書と旧日誌の履歴は `docs/development/phases/P0.md` に統合済みです。現行の仕様・設計判断は上記の正本文書を参照します。
