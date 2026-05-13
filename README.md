# Relic

書き手のための、Git付きマークダウンエディタ。

GitHubは強力だが、技術者向けに作られている。Obsidianは高機能だが、バージョン管理の恩恵を受けられない。Relicはその空白を埋める——コードを書かない人間が、自分のテキストの歴史を管理できるアプリ。

> ステータス：開発中

---

## 対象ユーザー

- Markdownでノート・仕様・日記・原稿・技術メモを書きたい人
- 書いたものをプレーンテキストとして長く残したい人
- Gitの履歴管理を使いたいが、CLIや開発者向けツールは重いと感じる人
- VS Codeほど本格的な環境ではなく、書くことに集中できる道具がほしい人

---

## 主な機能

- マークダウンエディタ（ライブプレビュー / ソースモード）
- フォルダ・ファイル管理（ネスト対応）
- 内部リンク `[[...]]` とバックリンク
- タグ `#tag` と全文検索
- GitHub連携（コミット・プッシュ・差分表示・ブランチ管理）
- コマンドパレット / クイックスイッチャー

---

## 技術スタック

- **フレームワーク**: Electron
- **言語**: TypeScript
- **UI**: React
- **エディタエンジン**: CodeMirror 6
- **Git**: isomorphic-git

詳細は `docs/tech/stack.md` を参照。

---

## リポジトリ構成

- `docs/`: 計画・仕様・設計・開発メモ
- `app/`: Electron / React アプリ本体
- `AI.md`: AIエージェント向けの共通ルール

---

## 開発

アプリ本体のコマンドは `app/` で実行する。

```sh
cd app
pnpm install
pnpm start
```

テスト:

```sh
cd app
pnpm test
```

ダブルクリックで起動する場合は `app/Relicを起動.command` を使う。

---

## プラットフォーム

macOS（Sequoia 以降）


## Windows 配布（インストーラーなし）

Windows 版は **インストーラーを使わず**、ZIP 展開後に `Relic.exe` を直接起動する運用です。

1. `pnpm package:win` を実行して `app/out/Relic-win32-x64/` を生成
2. `Relic-win32-x64` フォルダをそのまま配布（または ZIP 化して配布）
3. 利用者は ZIP を展開し、`Relic.exe` を直接起動
4. 必要に応じて `Relic.exe` のショートカットを作成

- `Setup.exe` / `Update.exe` / `.nupkg` は生成しません。
- コード署名なし配布のため SmartScreen 警告が出る可能性があります。
- 方針として SmartScreen よりも Defender 誤検知・隔離の回避を優先します。


### Windows セーフビルド手順（Defender 誤検知対策）

```sh
cd app
pnpm build:win:safe
```

`build:win:safe` は以下を順に実行します。

1. `clean:out` で `app/out` を削除
2. `package:win` で unpacked app (`out/Relic-win32-x64/`) を生成
3. `check:win:safe` で成果物を検証
   - 必須: `out/Relic-win32-x64/Relic.exe`
   - 禁止: `Setup*.exe` / `Update.exe` / `*.nupkg` / `RELEASES`

