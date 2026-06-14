# engineering/stack.md

プロジェクトの技術スタック詳細。選定済みのもののみ記載。

---

## 確定スタック

アプリ本体とNode依存関係は `app/` 配下で管理する。`app/package.json` の `packageManager` は `pnpm@10.10.0`。

| カテゴリ | 技術 | 備考 |
|---------|------|------|
| 言語 | TypeScript 5.9 | 型安全な開発のため |
| デスクトップフレームワーク | Electron 42 | macOS / Windows 向けデスクトップアプリを Web 技術で構築 |
| エディタエンジン | CodeMirror 6 | 詳細は [editor-engine.md](editor-engine.md) |
| Markdownパーサー | marked | プレビューHTML生成に使用 |
| Markdown脚注拡張 | marked-footnote | 脚注記法をmarkedへ追加 |
| HTML安全化 | DOMPurify | MarkdownプレビューのHTMLをサニタイズ |
| シンタックスハイライト | highlight.js | コードブロックのハイライトに使用 |
| 数式表示 | KaTeX | Markdown内の数式表示に使用 |
| Mermaid図表示 | mermaid | `mermaid` コードブロックをSVG表示。遅延読み込みし、生成SVGをサニタイズする |
| D2図表示 | @terrastruct/d2 | `d2` コードブロックをSVG表示。D2描画は直列キューで実行する |
| YAML処理 | js-yaml | フロントマターの読み書きに使用 |
| クラウド同期フォルダ対応 | ネイティブファイルシステム経由 | iCloud Drive / OneDrive / Dropbox などを、OS上のローカルフォルダとして直接読み書き。各クラウドサービスのAPI連携は持たない |
| UIフレームワーク | React 19 | レンダラーUIを構築 |
| React状態管理 | Zustand | 横断的UI状態に限定して使用。ファイル内容・検索結果・設定永続化は入れない |
| 設定保存 | Electron userData 配下のJSON + 自前設定サービス | アプリ設定とワークスペース設定を分けて保存 |
| パッケージマネージャ | pnpm 10.10 | `app/` 配下でスクリプトを実行 |
| ビルド・配布ツール | Electron Forge 7 + Vite plugin | main / preload / renderer をVite設定で分割してビルド |
| Vite | Vite 6 | rendererはReact plugin、Markdown preview系とCodeMirror系をmanual chunk化 |
| テストフレームワーク | Vitest 4 | `vitest run`。設定は `app/vitest.config.ts` |
| React UIテスト | React Testing Library + jest-dom + jsdom | ユーザー操作に近い形でReactコンポーネントをテスト |

---

## プラットフォーム

- **対象OS**: macOS / Windows。iOS は現行スタックの対象外とし、必要になった場合はデスクトップ版とは別に検討する
- **配布方法**: Electron Forge の `package:mac` / `package:win`、`make:mac` / `make:win` を使用する。macOSはZIP/DMG、WindowsはZIP makerを設定済み
