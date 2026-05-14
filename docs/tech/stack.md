# tech/stack.md

プロジェクトの技術スタック詳細。選定済みのもののみ記載。

---

## 確定スタック

| カテゴリ | 技術 | 備考 |
|---------|------|------|
| 言語 | TypeScript | 型安全な開発のため |
| デスクトップフレームワーク | Electron | macOS / Windows 向けデスクトップアプリを Web 技術で構築 |
| エディタエンジン | CodeMirror 6 | 詳細は [tech/editor-engine.md](editor-engine.md) |
| Markdownパーサー | marked | プレビューHTML生成に使用 |
| HTML安全化 | DOMPurify | MarkdownプレビューのHTMLをサニタイズ |
| シンタックスハイライト | highlight.js | コードブロックのハイライトに使用 |
| 数式表示 | KaTeX | Markdown内の数式表示に使用 |
| YAML処理 | js-yaml | フロントマターの読み書きに使用 |
| クラウド同期フォルダ対応 | ネイティブファイルシステム経由 | iCloud Drive / OneDrive / Dropbox などを、OS上のローカルフォルダとして直接読み書き。各クラウドサービスのAPI連携は持たない |
| UIフレームワーク | React | Obsidianと同じ。AI駆動開発との相性が最良 |
| React状態管理 | Zustand | 横断的UI状態に限定して使用。ファイル内容・検索インデックス・設定永続化は入れない |
| 設定保存 | Electron userData 配下のJSON + 自前設定サービス | アプリ設定とワークスペース設定を分けて保存 |
| パッケージマネージャ | pnpm | 高速・軽量。Electron × React の定番 |
| ビルド・配布ツール | Electron Forge | Electron公式推奨。プロジェクト作成〜配布を一括管理 |
| テストフレームワーク | Vitest | 高速・設定簡単。TypeScript との相性が最良 |
| React UIテスト | React Testing Library | ユーザー操作に近い形でReactコンポーネントをテスト |

---

## プラットフォーム

- **対象OS**: macOS / Windows。iOS は現行スタックの対象外とし、必要になった場合はデスクトップ版とは別に検討する
- **配布方法**: リリース品質になった段階で検討
