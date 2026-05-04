# dev/open-questions.md

このファイルはまだ決まっていない事項を一覧管理するドキュメントです。
未決定のまま進めると実装に影響が出る問いをここに記録します。
決定した事項は `[x]` として残し、必要に応じて [architecture/decisions.md](../architecture/decisions.md) にも記録します。

---

## 運用ルール

- ここに書くのは「決める必要がある問い」
- 解決済みの問いも `[x]` として残す
- 決定したら、関連する仕様書・設計書に反映し、必要なら [architecture/decisions.md](../architecture/decisions.md) に理由つきで記録する
- `dev/roadmap.md`・`dev/conventions.md`・`dev/testing.md` は、2026-05-04 にユーザー指示で凍結解除済み

## 優先度

| 優先度 | 意味 |
|--------|------|
| P0 | 実装開始前に決めないと設計が崩れる |
| P1 | 初期実装前に決めたい |
| P2 | 初回リリース前までに決めればよい |
| P3 | 将来検討でよい |

---

## P0：設計の前提に関わる問い

### 実装基盤

- [x] Reactのアプリ状態管理は、React標準のstate/context中心で始めるか、最初から軽量な状態管理ライブラリを導入するか？ → **Zustandを採用**。ただし、タブ・ペイン・サイドバー・右パネル・アクティブワークスペース・UI設定反映などの横断的UI状態に限定し、フォーム入力・メニュー開閉・モーダル内状態はReactローカルstateで扱う。ファイル内容・Git状態・検索インデックス・LinkIndex / TagIndex・設定の永続化はZustandに入れない
  - 関連: [dev/conventions.md](conventions.md), [dev/roadmap.md](roadmap.md), [architecture/overview.md](../architecture/overview.md), [tech/stack.md](../tech/stack.md)
- [x] アプリ設定・ワークスペース設定の保存形式と保存ライブラリをどうするか？（例：Electron userData配下のJSON、設定保存ライブラリ利用など） → **Electronの userData 配下にJSONで保存し、自前の設定サービスで管理**する。アプリ設定は `app-settings.json`、ワークスペース設定は `workspaces/{workspaceId}.json` を基本とする
  - 関連: [dev/conventions.md](conventions.md), [architecture/data-model.md](../architecture/data-model.md), [ui/screens-macos.md](../ui/screens-macos.md)
- [x] GitHub OAuthの実装詳細をどうするか？（OAuth Appの扱い、callback/deep link、取得トークンの保存先、macOS Keychain等の安全な保存方法） → **ブラウザOAuthで認証し、取得した認証情報はmacOS Keychainに保存**する。Personal Access Token貼り付け方式は使わない
  - 関連: [spec/github.md](../spec/github.md), [tech/git-implementation.md](../tech/git-implementation.md), [dev/conventions.md](conventions.md)
- [x] Markdownライブプレビューの実装ライブラリ構成をどうするか？（CodeMirror拡張だけで寄せるか、Markdownパーサー・sanitize・KaTeX連携ライブラリを組み合わせるか） → **CodeMirror 6を中心にしつつ、Markdown解析・HTML安全化・KaTeX連携などの専用ライブラリを組み合わせる**。CodeMirrorだけで無理に完結させない
  - 関連: [spec/markdown.md](../spec/markdown.md), [spec/editor.md](../spec/editor.md), [tech/editor-engine.md](../tech/editor-engine.md), [dev/roadmap.md](roadmap.md)
- [x] UIテストで使うReact向け補助ライブラリをどうするか？（Vitestに加えて何を採用するか） → **React Testing Library** を採用する
  - 関連: [dev/testing.md](testing.md), [tech/stack.md](../tech/stack.md)

### ドキュメント整合性

