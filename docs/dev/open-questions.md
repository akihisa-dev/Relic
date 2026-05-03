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

- [x] パッケージマネージャを何にするか？ → **pnpm** に決定
  - 関連: [tech/stack.md](../tech/stack.md), [architecture/decisions.md](../architecture/decisions.md) #011
- [x] Electronのビルド・配布ツールを何にするか？ → **Electron Forge** に決定
  - 関連: [tech/stack.md](../tech/stack.md), [architecture/decisions.md](../architecture/decisions.md) #012
- [x] テストフレームワークを何にするか？ → **Vitest** に決定
  - 関連: [tech/stack.md](../tech/stack.md), [architecture/decisions.md](../architecture/decisions.md) #013
- [x] 検索インデックスはインメモリ再構築で足りるか、永続化するか？ → **インメモリ再構築**（起動ごとに作り直す）に決定
  - 関連: [architecture/overview.md](../architecture/overview.md), [spec/search.md](../spec/search.md)

---

## P1：初期実装前に決めたい問い

### ファイル・フォルダ管理

- [x] 削除時に確認ダイアログを出さない方針で本当に問題ないか？ → **確認ダイアログあり**に変更
  - 関連: [spec/file-management.md](../spec/file-management.md)
- [x] ファイル名の禁止文字・重複時の扱いをどうするか？ → **どちらもエラー表示して別名入力を促す**に決定
  - 関連: [spec/file-management.md](../spec/file-management.md)
- [x] ファイル作成時、`.md` 拡張子は自動で付けるか、表示上は隠すか？ → **自動付与・表示上は隠す**に決定。サイドバーは `.md` のみ表示（他形式は非表示）
  - 関連: [spec/file-management.md](../spec/file-management.md), [architecture/data-model.md](../architecture/data-model.md)
- [x] ファイル複製時の命名規則をどうするか？ → **「ファイル名 のコピー」**に決定（既存仕様と一致）
  - 関連: [spec/file-management.md](../spec/file-management.md)
- [x] リネーム・移動時に内部リンクを自動更新する前に確認を出すか？ → **確認なしで即時自動更新**に決定
  - 関連: [spec/file-management.md](../spec/file-management.md), [spec/links-and-tags.md](../spec/links-and-tags.md)
- [x] 内部リンク自動更新の対象は本文だけか、フロントマターやコードブロック内も含めるか？ → **本文＋フロントマター**（コードブロック内は除外）に決定
  - 関連: [spec/file-management.md](../spec/file-management.md), [spec/links-and-tags.md](../spec/links-and-tags.md)
- [x] テンプレートフォルダをファイルツリーに表示するか、通常ファイルから隠すか？ → **通常フォルダとして表示**に決定
  - 関連: [spec/links-and-tags.md](../spec/links-and-tags.md), [ui/screens-macos.md](../ui/screens-macos.md)

### 内部リンク・タグ

- [x] 同じファイル名が複数フォルダに存在する場合、`[[ファイル名]]` はどう解決するか？ → **補完でパス付きリンクを提示、ユーザーが選択**して解決に決定
  - 関連: [spec/links-and-tags.md](../spec/links-and-tags.md), [architecture/data-model.md](../architecture/data-model.md)
- [x] 内部リンクにパス指定を許可するか？ → **許可する**（`[[フォルダ/ファイル名]]` 記法をサポート）に決定
  - 関連: [spec/links-and-tags.md](../spec/links-and-tags.md)
- [x] 未作成リンクをクリックして新規作成する場所はどこにするか？ → **リンク元ファイルと同じフォルダ**に決定
  - 関連: [spec/links-and-tags.md](../spec/links-and-tags.md), [ui/navigation.md](../ui/navigation.md)
- [x] バックリンク・アウトゴーイングリンクを「本文の最下部に表示」で確定するか？ → **右パネルに表示**（ナビゲーション補助として位置づけ）に変更
  - 関連: [spec/links-and-tags.md](../spec/links-and-tags.md), [ui/screens-macos.md](../ui/screens-macos.md)
- [x] タグの文字種・階層タグをサポートするか？ → **階層タグ（#親/子）・日本語タグともにサポート**に決定
  - 関連: [spec/links-and-tags.md](../spec/links-and-tags.md)
- [x] 本文タグとフロントマター `tags:` が重複した場合の表示・検索結果をどう扱うか？ → **マージして1件として扱う**に決定。本文タグとフロントマタータグはどちらも有効
  - 関連: [spec/links-and-tags.md](../spec/links-and-tags.md)

### エディタ

- [x] ツールバーの具体的なレイアウト・配置をどうするか？ → **全ボタンを一列に並べる**。グループ間に区切り線を入れる
  - 関連: [spec/editor.md](../spec/editor.md), [ui/screens-macos.md](../ui/screens-macos.md)
