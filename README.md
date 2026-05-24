# Relic

Relicは、ローカルMarkdownを扱うデスクトップアプリです。

現在はリブート直後の `v0.0.1` として、既存アプリを保ちながら文書構造と開発方針を整理しています。

> ステータス: 開発中

---

## 現在の呼び方

アプリ本体の名称は、現時点では次を正とします。

- ワークスペース
- ファイル
- フォルダ

過去の名称変更案は採用していません。

---

## 現在バージョン

現在のバージョンは `v0.0.1` です。

アプリ本体の機械的なバージョンは `app/package.json` の `version` を正とします。
Gitタグやリリース名では、先頭に `v` を付けて `v0.0.1` の形にします。

---

## リポジトリ構成

- `app/`: Electron / React アプリ本体
- `docs/`: 現在の開発文書
- `scripts/`: 起動・ビルドなどの補助スクリプト
- `AGENTS.md`: AIエージェントと開発運用の唯一のルール文書
- `SECURITY.md`: 秘密情報と認証情報の扱い

---

## 開発

アプリ本体のコマンドは `app/` で実行します。

```sh
cd app
pnpm install
pnpm start
```

補助スクリプトでも開発版を起動できます。

- macOS: `scripts/Relicを起動.command`
- Windows: `scripts/Relicを起動.bat`

---

## 検証

```sh
cd app
pnpm typecheck
pnpm test
```

まとめて実行する場合:

```sh
pnpm verify
```

---

## ドキュメント

- 文書索引: `docs/INDEX.md`
- プロジェクト概要: `docs/product/project.md`
- フェーズ一覧: `docs/dev/phases.md`
- 現在フェーズ: `docs/dev/phases/P00.md`