- [x] `docs/dev/open-questions.md` は、解決済みの問いを `[x]` として残す運用にするか、`docs/_rules.md` の記述どおり決定後に削除する運用に戻すか？ → **解決済みの問いも `[x]` として残す**運用に決定
  - 関連: [dev/open-questions.md](open-questions.md), [_rules.md](../_rules.md), [AI.md](../../AI.md)
- [x] `dev/roadmap.md`・`dev/conventions.md`・`dev/testing.md` の編集停止状態は、総点検完了後もユーザーの明示指示があるまで継続とするか、別の再開条件を定義するか？ → **2026-05-04 にユーザー指示で凍結解除**。以後は通常の開発ドキュメントとして編集可能
  - 関連: [dev/open-questions.md](open-questions.md), [STATUS.md](../STATUS.md)
- [x] `README.md` の対象ユーザー定義を、現在の `principles.md` に合わせて広いMarkdown利用者向けに更新するか？ → **更新する**ことに決定
  - 関連: [README.md](../../README.md), [principles.md](../principles.md)
- [x] `README.md` の技術スタックを、現在の確定スタック（isomorphic-git / React / pnpm / Electron Forge / Vitest など）に合わせて更新するか？ → **READMEには主要技術だけを簡潔に載せ、詳細は `docs/tech/stack.md` に任せる**ことに決定
  - 関連: [README.md](../../README.md), [tech/stack.md](../tech/stack.md), [tech/git-implementation.md](../tech/git-implementation.md)
- [x] `PLAN.md` の技術スタック表を、現在の確定スタック全体に合わせて補完するか？ → **PLAN.mdは大枠に留め、詳細は `docs/tech/stack.md` を正とする**ことに決定
  - 関連: [PLAN.md](../PLAN.md), [tech/stack.md](../tech/stack.md)
- [x] `STATUS.md` の古い備考（未決定事項が複数残存、ADR 8件、未選定項目あり等）を、現在の状態に合わせて更新するか？ → **更新する**ことに決定
  - 関連: [STATUS.md](../STATUS.md), [architecture/decisions.md](../architecture/decisions.md), [tech/stack.md](../tech/stack.md), [dev/open-questions.md](open-questions.md)
- [x] `architecture/overview.md` の `LinksPanel` 説明を、右パネル表示の現行仕様に合わせて修正するか？ → **修正する**ことに決定
  - 関連: [architecture/overview.md](../architecture/overview.md), [spec/links-and-tags.md](../spec/links-and-tags.md), [ui/screens-macos.md](../ui/screens-macos.md)
- [x] `spec/navigation.md` に、UI側で決定済みの縦アイコンナビ・可変幅サイドバー・右パネル切り替え・タブ履歴・ペイン別タブ管理などを反映するか？ → **反映する**ことに決定
  - 関連: [spec/navigation.md](../spec/navigation.md), [ui/navigation.md](../ui/navigation.md), [ui/screens-macos.md](../ui/screens-macos.md)
- [x] `docs/_rules.md` の `README.md` 参照を、現在の `docs/INDEX.md` 運用に合わせて修正するか？ → **修正する**ことに決定
  - 関連: [_rules.md](../_rules.md), [INDEX.md](../INDEX.md)
- [x] `docs/mockups/` は現行仕様に追従して更新するか、古い名称ラベル版の参考資料として残すか？ → **現行仕様に追従して更新する**ことに決定
  - 関連: [mockups/](../mockups/), [ui/screens-macos.md](../ui/screens-macos.md), [spec/navigation.md](../spec/navigation.md)
- [x] `docs/mockups/settings-view.html` に残っているアクセントカラー設定を、現行仕様に合わせて削除するか？ → **削除する**ことに決定
  - 関連: [mockups/settings-view.html](../mockups/settings-view.html), [spec/navigation.md](../spec/navigation.md), [ui/screens-macos.md](../ui/screens-macos.md)
- [x] `tech/stack.md` の連続した区切り線など、内容矛盾ではない整形漏れも整合性修正の対象に含めるか？ → **整合性修正の対象に含める**ことに決定
  - 関連: [tech/stack.md](../tech/stack.md)

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

