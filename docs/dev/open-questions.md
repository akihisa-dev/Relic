# dev/open-questions.md

このファイルはまだ決まっていない事項を一覧管理するドキュメントです。
未決定のまま進めると実装に影響が出る問いをここに記録します。
決定した事項は [architecture/decisions.md](../architecture/decisions.md) に移します。

---

## 運用ルール

- ここに書くのは「決定」ではなく「決める必要がある問い」
- 決定したら、関連する仕様書・設計書に反映し、必要なら [architecture/decisions.md](../architecture/decisions.md) に理由つきで記録する
- 他の `dev/roadmap.md`・`dev/conventions.md`・`dev/testing.md` は、このファイルの総点検が一段落するまで凍結する

## 優先度

| 優先度 | 意味 |
|--------|------|
| P0 | 実装開始前に決めないと設計が崩れる |
| P1 | 初期実装前に決めたい |
| P2 | 初回リリース前までに決めればよい |
| P3 | 将来検討でよい |

---

## P0：設計の前提に関わる問い

### ワークスペース・保存場所


### アプリの範囲

### 技術選定

- [ ] パッケージマネージャを何にするか？
  - 関連: [tech/stack.md](../tech/stack.md)
  - 候補: npm / pnpm / yarn
- [ ] Electronのビルド・配布ツールを何にするか？
  - 関連: [tech/stack.md](../tech/stack.md)
  - 候補: electron-builder / Electron Forge / Vite連携構成
- [ ] テストフレームワークを何にするか？
  - 関連: [tech/stack.md](../tech/stack.md)
  - 候補: Vitest / Jest / Playwright
- [ ] 検索インデックスはインメモリ再構築で足りるか、永続化するか？
  - 関連: [architecture/overview.md](../architecture/overview.md), [spec/search.md](../spec/search.md)

---

## P1：初期実装前に決めたい問い

### ファイル・フォルダ管理

- [ ] 削除時に確認ダイアログを出さない方針で本当に問題ないか？
  - 関連: [spec/file-management.md](../spec/file-management.md)
  - 備考: OSのゴミ箱に移動するため復元可能だが、非エンジニア向けアプリとして確認の有無を決めたい
- [ ] ファイル名の禁止文字・重複時の扱いをどうするか？
  - 関連: [spec/file-management.md](../spec/file-management.md)
  - 例: 同名ファイル、拡張子なし入力、`/` を含む名前
- [ ] ファイル作成時、`.md` 拡張子は自動で付けるか、表示上は隠すか？
  - 関連: [spec/file-management.md](../spec/file-management.md), [architecture/data-model.md](../architecture/data-model.md)
- [ ] ファイル複製時の命名規則をどうするか？
  - 関連: [spec/file-management.md](../spec/file-management.md)
  - 例: `ファイル名 のコピー` / `ファイル名 copy` / `ファイル名 2`
- [ ] リネーム・移動時に内部リンクを自動更新する前に確認を出すか？
  - 関連: [spec/file-management.md](../spec/file-management.md), [spec/links-and-tags.md](../spec/links-and-tags.md)
- [ ] 内部リンク自動更新の対象は本文だけか、フロントマターやコードブロック内も含めるか？
  - 関連: [spec/file-management.md](../spec/file-management.md), [spec/links-and-tags.md](../spec/links-and-tags.md)
- [ ] テンプレートフォルダをファイルツリーに表示するか、通常ファイルから隠すか？
  - 関連: [spec/links-and-tags.md](../spec/links-and-tags.md), [ui/screens-macos.md](../ui/screens-macos.md)

### 内部リンク・タグ

- [ ] 同じファイル名が複数フォルダに存在する場合、`[[ファイル名]]` はどう解決するか？
  - 関連: [spec/links-and-tags.md](../spec/links-and-tags.md), [architecture/data-model.md](../architecture/data-model.md)
- [ ] 内部リンクにパス指定を許可するか？
  - 関連: [spec/links-and-tags.md](../spec/links-and-tags.md)
  - 例: `[[folder/file]]`
- [ ] 未作成リンクをクリックして新規作成する場所はどこにするか？
  - 関連: [spec/links-and-tags.md](../spec/links-and-tags.md), [ui/navigation.md](../ui/navigation.md)
  - 例: 現在のファイルと同じフォルダ / ワークスペース直下 / ユーザーに選ばせる
- [ ] バックリンク・アウトゴーイングリンクを「本文の最下部に表示」で確定するか？
  - 関連: [spec/links-and-tags.md](../spec/links-and-tags.md), [ui/screens-macos.md](../ui/screens-macos.md)
  - 備考: UI仕様では右パネルにもリンクパネルがある
- [ ] タグの文字種・階層タグをサポートするか？
  - 関連: [spec/links-and-tags.md](../spec/links-and-tags.md)
  - 例: `#親/子`、日本語タグ、スペースを含むタグ
- [ ] 本文タグとフロントマター `tags:` が重複した場合の表示・検索結果をどう扱うか？
  - 関連: [spec/links-and-tags.md](../spec/links-and-tags.md)

