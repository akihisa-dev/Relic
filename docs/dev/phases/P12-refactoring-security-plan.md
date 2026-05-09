# P12-refactoring-security-plan.md

Relicの大規模リファクタリング・安全性強化フェーズの正本。

このフェーズでは、GitHub機能の本格導入に備えて、既存機能を維持しながらコード構造・セキュリティ境界・安定性・軽量化を段階的に改善する。

---

## 優先度

1. 機能維持
2. セキュリティ
3. 安定性
4. 軽量化

---

## 基本方針

- 仕様変更とリファクタリングを混ぜない
- 1回の変更は小さくし、既存テストで確認できる単位にする
- IPC API、保存データ形式、ユーザー操作フローは不用意に変えない
- Electron / IPC / GitHub OAuth / ファイル操作の安全境界を弱めない
- 依存関係監査など外部サービスへ情報を送る作業は、ユーザーの明示許可を得てから実行する
- フェーズ専用の計画・チェックリスト・判断メモは `docs/dev/phases/Pxx-*.md` に置き、ファイル名で対応フェーズが分かるようにする

---

## 対象領域

| 優先 | 領域 | 目的 | 主な対象 |
|------|------|------|----------|
| 1 | Renderer肥大分割 | 機能維持しながら変更範囲を小さくする | `app/src/renderer/App.tsx` |
| 2 | Electron / IPC安全境界 | GitHub本格導入前に権限境界を固める | `app/src/main/main.ts`, `app/src/preload/preload.ts`, `app/src/main/ipc/` |
| 3 | Git / GitHub実装分割 | Git操作の事故範囲を局所化する | `app/src/main/files/git.ts`, `app/src/main/github/` |
| 4 | IPCハンドラ共通化 | 入力検証とエラー処理の揺れを減らす | `app/src/main/ipc/*.ts` |
| 5 | Markdownプレビュー安全性 | HTML生成と添付ファイル表示を安全に保つ | `app/src/renderer/components/Preview.tsx` |
| 6 | 軽量化 | バンドル・再描画・読み込み処理を軽くする | renderer全体, Vite設定 |
| 7 | プロジェクト安全性 | 秘密情報混入と危険な開発運用を防ぐ | `.gitignore`, `docs/dev/conventions.md`, CI候補 |

---

## フェーズ文書管理

- [x] フェーズ専用文書を `docs/dev/phases/` に集約
- [x] `P09-feature-checklist.md`, `P11-doc-code-alignment.md`, `P12-refactoring-security-plan.md` のように、ファイル名で対応フェーズが分かる形に改名
- [x] `docs/dev/phases.md`, `docs/INDEX.md`, `AI.md` の現行参照を更新

---

## 実施順

### 1. Rendererの責務分割

- `App.tsx` からGit関連 state / action を hook または専用モジュールへ切り出す
- 次に workspace / file / search / command palette 周辺を分割する
- UI表示コンポーネントのpropsは既存テストが追える形を保つ

完了条件:

- `App.tsx` の責務が明確に分かれる
- 既存UIの表示・操作が変わらない
- `pnpm exec tsc --noEmit` と `pnpm test` が成功する

進捗:

- [x] ワークスペースパス系の純粋関数を `App.tsx` から `app/src/renderer/workspacePaths.ts` へ切り出し
- [x] `workspacePaths.test.ts` を追加し、パス結合・親フォルダ取得・表示名・Markdownパス収集を確認
- [x] アクティブタブ取得とアウトライン抽出を `app/src/renderer/editorDerivedState.ts` へ切り出し
- [x] `editorDerivedState.test.ts` を追加し、ペイン別アクティブタブ取得とMarkdown見出し抽出を確認

### 2. セキュリティ境界の棚卸し

- Electronの `BrowserWindow` 設定、CSP、外部URL許可リストを確認する
- `window.relic` APIの公開範囲を確認する
- IPC入力検証とワークスペース外パス防止を確認する
- MarkdownプレビューのHTMLサニタイズ、画像読み込み、wikilink属性を確認する
- GitHub OAuthのtoken、code、client secretがログ・エラー・設定JSONに出ないことを確認する

完了条件:

- セキュリティ境界を弱めるコードが残っていない
- 必要な安全ルールが `conventions.md` に反映されている
- 追加した安全策にテストがある、または確認方法が明確になっている

進捗:

- [x] Electronの外部遷移・新規ウィンドウ・webview・権限要求の制限を追加
- [x] CSPを追加
- [x] GitHub OAuth callback path の検証と token / code / secret のエラー詳細マスクを追加
- [x] `.gitignore` に秘密鍵・証明書・ローカルAI/エディタ設定の除外を追加

### 3. Git / GitHub実装分割

- `git.ts` を status / branch / tag / commit / diff / sync / conflict などに分ける
- GitHub token利用箇所を限定し、認証情報を引数やログで広げすぎない
- リモート操作の前提確認を共通化する

完了条件:

- Git / GitHubの各責務が独立したファイルに分かれる
- 既存のGitテストが成功する
- リモート操作の安全確認が一貫している

### 4. IPCハンドラ共通化

- active workspace 取得、入力検証、例外の `RelicResult` 化を共通化する
- ファイル操作系・Git操作系・設定系で共通パターンを揃える
- エラー詳細に秘密情報が混ざらないようにする

完了条件:

- 重複が減り、新規IPC追加時の安全確認が漏れにくい
- 既存IPC API名と戻り値は維持される

進捗:

- [x] active workspace 取得と例外の `RelicResult` 化を `app/src/main/ipc/activeWorkspace.ts` に共通化
- [x] Git / GitHub系IPCハンドラで共通ヘルパーを利用し、入力検証と処理本体を読み分けやすく整理

### 5. 軽量化

- 大きい renderer chunk の原因を確認する
- CodeMirror / KaTeX / highlight.js / markdown preview の読み込みを必要に応じて分割する
- 体感に影響しない範囲で再レンダリングを減らす

完了条件:

- 機能維持と安全性を損なわない軽量化だけが入っている
- ビルド時のchunk警告について、対応または保留理由が明確になっている

---

## 確認コマンド

基本確認:

```sh
cd app
pnpm exec tsc --noEmit
pnpm test
```

必要に応じた確認:

```sh
cd app
pnpm exec vite build --config vite.main.config.ts
pnpm exec vite build --config vite.preload.config.ts
pnpm exec vite build --config vite.renderer.config.ts
```

依存関係監査:

```sh
cd app
pnpm audit --audit-level moderate
```

注意: 依存関係監査は外部 registry に依存情報を送るため、実行前にユーザーの明示許可を得る。

---

## 完了条件

- 優先領域のリファクタリングが完了している
- GitHub本格導入に必要なセキュリティ境界が整っている
- `pnpm exec tsc --noEmit` と `pnpm test` が成功する
- 必要なビルド確認が成功する
- 残リスクと次フェーズ候補が整理されている
