# ファイルアクセス境界

Relicは、ユーザーが選んだローカルフォルダだけをワークスペースとして扱う。
ファイル操作では、レンダラーやIPCから渡されたパス文字列をそのまま信用しない。

## 基本方針

- IPC入力では、絶対パス、`..`、NUL文字、未正規化パスを拒否する。
- 既存ファイルや既存フォルダは `resolveExistingWorkspacePath(...)` で実体パスを確認する。
- 新規作成先は `resolveNewWorkspacePath(...)` または `verifyNewWorkspacePath(...)` で、最も近い既存親の実体パスを確認する。
- 書き込み、移動、リネーム、削除境界の直前では、対象がまだワークスペース内か再確認する。
- 外部Markdownインポートでは、読み取り元は外部パスを許可するが、書き込み先は必ずワークスペース内に限定する。
- ツール出力は出力名を `safeOutputName(...)` で単一ファイル名に限定し、出力先を `resolveNewWorkspacePath(...)` で確認する。

## Rendererへ渡るローカルパス

アクティブワークスペースや登録済みワークスペースの表示、PDF出力などに必要なため、Rendererにはワークスペースのローカル絶対パスが渡る。ただしMarkdownプレビュー画像は絶対パスから `file://` URLを組み立てず、相対パスを `readImageFile` IPCへ渡してMain側の実体パス検証後にdata URLを受け取る。
これはワークスペースを選んだユーザーの端末内で使う情報であり、任意のファイル操作権限として扱ってはならない。

画面表示では、必要がない限りワークスペース名やワークスペース相対パスを優先する。
エラー詳細をRendererへ返す場合は `redactSensitiveText(...)` を通し、ローカル絶対パスや認証情報らしい文字列を伏せる。
ワークスペース変更通知では、絶対パスを送らず `workspaceId` と変更時刻だけを送る。

## 操作別の境界

| 操作 | 主な実装 | 境界確認 |
|------|----------|----------|
| Markdown読み込み | `app/src/main/files/markdownFiles.ts` | `resolveExistingWorkspacePath(...)` と読み込み直前の `verifyExistingWorkspacePath(...)` |
| Markdown書き込み | `app/src/main/files/markdownFiles.ts` | `resolveExistingWorkspacePath(...)` と保存直前の `verifyExistingWorkspacePath(...)` |
| Markdown新規作成 | `app/src/main/files/markdownFiles.ts` | `resolveNewWorkspacePath(...)` と作成直前の `verifyNewWorkspacePath(...)` |
| Markdownリネーム・移動 | `app/src/main/files/markdownFiles.ts` | sourceは `verifyExistingWorkspacePath(...)`、destinationは `verifyNewWorkspacePath(...)` |
| Markdown複製 | `app/src/main/files/markdownFiles.ts` | sourceは `verifyExistingWorkspacePath(...)`、destinationは `verifyNewWorkspacePath(...)` |
| Markdownインポート | `app/src/main/files/markdownFiles.ts` | sourceは読み取りのみ、destinationは `resolveNewWorkspacePath(...)` と `verifyNewWorkspacePath(...)` |
| フォルダ作成 | `app/src/main/files/folders.ts` | parentは `resolveExistingWorkspacePathOrRoot(...)`、作成先は `verifyNewWorkspacePath(...)` |
| フォルダリネーム・移動 | `app/src/main/files/folders.ts` | sourceは `verifyExistingWorkspacePath(...)`、destinationは `verifyNewWorkspacePath(...)` |
| ゴミ箱移動 | `app/src/main/files/trash.ts` | `resolveExistingWorkspacePath(...)` 後に型を確認し、外部実体は拒否 |
| 単一ファイル置換 | `app/src/main/files/replace.ts` | `resolveExistingWorkspacePath(...)` と書き込み直前の `verifyExistingWorkspacePath(...)` |
| 一括置換 | `app/src/main/files/replace.ts` | 対象収集時の `resolveExistingWorkspacePath(...)` と各書き込み直前の `verifyExistingWorkspacePath(...)` |
| タイトル一覧・目次・タグ索引・マージ | `app/src/main/ipc/toolActions.ts` | 入力フォルダは `resolveExistingWorkspacePathOrRoot(...)`、出力は `writeToolMarkdownOutput(...)` |
| ツール出力 | `app/src/main/ipc/toolOutputFiles.ts` | `safeOutputName(...)` と `resolveNewWorkspacePath(...)` |
| PDF/SVG保存 | `app/src/main/ipc/outputHandlers.ts` | OSの保存ダイアログで選ばれたユーザー指定先へ保存する。ワークスペース内限定のファイル操作とは別境界として扱う |

## テスト方針

- `../outside.md`、絶対パス、Windows風絶対パス、NUL文字を入力検証で拒否する。
- ワークスペース内のシンボリックリンクが外部を指す場合、読み込み、書き込み、移動、リネーム、削除、置換の対象にしない。
- 新規作成やツール出力では、親ディレクトリの実体がワークスペース外を指す場合に拒否する。
- 外部インポートは元ファイルを変更せず、コピー先だけをワークスペース内に作る。
- 失敗時はファイル操作に進まず、外部ファイルが作成、変更、削除されていないことを確認する。
