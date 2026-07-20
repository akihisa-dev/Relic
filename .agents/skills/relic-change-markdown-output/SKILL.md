---
name: relic-change-markdown-output
description: RelicのMarkdownプレビューHTML、ページプレビュー用HTML、Mermaid・D2描画とSVG安全化、現在ファイルのPDF出力、図表のSVG保存・コピーを、外部リソース、CSP、IPC入力、保存先、安全書き込みの条件を保って変更する。Markdown renderer、sanitize、出力HTML・CSS、PDF・SVG、出力ファイル名、出力用Electronウィンドウの依頼に使う。CodeMirror内の図表編集・ページプレビュー操作・見出し折りたたみはrelic-change-markdown-editor、添付PDF閲覧・画像／PDFタブ・添付読込はrelic-change-attachments、YAML編集はrelic-change-frontmatter、見た目だけはrelic-change-ui、依存更新はrelic-update-dependenciesを優先する。
---

# Relic Markdown Output Change

## 境界を決める

1. 調査、説明、レビューだけの依頼では編集しない。変更が明示された場合だけ実装する。
2. 通常プレビュー、ページプレビュー、ライブプレビュー、PDF出力、Mermaid・D2のSVG保存・コピーのどの経路を変えるかを分ける。
3. 出力をMarkdownから生成する派生物とし、レンダリング結果やSVGをMarkdown正本へ書き戻さない。
4. 添付PDFの閲覧、画像・PDF添付の読込やタブ表示、ファイル加工ツールの出力を、現在ファイルのPDF・SVG出力へ混在させない。これらはそれぞれ `$relic-change-attachments`、`$relic-change-tools` に委ねる。

## 正本と安全境界を確認する

1. `docs/features/editor.md`、`docs/features/markdown.md`、`docs/engineering/architecture.md` を読む。
2. 保存先へ触れる場合は `docs/engineering/file-access-boundaries.md` も読む。
3. rendererのMarkdown生成・安全化・図表描画と、mainのIPC検証・出力ウィンドウ・保存を追跡する。
4. `git status --short` と対象テストを確認し、安全化前後の危険入力fixtureと正常fixtureを受入条件にする。

## 実装する

1. Markdownソースを既存のpreview rendererへ通し、安全化済みHTMLだけをDOMと出力へ渡す。
2. ユーザー由来HTMLを未処理のままDOM、PDFウィンドウ、クリップボード、保存ファイルへ渡さない。
3. 許可タグ、属性、URIを最小限に保ち、イベント属性、危険なURL、script、不要な埋め込み要素を復活させない。
4. 出力HTMLにはレンダリング済み本文だけを含め、アプリUI、編集コントロール、外部script・外部resourceへの依存を含めない。
5. 出力用CSPを維持し、PDF用ウィンドウでscript実行を有効にしない。
6. MermaidとD2は遅延読み込みし、Mermaidのstrict設定とD2の既存直列キューを維持する。図表全体は有限並列で描画し、SVGを再度安全化してsource属性やpan・zoomの一時状態を除く。
7. SVG保存・コピーでもmain側で再安全化し、描画可能なSVGが残らない場合は失敗として扱う。
8. IPC入力の型、UTF-8サイズ上限、安全なHTML構造、PDFオプションをmain境界で再検証する。
9. 出力ウィンドウのsandbox、Node無効、新規ウィンドウ禁止、遷移禁止、権限拒否、確実な破棄を維持する。
10. 保存ダイアログの取消時は生成・書き込みを行わず、保存時は安全な名前、拡張子、安全書き込みを使う。
11. エラー詳細を安全化して返し、秘密情報や不要なローカル絶対パスをRendererへ露出しない。
12. ページプレビューの本文は通常プレビューと同じrenderer・sanitizerを再利用し、リンク先Markdownや埋め込み内容を未処理HTMLとしてオーバーレイへ渡さない。表示開始・終了などのEditor操作状態は `$relic-change-markdown-editor` に委ねる。

## 検証する

1. Markdown rendererとHTML sanitizerで標準記法、拡張記法、危険URL、HTML、画像、Mermaid・D2を確認し、同じ危険fixtureを通常プレビュー、ページプレビュー、出力HTMLの影響経路へ適用する。
2. 出力HTMLでタイトル優先順、ファイル名安全化、CSP、UI除外、図表変換、有限並列を確認する。
3. output handlerとSVG sanitizerで不正入力、サイズ上限、取消、安全保存、window制限、エラー秘匿を確認する。
4. IPC契約を変えた場合はshared型、preload、client、handler登録と契約テストを同じ作業で更新する。
5. Markdown parser・sanitizerの仕様分岐、ファイル出力、IPC入力検証を追加・変更した場合は対象テストまたは回帰テストを追加し、`app/` で `pnpm verify` を実行する。その他の変更でも対象node・rendererテストと `pnpm typecheck` を実行し、影響が広い場合は `pnpm verify` を実行する。
6. 出力結果の見た目、改ページ、出力ウィンドウ、CSP、PDFオプション、HTML読込経路を変え、かつユーザーが実画面確認を明示的に指示した場合だけ、一時データを使う開発版から実PDFを確認する。
7. `git diff --check` と生成HTML・SVG差分を確認し、script、外部依存、編集UI、機密情報がないことを確かめる。

## 完了する

変更した出力経路、安全化層、IPC・保存境界、更新した正本、危険入力fixture、正常出力、未確認項目を報告する。
