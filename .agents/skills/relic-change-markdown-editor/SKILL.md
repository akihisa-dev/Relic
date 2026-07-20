---
name: relic-change-markdown-editor
description: RelicのMarkdownエディタについて、CodeMirror拡張、ライブプレビューとソースモード、Mermaid・D2図表、ページプレビュー、見出し折りたたみ、書式・リスト・表、選択範囲、IME、Undo・Redo、自動保存への接続を安全に変更する。本文編集、Markdown記法の挿入・書き戻し、モード切替、エディタ操作の不具合や機能追加に使う。YAML往復はrelic-change-frontmatter、HTML・PDF・SVGの描画・安全化・出力はrelic-change-markdown-output、画像drop・添付取込・画像／PDFタブはrelic-change-attachments、内部リンクの解決規則はrelic-change-links-index、見た目だけはrelic-change-ui、Issue起点はrelic-issue、コミットだけはrelic-commitを優先する。
---

# Relic Markdown Editor Change

## 境界を決める

1. 調査、説明、レビューだけの依頼では編集しない。変更が明示された場合だけ実装する。
2. Issue番号またはURLが入口なら `$relic-issue`、検証済み差分のコミットだけなら `$relic-commit` を優先する。
3. Markdownファイル全体の `content` を正本とし、本文、フロントマター、記法を別の不可視形式へ変換しない。
4. 編集動作、ライブプレビュー、ページプレビュー、見出し折りたたみ、保存、表示だけのどこへ影響するかを分ける。
5. Mermaid・D2のCodeMirror内検出、ソース編集への切替、図Widgetの操作は本Skillで扱う。共通renderer、SVG安全化、PDF・SVG出力は `$relic-change-markdown-output`、画像dropからの取込・画像記法挿入と画像／PDFタブは `$relic-change-attachments` に委ねる。

## 正本と実装を確認する

1. `docs/features/editor.md`、`docs/features/markdown.md`、`docs/engineering/editor-engine.md` を読む。
2. 保存へ触れる場合は `docs/engineering/architecture.md` と自動保存の関連実装も確認する。
3. `git status --short` と対象のEditor、CodeMirror拡張、model、テストを確認し、無関係な差分を保護する。
4. 選択範囲、履歴、フォーカス、スクロール、IME、保存待ち、外部変更衝突から、変更に関係する受入条件を定める。

## 実装する

1. 本文変更をCodeMirror transactionへ集約し、DOM表示だけを書き換えてMarkdown正本と乖離させない。
2. 設定やモードの切替では既存のreconfigure境界を使い、`EditorView` を不要に破棄・再生成しない。
3. ソースとライブプレビューの切替後も、本文、選択範囲、Undo・Redo履歴、フォーカス、スクロール位置を維持する。
4. ライブプレビューの検出では構文木と可視範囲を優先し、通常入力のたびに全文走査する実装へ戻さない。
5. ブロック置換Decorationは既存のStateField境界を保ち、表、通常コードブロック、Mermaid・D2図表の編集状態を混同しない。図の操作中は表示を維持し、「ソースを編集」の明示操作だけで対象コードブロックをソース表示へ戻す。
6. 書式適用、キー操作、右クリック操作では選択なし、複数行、IME変換中、日本語入力を明示的に扱う。
7. `onChange`、タブ内容、自動保存キューを迂回せず、1秒保存、期待本文照合、衝突時停止を壊さない。
8. 大きいMarkdownのソースfallbackを通常設定へ保存せず、ライブプレビュー処理を誤って有効にしない。
9. parse、選択計算、表操作などの純粋処理をmodelへ置き、ReactやCodeMirrorの状態処理と分ける。
10. ページプレビューは内部リンクのhoverを入口に、既存のリンク解決規則と安全化済みpreview rendererを使う。表示の遅延、未作成表示、scroll・キー入力・リンク外への移動による終了を管理し、リンク先を開いたり本文を書き換えたりしない。大きいMarkdownのsource fallbackでは起動しない。
11. 見出し折りたたみは同階層以上の次見出しまでを範囲とし、ライブプレビューとソースモードの両方で使える一時的なeditor状態に保つ。折りたたみ状態をMarkdownや設定へ保存せず、内容変更後は有効な見出し範囲へ再照合する。

## 検証する

1. 操作変更には書式、選択、shortcut、live preview、table、Mermaid・D2のソース／表示切替から該当する回帰テストを追加する。
2. モードや拡張変更ではEditorView identity、選択、履歴、スクロールの維持を確認する。
3. 保存接続へ触れた場合は待機、連続入力、失敗、衝突、close前flushを確認する。
4. 未完了コードフェンス、空行、巨大行、複数選択、IME、Undo・Redoを影響に応じて確認する。ページプレビューでは解決成功・未作成・曖昧・危険な参照・終了操作・source fallback、見出し折りたたみでは階層境界・モード切替・本文不変・開き直し時のリセットを確認する。
5. Markdown parser、仕様分岐、本文書き換えを追加・変更した場合は対象テストまたは回帰テストを追加し、`app/` で `pnpm verify` を実行する。その他の変更でも対象rendererテストと `pnpm typecheck` を実行し、影響が広い場合は `pnpm verify` を実行する。
6. ユーザーが実画面確認を明示的に指示した場合だけ、自動テストで判断できない入力感やモード遷移を、その作業中に起動した一時データの開発版で確認する。
7. ユーザーから見える動作を変えた場合は `docs/features/editor.md` と必要なMarkdown正本を同期する。
8. `git diff --check` と全差分を確認し、本文変換、保存契約、他製品名、ローカル絶対パスの混入がないことを確かめる。

## 完了する

変更した編集状態、維持した契約、更新した正本、対象テスト、実画面確認、未確認項目を分けて報告する。
