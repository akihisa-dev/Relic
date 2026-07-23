---
name: relic-change-attachments
description: Relicのワークスペース内の画像・PDF添付について、対応形式の認識、ファイルツリー列挙、外部画像の取込、Markdown画像記法とエディタへのドロップ、安全な読込、data URL生成、画像・PDFタブ表示を一貫して追加・修正する。画像またはPDF添付の取込・表示・安全性・不具合に使う。カードの対象抽出・選択・伸縮表示はrelic-change-card-view、通常のファイル操作はrelic-change-workspace-files、CodeMirrorはrelic-change-markdown-editor、HTML・PDF・SVG出力はrelic-change-markdown-output、タブ遷移はrelic-change-navigation、添付ノードはrelic-change-graphを優先または併用する。
---

# Relic Attachment Change

## 対象と処理経路を確定する

1. 調査、説明、レビューだけの依頼では編集せず、追加、変更、修正が明示された場合だけ実装する。
2. `git status --short` を確認し、画像認識、外部取込、Markdown挿入、main読込、画像タブ、PDFタブのどこを変えるか限定する。
3. `docs/features/markdown.md`、`docs/engineering/data-model.md`、`docs/engineering/file-access-boundaries.md` を読む。
4. ファイルツリーとタブへ触れる場合は `docs/features/navigation.md`、IPCへ触れる場合は `docs/engineering/architecture.md` も読む。
5. Markdown画像記法を正本、画像・PDFをユーザー管理の添付ファイル、data URLと表示状態を再生成可能な派生データとして扱う。

## 添付の範囲を守る

1. 対応画像拡張子とPDF判定をsharedの一つの境界へ集約し、ツリー、drop、取込、読込、グラフで異なる判定を複製しない。
2. 拡張子の大文字小文字、バックスラッシュとスラッシュの区切り、ドットを含む名前を同じ規則で扱う。
3. 画像とPDFをMarkdown全文検索、タグ付け、別名候補、本文抽出、編集、注釈、アルバム管理の対象へ広げない。
4. 専用の添付フォルダを自動作成せず、ユーザーが選んだワークスペース構成を正とする。
5. Markdownプレビューではワークスペース内の相対画像だけを実画像にし、外部URLを取得せず、外部参照や非対応形式をプレースホルダーへ倒す。
6. PDF添付の閲覧と、Markdownから新しいPDFを生成する出力機能を混同しない。

## 画像を安全に取り込んで挿入する

1. OSから受け取る画像source pathは外部読込元としてだけ許可し、空、NUL、非ファイル、非対応形式をコピー前に拒否する。
2. 取込先folderと生成先をワークスペース相対パスとして検証し、既存親の実体と書込直前の境界を確認する。
3. ワークスペース内にあるsourceは再コピーせず安全な既存相対パスを返し、外部sourceは元ファイルを変更しない。
4. 既存ファイルを上書きせず、衝突時は現行の一意名生成と排他的コピーを使う。
5. エディタdropでは対応画像だけを抽出し、対象Markdownと同じフォルダを既定の取込先にする。成功した画像だけから安全なaltとワークスペース相対パスを持つ画像記法を作る。
6. 画像記法の挿入はCodeMirror transactionを使い、drop位置、改行、選択、focus、Undo・Redo、`onChange`、自動保存を迂回しない。
7. 複数画像の一部が失敗した場合は現行の部分成功契約を明示し、成功済みコピーや本文を不整合な推測で巻き戻さない。

## 画像とPDFを安全に読み込む

1. RendererとIPCから受けるpathを未検証として扱い、絶対パス、`..`、NUL、未正規化パス、外部symlinkを拒否する。
2. 対応形式、通常ファイルであること、ワークスペース内の実体を確認し、実読込の直前にも境界を再検証する。
3. 画像は拡張子に対応する既存MIME、PDFは `application/pdf` を使い、読み込んだbyteから表示用data URLを生成する。
4. 任意のローカルURLや外部URLをRendererへ渡さず、エラー詳細から不要な絶対パスと秘密情報らしい値を除く。
5. 読込中にタブpathまたはワークスペースが変わった場合、古い応答を現在の画像・PDFタブへ反映しない。
6. loading、成功、失敗、再読込をpath単位で分け、前の添付のdata URLやエラーを次のタブへ残さない。

## 表示と隣接責務を整合させる

1. 画像・PDFタブのpath、重複防止、左右ペイン共有、close、ファイル操作後の追従は `$relic-change-navigation` と `$relic-change-workspace-files` に委ねる。
2. 画像タブは内容を縦横比どおり閲覧する範囲に保ち、画像編集や管理機能へ拡大しない。
3. PDFタブはワークスペース内data URLの閲覧に限定し、frame用CSP、sandbox、遷移禁止を緩めない。
4. Markdown内画像のレンダリングとHTML安全化を変える場合は `$relic-change-markdown-output`、CodeMirror一般契約を変える場合は `$relic-change-markdown-editor` を併用する。
5. shared IPC型、preload、main handler、clientを変える場合は `$relic-change-electron-boundaries` の契約検証を追加する。
6. 添付画像のリンク解析・グラフノード化を変える場合、形式と安全なpathは本Skill、リンク構文は `$relic-change-links-index`、派生グラフは `$relic-change-graph` が所有する。

## 検証する

1. shared形式判定で全対応拡張子、大文字小文字、非対応形式、区切り文字を確認する。
2. 画像取込で外部source、ワークスペース内source、同名、非ファイル、外部symlink、危険なdestination、元ファイル保持を確認する。
3. 読込で画像MIME、PDF MIME、data URL、traversal、読込直前の差替え、非ファイル、読込失敗、副作用なしを確認する。
4. editor dropで複数画像、drop位置、改行、非対応file、部分失敗、transaction後の本文と選択を確認する。
5. ファイルツリー、画像・PDFタブ、loading、error、重複タブ、左右ペイン、ワークスペース切替を影響に応じて確認する。
6. `app/` で対象のnode・rendererテスト、`pnpm typecheck`、必要なら `pnpm architecture:check` または `pnpm verify` を実行する。
7. 表示やdrop操作を変え、かつユーザーが実画面確認を明示的に指示した場合だけ、その作業で起動した一時データの開発版を使い、対応形式、テーマ、失敗表示、再操作を確認する。
8. ユーザーから見える仕様を変えた場合はMarkdown、navigation、data-model、file-accessの該当正本へ同期し、`git diff --check` と全差分を確認する。

## 完了する

変更した添付形式、取込・読込境界、Markdown挿入、表示状態、更新した正本、対象テスト、実画面確認、未確認項目を報告する。コミット時は `$relic-commit` に従う。