### エディタ

- [ ] ツールバーの具体的なレイアウト・配置をどうするか？
  - 関連: [spec/editor.md](../spec/editor.md), [ui/screens-macos.md](../ui/screens-macos.md)
- [ ] エディタ上部ツールバーは常時表示か、コンパクト化・非表示設定を持つか？
  - 関連: [spec/editor.md](../spec/editor.md)
- [ ] 保存方式は自動保存のみか、手動保存も持つか？
  - 関連: [architecture/overview.md](../architecture/overview.md)
  - 備考: 現在は「一定間隔で保存（または手動保存）」と曖昧
- [ ] 自動保存の間隔・タイミングをどうするか？
  - 関連: [architecture/overview.md](../architecture/overview.md)
  - 例: 入力停止後、一定秒数ごと、ファイル切り替え時
- [ ] ライブプレビュー中、Markdown記法そのものをどの程度見せるか？
  - 関連: [spec/editor.md](../spec/editor.md), [spec/markdown.md](../spec/markdown.md)
  - 例: カーソル行だけ記法表示 / 常に一部表示 / 完全レンダリング
- [ ] フォーカスモード・タイプライターモードは初期リリースに含めるか？
  - 関連: [spec/editor.md](../spec/editor.md)
- [ ] エディタフォントのプリセット内容を何にするか？
  - 関連: [spec/navigation.md](../spec/navigation.md), [ui/screens-macos.md](../ui/screens-macos.md)
- [ ] スペルチェックは日本語にも期待するのか、OS標準の挙動に任せるのか？
  - 関連: [spec/editor.md](../spec/editor.md)

### 検索・置換

- [ ] 検索結果に表示する文脈量をどうするか？
  - 関連: [spec/search.md](../spec/search.md)
  - 例: 一致行のみ / 前後1行 / 折りたたみ
- [ ] 検索対象にフロントマターを含めるか？
  - 関連: [spec/search.md](../spec/search.md), [spec/links-and-tags.md](../spec/links-and-tags.md)
- [ ] 全ファイル一括置換の前にプレビュー・確認画面を出すか？
  - 関連: [spec/search.md](../spec/search.md)
- [ ] 正規表現検索で無効なパターンを入力したときの表示をどうするか？
  - 関連: [spec/search.md](../spec/search.md)
- [ ] 「よく使うパターン一覧」に何を入れるか？
  - 関連: [spec/search.md](../spec/search.md)

### GitHub・Git

- [ ] GitHub OAuthの具体的な認証方式をどうするか？
  - 関連: [spec/github.md](../spec/github.md)
  - 例: Device Flow / ブラウザOAuth / Personal Access Tokenは非対応にするか
- [ ] GitHub接続なしのローカルGitリポジトリをどこまでサポートするか？
  - 関連: [spec/github.md](../spec/github.md)
- [ ] 自動プル・自動プッシュのデフォルトOFFで確定するか？
  - 関連: [spec/github.md](../spec/github.md)
- [ ] 自動同期の間隔プリセットを何にするか？
  - 関連: [spec/github.md](../spec/github.md)
- [ ] 自動プッシュ時に未保存変更がある場合の扱いをどうするか？
  - 関連: [spec/github.md](../spec/github.md), [architecture/overview.md](../architecture/overview.md)
- [ ] 自動コミットメッセージの形式をどうするか？
  - 関連: [spec/github.md](../spec/github.md)
- [ ] 手動同期時に差分確認を必須にするか、任意にするか？
  - 関連: [spec/github.md](../spec/github.md)
- [ ] コンフリクト解決UIは「自分/リモートの二択」だけで足りるか？
  - 関連: [spec/github.md](../spec/github.md)
  - 備考: 手動マージ編集を許可するかどうか
- [ ] ブランチ切り替え時に未コミット変更がある場合の扱いをどうするか？
  - 関連: [spec/github.md](../spec/github.md)
- [ ] Gitタグ機能は初期リリースに含めるか、後回しにするか？
  - 関連: [spec/github.md](../spec/github.md)
- [ ] GitHubにプッシュできない状態のエラー表示・再試行方法をどうするか？
  - 関連: [spec/github.md](../spec/github.md), [principles.md](../principles.md)

### UI・ナビゲーション

- [ ] サイドバーのビュー切り替えUIをどうするか？
  - 関連: [ui/screens-macos.md](../ui/screens-macos.md), [ui/navigation.md](../ui/navigation.md)
  - 候補: タブ / アイコンボタン / ドロップダウン / 縦ナビ
- [ ] サイドバーの幅は固定か、ユーザーが変更できるか？
  - 関連: [ui/screens-macos.md](../ui/screens-macos.md)
- [ ] サイドバーを閉じた状態で検索・Git・設定を開いた場合の挙動をどうするか？
  - 関連: [ui/navigation.md](../ui/navigation.md)
- [ ] 右パネルはアウトラインとリンクを同時表示できるか、どちらか一方か？
  - 関連: [ui/screens-macos.md](../ui/screens-macos.md), [ui/navigation.md](../ui/navigation.md)