### 操作・初期値

- [x] キーボードショートカットの具体的な割り当てをどうするか？（検索、コマンドパレット、クイックスイッチャー、サイドバー開閉、分割表示、右パネルなど） → **Mac標準の感覚に寄せた初期割り当て**にする。検索 `⌘F`、全体検索 `⌘⇧F`、コマンドパレット `⌘⇧P`、クイックスイッチャー `⌘P`、サイドバー開閉 `⌘B`、新規ノート `⌘N`、タブを閉じる `⌘W`、分割表示 `⌘\`、右パネル開閉 `⌘⇧B`
  - 関連: [spec/navigation.md](../spec/navigation.md), [spec/command-palette.md](../spec/command-palette.md), [spec/search.md](../spec/search.md), [dev/roadmap.md](roadmap.md)
- [x] 添付画像フォルダのデフォルト名と作成タイミングをどうするか？（例：`attachments/` を固定にするか、設定で変更可能にするか） → **`attachments/` 固定**。画像貼り付け時ではなく、ワークスペース作成時または既存フォルダ登録時に自動作成する。ユーザーにフォルダ名や作成有無は選ばせない
  - 関連: [spec/markdown.md](../spec/markdown.md), [spec/file-management.md](../spec/file-management.md), [architecture/data-model.md](../architecture/data-model.md)
- [x] テンプレートフォルダのデフォルト名をどうするか？（例：`_templates` / `templates` / ユーザーが初回設定で選ぶ、など） → **`templates/` 固定**。ワークスペース作成時または既存フォルダ登録時に自動作成する。ユーザーにフォルダ名や作成有無は選ばせない
  - 関連: [spec/links-and-tags.md](../spec/links-and-tags.md), [spec/file-management.md](../spec/file-management.md), [ui/screens-macos.md](../ui/screens-macos.md)
- [x] フォルダ削除時もファイル削除と同じ確認ダイアログを出すか？確認文言はどうするか？ → **確認ダイアログを出す**。「このフォルダをゴミ箱に移動しますか？フォルダ内のノートと添付ファイルも一緒に移動されます。」を基本文言にする
  - 関連: [spec/file-management.md](../spec/file-management.md), [dev/conventions.md](conventions.md)
- [x] フォルダのリネーム・移動時、配下ファイルへの内部リンクをどの範囲で自動更新するか？ → **配下の `.md` ファイルへの内部リンクを、本文とフロントマター内で自動更新**する。コードブロック内は更新しない。対象は現在のワークスペース内。確認は出さずに即時更新する
  - 関連: [spec/file-management.md](../spec/file-management.md), [spec/links-and-tags.md](../spec/links-and-tags.md), [dev/testing.md](testing.md)
- [x] ブロック参照IDは、ユーザー手入力のみとするか、アプリが自動生成して挿入できるUIを持つか？ → **Relicが自動生成して挿入できるUIを持つ**。既存の手書きIDも読み取るが、手入力を前提にしない
  - 関連: [spec/links-and-tags.md](../spec/links-and-tags.md), [spec/markdown.md](../spec/markdown.md)
- [x] ファイル埋め込み `![[ファイル名]]` の表示範囲と制限をどうするか？（再帰埋め込み、巨大ファイル、埋め込み内リンク操作など） → **埋め込み表示は一段階まで**。埋め込み先の中にさらに `![[...]]` があっても展開しない。大きすぎるファイルは全文表示せず、元ファイルを開く導線を出す。埋め込み内リンクは通常どおり開く。埋め込み内では直接編集しない
  - 関連: [spec/markdown.md](../spec/markdown.md), [spec/links-and-tags.md](../spec/links-and-tags.md)
- [ ] フロントマター固定システムフィールド `author` の型は、テキスト単体と配列のどちらを正とするか？ → **フロントマター仕様のこだわりポイントとして棚上げ**。`author` 単体では決めず、入力UI・候補選択・手入力を減らす設計とあわせて [spec/frontmatter.md](../spec/frontmatter.md) の文脈で決める
  - 関連: [spec/frontmatter.md](../spec/frontmatter.md), [architecture/data-model.md](../architecture/data-model.md)
- [ ] フロントマター固定システムフィールド `status` の初期選択肢を用意するか、最初からユーザー定義のみとするか？ → **フロントマター仕様のこだわりポイントとして棚上げ**。`author` と同様に、[spec/frontmatter.md](../spec/frontmatter.md) の文脈でまとめて決める
  - 関連: [spec/frontmatter.md](../spec/frontmatter.md), [ui/screens-macos.md](../ui/screens-macos.md)

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

- [x] サイドバーのビュー切り替えUIをどうするか？ → **左端の縦アイコンナビ**に決定
  - 関連: [ui/screens-macos.md](../ui/screens-macos.md), [ui/navigation.md](../ui/navigation.md)
- [x] サイドバーの幅は固定か、ユーザーが変更できるか？ → **ユーザーがドラッグで変更できる**に決定
  - 関連: [ui/screens-macos.md](../ui/screens-macos.md)
- [x] サイドバーを閉じた状態で検索・Git・設定を開いた場合の挙動をどうするか？ → **サイドバーを自動で開いて対象ビューを表示**に決定
  - 関連: [ui/navigation.md](../ui/navigation.md)
- [x] 右パネルはアウトラインとリンクを同時表示できるか、どちらか一方か？ → **アウトライン / リンクのどちらか一方だけ表示**に決定
  - 関連: [ui/screens-macos.md](../ui/screens-macos.md), [ui/navigation.md](../ui/navigation.md)
- [x] タブを閉じた後に「直前に表示していたタブ」をどう記録するか？ → **表示履歴ベース**に決定
  - 関連: [ui/navigation.md](../ui/navigation.md)
- [x] タブが0枚のときの空状態に何を表示するか？ → **新規ノート作成画面**に決定
  - 関連: [ui/navigation.md](../ui/navigation.md)
- [x] 分割表示中のタブ管理はペインごとか、全体共通か？ → **ペインごとにタブ管理**に決定
  - 関連: [ui/navigation.md](../ui/navigation.md)
- [x] 初回起動時に「新規ワークスペース作成」で作るフォルダの保存先をどうするか？ → **毎回ユーザーが保存場所を選ぶ**に決定
  - 関連: [ui/screens-macos.md](../ui/screens-macos.md), [spec/file-management.md](../spec/file-management.md)
- [x] コマンドパレット・クイックスイッチャーのUI仕様をどこに書くか？ → **[spec/command-palette.md](../spec/command-palette.md) を新規作成**に決定
  - 関連: [PLAN.md](../PLAN.md), [spec/command-palette.md](../spec/command-palette.md)

---

## P2：初回リリース前までに決めればよい問い

### ファイル加工ツール

- [x] ファイル加工ツールは初期リリースに含めるか、リリース後アップデートに回すか？ → **初期リリースに含める** に決定
  - 関連: [spec/file-tools.md](../spec/file-tools.md)
- [x] 条件指定マージの出力ファイルが既に存在する場合、上書き禁止で別名保存にするか？ → **上書き禁止で別名保存** に決定
  - 関連: [spec/file-tools.md](../spec/file-tools.md)
- [x] 見出しで分割するとき、ファイル名に使えない文字をどう変換するか？ → **全角・似た文字に置き換える** に決定
  - 関連: [spec/file-tools.md](../spec/file-tools.md)
- [x] 目次生成で既存の目次ファイルを更新する機能を持つか？ → **既存ファイルは自動更新せず、同名ファイルがある場合は別名で新規作成** に決定
  - 関連: [spec/file-tools.md](../spec/file-tools.md)

### 設定・機能トグル

- [x] どの機能をオン/オフ可能にするか？ → **主要な追加機能のみ**（GitHub連携 / ファイル加工ツール / フロントマター / 右パネル / フォーカスモード・タイプライターモード）に決定
  - 関連: [PLAN.md](../PLAN.md), [ui/screens-macos.md](../ui/screens-macos.md)
- [x] 機能トグルは料金モデルとは切り離して、単なるUI簡略化機能として扱うか？ → **料金モデルとは結びつけない**。現時点では料金モデル自体を設計対象外にする
  - 関連: [PLAN.md](../PLAN.md), [STATUS.md](../STATUS.md)
- [x] 設定値をワークスペースごとに持つか、アプリ全体で共通にするか？ → **基本はアプリ全体で共通、一部だけワークスペースごと** に決定
  - 関連: [architecture/data-model.md](../architecture/data-model.md), [ui/screens-macos.md](../ui/screens-macos.md)
- [x] アクセントカラーは完全自由指定か、プリセットから選ぶ方式か？ → **アクセントカラー設定は作らず、Relic側で統一されたデザインのみ** に決定
  - 関連: [spec/navigation.md](../spec/navigation.md), [ui/DESIGN.md](../ui/DESIGN.md)

### リリース・配布

- [x] コード署名をいつ導入するか？ → **第三者に配る段階で導入** に決定
  - 関連: [PLAN.md](../PLAN.md), [architecture/decisions.md](../architecture/decisions.md), [tech/stack.md](../tech/stack.md)
- [x] Mac App Store配布を将来検討する条件は何か？ → **一般ユーザー向けに継続提供する価値が見えたら検討** に決定
  - 関連: [architecture/decisions.md](../architecture/decisions.md)
- [x] アプリの自動アップデート機能を持つか？ → **第三者に配る段階で導入を検討** に決定
  - 関連: [architecture/decisions.md](../architecture/decisions.md)
- [x] 最初の配布対象は自分用ビルドか、第三者が使える配布物か？ → **まず自分用ビルド** に決定
  - 関連: [PLAN.md](../PLAN.md), [principles.md](../principles.md)

### 料金・プロダクト方針

- [x] 料金モデルをどう扱うか？ → **現時点では料金モデルを設計対象外** に決定。まず自分用に作って使い、良ければ収益化を検討する
  - 関連: [PLAN.md](../PLAN.md), [STATUS.md](../STATUS.md), [journal/2026-05-01.md](../journal/2026-05-01.md)
- [x] アプリ名を何にするか？ → **Relic** に決定
  - 関連: [journal/2026-05-01.md](../journal/2026-05-01.md)
- [x] 想定ユーザーを「自分用」から「一般公開」へ広げるタイミングをどう決めるか？ → **自分で継続利用して、価値と不満点が見えた後** に決定
  - 関連: [principles.md](../principles.md), [PLAN.md](../PLAN.md)

---

## P3：将来検討でよい問い

- [x] iOS版を別アプリとして検討する条件は何か？ → **macOS版を自分で継続利用し、外出先・モバイルで使いたい場面が明確になったら検討** に決定
  - 関連: [PLAN.md](../PLAN.md), [architecture/decisions.md](../architecture/decisions.md)
- [x] プラグインなし方針は将来も固定するか？ → **将来も原則なし** に決定
  - 関連: [PLAN.md](../PLAN.md), [architecture/decisions.md](../architecture/decisions.md)
- [x] 画像非対応方針は将来も固定するか？ → **Markdown内の添付画像だけサポート** に変更。ライブプレビューでは画像として表示するが、画像管理アプリにはしない
  - 関連: [PLAN.md](../PLAN.md), [architecture/decisions.md](../architecture/decisions.md)
- [x] AI機能を将来的に入れるか？ → **現時点では入れない。必要性が見えたら再検討** に決定
  - 関連: なし
