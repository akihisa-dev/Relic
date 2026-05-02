# tech/stack.md

プロジェクトの技術スタック詳細。選定済みのもののみ記載。

---

## 確定スタック

| カテゴリ | 技術 | 備考 |
|---------|------|------|
| 言語 | TypeScript | 型安全な開発のため |
| デスクトップフレームワーク | Electron | macOSネイティブアプリを Web 技術で構築 |
| エディタエンジン | CodeMirror 6 | 詳細は [tech/editor-engine.md](editor-engine.md) |
| Git実装 | isomorphic-git | 詳細は [tech/git-implementation.md](git-implementation.md) |
| iCloud連携 | ネイティブファイルシステム経由 | iCloud Drive のローカルフォルダを直接読み書き |
| UIフレームワーク | React | Obsidianと同じ。AI駆動開発との相性が最良 |

---

## 未選定（今後決定が必要なもの）

| カテゴリ | 候補・備考 |
|---------|-----------|
| パッケージマネージャ | npm / pnpm / yarn（未選定） |
| ビルドツール | Vite / webpack / electron-builder（未選定） |
| テストフレームワーク | Vitest / Jest（未選定） |

---

## プラットフォーム

- **対象OS**: macOS（iOS は将来的に別アプリとして検討）
- **配布方法**: GitHub Releases（コード署名・App Store はリリース品質になった段階で検討）