- [ ] タブを閉じた後に「直前に表示していたタブ」をどう記録するか？
  - 関連: [ui/navigation.md](../ui/navigation.md)
- [ ] タブが0枚のときの空状態に何を表示するか？
  - 関連: [ui/navigation.md](../ui/navigation.md)
- [ ] 分割表示中のタブ管理はペインごとか、全体共通か？
  - 関連: [ui/navigation.md](../ui/navigation.md)
- [ ] 初回起動時に「新規ワークスペース作成」で作るフォルダの保存先をどうするか？
  - 関連: [ui/screens-macos.md](../ui/screens-macos.md), [spec/file-management.md](../spec/file-management.md)
- [ ] コマンドパレット・クイックスイッチャーのUI仕様をどこに書くか？
  - 関連: [PLAN.md](../PLAN.md)
  - 備考: 機能一覧にはあるが、詳細仕様書がまだない

---

## P2：初回リリース前までに決めればよい問い

### ファイル加工ツール

- [ ] ファイル加工ツールは初期リリースに含めるか、リリース後アップデートに回すか？
  - 関連: [spec/file-tools.md](../spec/file-tools.md)
- [ ] 条件指定マージの出力ファイルが既に存在する場合、上書き禁止で別名保存にするか？
  - 関連: [spec/file-tools.md](../spec/file-tools.md)
- [ ] 見出しで分割するとき、ファイル名に使えない文字をどう変換するか？
  - 関連: [spec/file-tools.md](../spec/file-tools.md)
- [ ] 目次生成で既存の目次ファイルを更新する機能を持つか？
  - 関連: [spec/file-tools.md](../spec/file-tools.md)
  - 備考: 現在の原則は「既存ファイルを変更しない」

### 設定・機能トグル

- [ ] どの機能をオン/オフ可能にするか？
  - 関連: [PLAN.md](../PLAN.md), [ui/screens-macos.md](../ui/screens-macos.md)
- [ ] 機能トグルは料金モデルとは切り離して、単なるUI簡略化機能として扱うか？
  - 関連: [PLAN.md](../PLAN.md), [STATUS.md](../STATUS.md)
- [ ] 設定値をワークスペースごとに持つか、アプリ全体で共通にするか？
  - 関連: [architecture/data-model.md](../architecture/data-model.md), [ui/screens-macos.md](../ui/screens-macos.md)
- [ ] アクセントカラーは完全自由指定か、プリセットから選ぶ方式か？
  - 関連: [spec/navigation.md](../spec/navigation.md), [ui/DESIGN.md](../ui/DESIGN.md)

### リリース・配布

- [ ] コード署名をいつ導入するか？
  - 関連: [PLAN.md](../PLAN.md), [architecture/decisions.md](../architecture/decisions.md), [tech/stack.md](../tech/stack.md)
- [ ] Mac App Store配布を将来検討する条件は何か？
  - 関連: [architecture/decisions.md](../architecture/decisions.md)
- [ ] アプリの自動アップデート機能を持つか？
  - 関連: [architecture/decisions.md](../architecture/decisions.md)
- [ ] 最初の配布対象は自分用ビルドか、第三者が使える配布物か？
  - 関連: [PLAN.md](../PLAN.md), [principles.md](../principles.md)

### 料金・プロダクト方針

- [ ] 料金モデルは「当面完全無料」で固定し、フリーミアム検討を凍結するか？
  - 関連: [PLAN.md](../PLAN.md), [STATUS.md](../STATUS.md), [journal/2026-05-01.md](../journal/2026-05-01.md)
- [ ] アプリ名「Lorebooks」は現状維持でよいか？
  - 関連: [journal/2026-05-01.md](../journal/2026-05-01.md)
- [ ] 想定ユーザーを「自分用」から「一般公開」へ広げるタイミングをどう決めるか？
  - 関連: [principles.md](../principles.md), [PLAN.md](../PLAN.md)

---

## P3：将来検討でよい問い

- [ ] iOS版を別アプリとして検討する条件は何か？
  - 関連: [PLAN.md](../PLAN.md), [architecture/decisions.md](../architecture/decisions.md)
- [ ] プラグインなし方針は将来も固定するか？
  - 関連: [PLAN.md](../PLAN.md), [architecture/decisions.md](../architecture/decisions.md)
- [ ] 画像非対応方針は将来も固定するか？
  - 関連: [PLAN.md](../PLAN.md), [architecture/decisions.md](../architecture/decisions.md)
- [ ] AI機能を将来的に入れるか？
  - 関連: なし
  - 備考: 現在の仕様には存在しない。提案する場合はユーザー判断が必要

---

## 解消済みだが、古い記述の整理が必要なもの

- [ ] [architecture/decisions.md](../architecture/decisions.md) の番号順が 008・009・010 で前後している
  - 関連: [architecture/decisions.md](../architecture/decisions.md)
- [ ] [docs/dev/conventions.md](conventions.md) に SwiftUI の記述が残っている
  - 関連: [dev/conventions.md](conventions.md)
  - 備考: 凍結中のため、open questions総点検後に修正する