- [x] エディタ上部ツールバーは常時表示か、コンパクト化・非表示設定を持つか？ → **常時表示**（非表示設定なし）
  - 関連: [spec/editor.md](../spec/editor.md)
- [x] 保存方式は自動保存のみか、手動保存も持つか？ → **自動保存のみ**
  - 関連: [architecture/overview.md](../architecture/overview.md), [spec/editor.md](../spec/editor.md)
- [x] 自動保存の間隔・タイミングをどうするか？ → **入力停止後1秒**で自動保存
  - 関連: [architecture/overview.md](../architecture/overview.md), [spec/editor.md](../spec/editor.md)
- [x] ライブプレビュー中、Markdown記法そのものをどの程度見せるか？ → **カーソル行だけ記法表示**（Obsidianスタイル）
  - 関連: [spec/editor.md](../spec/editor.md), [spec/markdown.md](../spec/markdown.md)
- [x] フォーカスモード・タイプライターモードは初期リリースに含めるか？ → **含める**
  - 関連: [spec/editor.md](../spec/editor.md)
- [x] エディタフォントのプリセット内容を何にするか？ → **System / ヒラギノ明朝 / Menlo** の3種
  - 関連: [spec/editor.md](../spec/editor.md), [ui/screens-macos.md](../ui/screens-macos.md)
- [x] スペルチェックは日本語にも期待するのか、OS標準の挙動に任せるのか？ → **OS標準に任せる**（macOS標準・英語のみ）
  - 関連: [spec/editor.md](../spec/editor.md)

### 検索・置換

- [x] 検索結果に表示する文脈量をどうするか？ → **一致行のみ**
  - 関連: [spec/search.md](../spec/search.md)
- [x] 検索対象にフロントマターを含めるか？ → **含める**
  - 関連: [spec/search.md](../spec/search.md), [spec/links-and-tags.md](../spec/links-and-tags.md)
- [x] 全ファイル一括置換の前にプレビュー・確認画面を出すか？ → **プレビューあり**（箇所一覧を確認してから実行）
  - 関連: [spec/search.md](../spec/search.md)
- [x] 正規表現検索で無効なパターンを入力したときの表示をどうするか？ → **入力欄を赤く＋エラーメッセージ表示**
  - 関連: [spec/search.md](../spec/search.md)
- [x] 「よく使うパターン一覧」に何を入れるか？ → **汎用4種**（行頭が見出し / URLを含む行 / 日付形式 YYYY-MM-DD / タグ記法 #xxx）
  - 関連: [spec/search.md](../spec/search.md)

### GitHub・Git

- [x] GitHub OAuthの具体的な認証方式をどうするか？ → **ブラウザOAuth** に決定。Personal Access Token貼り付け方式は非対応
  - 関連: [spec/github.md](../spec/github.md)
- [x] GitHub接続なしのローカルGitリポジトリをどこまでサポートするか？ → **サポートする**。GitHubなしでもローカル履歴管理できる
  - 関連: [spec/github.md](../spec/github.md)
- [x] 自動プル・自動プッシュのデフォルトOFFで確定するか？ → **デフォルトOFF** に決定
  - 関連: [spec/github.md](../spec/github.md)
- [x] 自動同期の間隔プリセットを何にするか？ → **5分 / 15分 / 30分 / 60分** に決定
  - 関連: [spec/github.md](../spec/github.md)
- [x] 自動プッシュ時に未保存変更がある場合の扱いをどうするか？ → **保存完了を待ってからプッシュ** に決定
  - 関連: [spec/github.md](../spec/github.md), [architecture/overview.md](../architecture/overview.md)
- [x] 自動コミットメッセージの形式をどうするか？ → **`Update notes: YYYY-MM-DD HH:mm`** に決定
  - 関連: [spec/github.md](../spec/github.md)
- [x] 手動同期時に差分確認を必須にするか、任意にするか？ → **必ず表示** に決定
  - 関連: [spec/github.md](../spec/github.md)
- [x] コンフリクト解決UIは「自分/リモートの二択」だけで足りるか？ → **二択を基本にしつつ、手動編集も許可** に決定
  - 関連: [spec/github.md](../spec/github.md)
- [x] ブランチ切り替え時に未コミット変更がある場合の扱いをどうするか？ → **確認画面を表示し、コミットして切り替え / 変更を残したまま切り替え / キャンセルを選べる** に決定
  - 関連: [spec/github.md](../spec/github.md)
- [x] Gitタグ機能は初期リリースに含めるか、後回しにするか？ → **初期リリースに含める** に決定
  - 関連: [spec/github.md](../spec/github.md)
- [x] GitHubにプッシュできない状態のエラー表示・再試行方法をどうするか？ → **原因別メッセージ＋再試行ボタン＋詳細表示** に決定
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
- [x] アプリ名を何にするか？ → **Relic** に決定
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
