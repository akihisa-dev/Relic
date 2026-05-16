# Relic

Relicは、書き手のためのMarkdownワークスペースです。

ローカルフォルダ内のMarkdownファイルをそのまま扱い、執筆・整理・検索・参照をデスクトップアプリ内で完結させることを目的にしています。

> ステータス: 開発中

---

## 対象ユーザー

- Markdownでノート・仕様・日記・原稿・技術メモを書きたい人
- 書いたものをプレーンテキストとして長く残したい人
- VS Codeほど本格的な環境ではなく、書くことに集中できる道具がほしい人
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
- ダッシュボード、グラフ、年表 / 日付チャート
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

詳細は [docs/tech/stack.md](docs/tech/stack.md) を参照してください。

---

## リポジトリ構成

- `app/`: Electron / React アプリ本体
- `docs/`: 計画・仕様・設計・開発メモ
- `docs/product/`: Relic固有のプロダクト前提
- `scripts/`: 起動・ビルドなどの補助スクリプト
- `AI.md`: AIエージェント向けの共通ルール
- `AGENTS.md`: AIエージェント向けの入口。実ルールは `AI.md` を参照
- `CLAUDE.md`: Claude Code向けの入口。実ルールは `AI.md` を参照
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

- 現在の開発フェーズ: [docs/dev/phases.md](docs/dev/phases.md)
- プロジェクト概要: [docs/product/project.md](docs/product/project.md)
- 仕様書: [docs/spec](docs/spec)
- アーキテクチャ: [docs/architecture](docs/architecture)
- 技術スタック: [docs/tech/stack.md](docs/tech/stack.md)
