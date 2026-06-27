# refactor-notes

2026-05-31の全リファクタリング作業で実施した肥大ファイル調査、分割結果、検証結果を記録する。

## 2026-05-31 20:23 JST

### 肥大ファイル調査結果

`app/src` 配下の `ts` / `tsx` を対象に行数を確認した。変更前は、実装ファイルでは `app/src/main/ai/aiWorkspaceService.ts` が1000行を超えており、`app/src/renderer/App.tsx` も700行を超えていた。テストでは `App.test.tsx` と `Editor.test.tsx` が特に大きかった。

### 変更前の行数上位ファイル

| 行数 | ファイル |
|------|----------|
| 4327 | `app/src/renderer/App.test.tsx` |
| 2588 | `app/src/renderer/components/Editor.test.tsx` |
| 1298 | `app/src/main/ai/aiWorkspaceService.ts` |
| 984 | `app/src/renderer/App.tsx` |
| 899 | `app/src/main/ai/aiWorkspaceService.test.ts` |
| 873 | `app/src/renderer/diagramPreview.test.ts` |
| 564 | `app/src/main/files/charts.test.ts` |
| 561 | `app/src/main/ai/codexAppServerClient.ts` |
| 497 | `app/src/renderer/chronicleTimelineAxis.ts` |
| 495 | `app/src/renderer/components/Editor.tsx` |

### 変更後の行数上位ファイル

| 行数 | ファイル |
|------|----------|
| 4299 | `app/src/renderer/App.test.tsx` |
| 2107 | `app/src/renderer/components/Editor.test.tsx` |
| 685 | `app/src/renderer/App.tsx` |
| 628 | `app/src/main/ai/aiWorkspaceService.test.ts` |
| 564 | `app/src/main/files/charts.test.ts` |
| 561 | `app/src/main/ai/codexAppServerClient.ts` |
| 534 | `app/src/renderer/appLayoutProps.ts` |
| 497 | `app/src/renderer/chronicleTimelineAxis.ts` |
| 495 | `app/src/renderer/components/Editor.tsx` |
| 492 | `app/src/renderer/diagramPreview.test.ts` |

### 実際に分割したファイル

- `app/src/main/ai/aiWorkspaceService.ts`: 1298行から489行へ削減し、Coworkの接続役に寄せた。
- `app/src/renderer/App.tsx`: 984行から685行へ削減し、終了前保存、外部変更反映、出力、レイアウト幅、AI操作ハンドラ、レイアウト描画、画面props組み立てを分離した。
- `app/src/renderer/App.test.tsx`: 共通レンダリングと環境操作を `appTestHelpers.tsx` へ分離した。
- `app/src/renderer/components/Editor.test.tsx`: 2588行から2107行へ削減し、ライブプレビュー・図Widget・通常コードブロック・チェックボックス系テストを別ファイルへ分離し、フロントマター展開などの共通ヘルパーも `editorTestHelpers.ts` へ分離した。
- `app/src/main/ai/aiWorkspaceService.test.ts`: 899行から628行へ削減し、preview系テストを別ファイルへ分離し、共通セットアップをhelper化した。
- `app/src/renderer/diagramPreview.test.ts`: 873行から492行へ削減し、pan/zoom系テストを別ファイルへ分離し、共通モックとDOMヘルパーをhelper化した。

### 新規作成した hooks

- `app/src/renderer/hooks/useAppCloseGuards.ts`
- `app/src/renderer/hooks/useWorkspaceExternalRefresh.ts`
- `app/src/renderer/hooks/useWindowCloseRequest.ts`
- `app/src/renderer/hooks/useAppPreviewOutputActions.ts`
- `app/src/renderer/hooks/useAppLayoutWidths.ts`
- `app/src/renderer/hooks/useAppWorkspaceCollections.ts`
- `app/src/renderer/hooks/useAIWorkspaceEditorActions.ts`
- `app/src/renderer/hooks/useAppRailSidebarSelection.ts`
- `app/src/renderer/hooks/useAppInlineHandlers.ts`

### 新規作成した components

- `app/src/renderer/components/AppLayout.tsx`

### 新規作成した lib modules

- `app/src/main/ai/aiWorkspaceChatModel.ts`
- `app/src/main/ai/aiWorkspaceReferences.ts`
- `app/src/main/ai/aiWorkspaceOperations.ts`
- `app/src/main/ai/aiWorkspaceMessages.ts`
- `app/src/main/ai/aiWorkspaceStateMapper.ts`
- `app/src/main/ai/aiWorkspaceAbort.ts`
- `app/src/main/ai/aiWorkspaceText.ts`
- `app/src/renderer/appLayoutProps.ts`
- `app/src/renderer/diagramPreviewTestHelpers.ts`
- `app/src/renderer/appTestHelpers.tsx`
- `app/src/renderer/components/editorTestHelpers.ts`

### 新規作成した shared modules

- なし。今回の分割は既存の `shared` 型を利用し、main / renderer をまたぐ新しい公開型は追加しなかった。

### 分離した責務

- Coworkチャットのタイトル生成、ID生成、履歴追加、チャットupsert
- Cowork参照ファイルの選定、現在ファイル優先、巨大アクティブ本文の除外
- Cowork変更案のパス検証、Markdown限定、ワークスペース外拒否、dirtyブロック、stale判定用hash
- CoworkのAI失敗メッセージ、適用結果メッセージ、採用しなかった変更の表示
- Cowork状態のUI向け変換
- Appの終了前保存ガード、ワークスペース外部変更反映、ウィンドウ終了IPC、印刷/PDF出力
- Appのサイドバー幅、レール選択、AIワークスペース操作ハンドラ、Markdownパス集合
- Appのレイアウト描画と、AppLayoutへ渡すprops組み立て

### 削除・統合した重複

- `aiWorkspaceService.ts` 内に残っていた未使用の自然文pending操作・巻き戻し系ヘルパーを削除した。現行実装では該当自然文は通常のAI会話として扱うことを既存テストで確認済み。
- `App.tsx` 内で個別に組み立てていたdirty Markdown path、既存Markdown path、登録ワークスペース、ピン留め、開きファイル集合を `useAppWorkspaceCollections` に集約した。
- App / Editor テストの共通ヘルパーを各テスト本体から分離した。

### 削減した as any / @ts-ignore / eslint-disable

- `aiWorkspaceService.ts` 内の `react-doctor/js-set-map-lookups` 除外コメントを、未使用旧ヘルパーの削除に伴って1件削減した。
- `as any` と `@ts-ignore` は変更前調査で対象範囲内に見つからなかったため、削減対象なし。

### 追加・更新したテスト

- 追加: `app/src/main/ai/aiWorkspaceChatModel.test.ts`
- 追加: `app/src/main/ai/aiWorkspaceOperations.test.ts`
- 追加: `app/src/main/ai/aiWorkspaceReferences.test.ts`
- 追加: `app/src/main/ai/aiWorkspaceMessages.test.ts`
- 追加: `app/src/main/ai/aiWorkspaceService.preview.test.ts`
- 追加: `app/src/main/ai/aiWorkspaceServiceTestHelpers.ts`
- 追加: `app/src/renderer/diagramPreview.panZoom.test.ts`
- 追加: `app/src/renderer/diagramPreviewTestHelpers.ts`
- 追加: `app/src/renderer/components/Editor.livePreview.test.tsx`
- 更新: `app/src/main/ai/aiWorkspaceService.test.ts` は既存の統合動作確認として維持。
- 更新: `app/src/renderer/App.test.tsx`
- 更新: `app/src/renderer/components/Editor.test.tsx`
- 更新: `app/src/renderer/diagramPreview.test.ts`

### 更新した仕様書

- なし。外部仕様、保存形式、UI文言、操作導線は変更していない。

### 更新した docs

- `docs/development/refactor-notes.md`
- `docs/development/coding-rules.md`
- `docs/engineering/architecture.md`

### 実装を正として修正した仕様書・docs の不一致

- 添付テキストでは `docs/dev/refactor-notes.md` と `docs/dev/doc-code-alignment.md` が指定されていたが、現行リポジトリの正しい開発文書配置は `docs/development/` であり、`docs/dev/` と `doc-code-alignment.md` は存在しない。現行の開発文書配置に合わせて、`docs/development/refactor-notes.md` を作成した。
- `docs/engineering/architecture.md` のCowork Service説明は大枠として正しかったが、実装分割後の責務境界を追記した。

### 分割しきれなかったファイル

- `app/src/renderer/App.test.tsx`
- `app/src/renderer/components/Editor.test.tsx`

### 分割しきれなかった理由

- `App.test.tsx` と `Editor.test.tsx` は広いUI統合テストを含み、単純な機械分割ではテストの前提共有やモック順序を壊しやすい。今回は共通ヘルパーとライブプレビュー系テストを先に外へ出し、機能別テストファイルへ分ける準備を優先した。
- `App.tsx` は700行未満まで削減し、タイトルバー・サイドバー・エディタワークスペースへのprops組み立てを `appLayoutProps.ts` へ分離した。`appLayoutProps.ts` は新しい接続境界として500行台になったため、次に分けるなら title bar / sidebar / editor workspace のprops組み立て単位で分割する。
- `aiWorkspaceService.test.ts` は700行未満まで削減し、preview系テストを別ファイルへ移した。送信系の統合テストは同じ外部AIモックと一時ワークスペース前提を共有するため、今回は残した。
- `diagramPreview.test.ts` は700行未満まで削減し、pan/zoom系テストを別ファイルへ移した。レンダリング、SVG出力、D2直列化、CSP確認は同じレンダリングモック前提のまとまりとして残した。

### 今後の肥大化防止ルール

- 1000行超の `ts` / `tsx` は原則分割対象にする。
- 700行超の `ts` / `tsx` は分割候補として調査対象にする。
- UIコンポーネントに pure function を溜めない。
- `sort` / `filter` / `validate` / `normalize` / `parse` / `serialize` は `lib` または責務名が分かるmodelへ寄せる。
- 共通型・共通定数は `shared` / `types` / `constants` に寄せる。
- IPC channel / payload / response は境界定義に寄せる。
- docs と実装がずれた場合は、現行実装を正としてdocsを更新する。
- 新機能追加時は肥大ファイルに直接積み増さず、hook / component / lib を先に作る。

### 検証結果

- `pnpm typecheck`: 成功。
- `pnpm exec vitest run src/main/ai/aiWorkspaceChatModel.test.ts src/main/ai/aiWorkspaceOperations.test.ts src/main/ai/aiWorkspaceReferences.test.ts src/main/ai/aiWorkspaceMessages.test.ts src/main/ai/aiWorkspaceService.test.ts`: 成功。
- `pnpm exec vitest run src/renderer/App.test.tsx src/renderer/components/Editor.test.tsx`: 成功。Mermaidのjsdom由来の `getComputedTextLength is not a function` stderr は既存と同様にフォールバックされ、テスト自体は成功。
- `pnpm verify:full`: 成功。`pnpm verify` と `git -C .. diff --check` が通過し、100 test files / 885 tests が成功。
- `App.tsx` 追加分割後の `pnpm typecheck`: 成功。
- `App.tsx` 追加分割後の `pnpm exec vitest run src/renderer/App.test.tsx`: 成功。105 tests が成功。
- `App.tsx` 追加分割と文書更新後の `pnpm verify:full`: 成功。100 test files / 885 tests が成功。
- `aiWorkspaceService.test.ts` 分割後の `pnpm typecheck`: 成功。
- `aiWorkspaceService.test.ts` 分割後の `pnpm exec vitest run src/main/ai/aiWorkspaceService.test.ts src/main/ai/aiWorkspaceService.preview.test.ts`: 成功。37 tests が成功。
- `aiWorkspaceService.test.ts` 分割後の `pnpm verify:full`: 成功。101 test files / 885 tests が成功。
- `diagramPreview.test.ts` 分割後の `pnpm typecheck`: 成功。
- `diagramPreview.test.ts` 分割後の `pnpm exec vitest run src/renderer/diagramPreview.test.ts src/renderer/diagramPreview.panZoom.test.ts`: 成功。36 tests が成功。
- `diagramPreview.test.ts` 分割後の `pnpm verify:full`: 成功。102 test files / 885 tests が成功。
- `Editor.test.tsx` ライブプレビュー系分割後の `pnpm typecheck`: 成功。
- `Editor.test.tsx` ライブプレビュー系分割後の `pnpm exec vitest run src/renderer/components/Editor.test.tsx src/renderer/components/Editor.livePreview.test.tsx`: 成功。103 tests が成功。
- `Editor.test.tsx` ライブプレビュー系分割後の `pnpm verify:full`: 成功。103 test files / 885 tests が成功。

## 2026-05-31 20:59 JST

### 追加の肥大テスト分割

`App.test.tsx` と `Editor.test.tsx` に残っていたUI統合テストを、挙動単位のテストファイルへ追加分割した。実装ロジック、UI文言、Markdown保存形式、IPCの公開的な意味は変更していない。

### 追加分割後の行数上位ファイル

| 行数 | ファイル |
|------|----------|
| 685 | `app/src/renderer/App.tsx` |
| 641 | `app/src/renderer/App.fileActions.test.tsx` |
| 628 | `app/src/main/ai/aiWorkspaceService.test.ts` |
| 618 | `app/src/renderer/components/Editor.test.tsx` |
| 583 | `app/src/renderer/components/Editor.table.test.tsx` |
| 570 | `app/src/renderer/App.workspaces.test.tsx` |
| 566 | `app/src/renderer/components/Editor.frontmatter.test.tsx` |
| 564 | `app/src/main/files/charts.test.ts` |
| 561 | `app/src/main/ai/codexAppServerClient.ts` |
| 534 | `app/src/renderer/appLayoutProps.ts` |

### 今回追加で分割したファイル

- `app/src/renderer/App.test.tsx`: 4299行から95行へ削減し、入口表示、設定、機能トグルの基本確認だけを残した。
- `app/src/renderer/components/Editor.test.tsx`: 2107行から618行へ削減し、フロントマター、フロントマター型別入力、表プレビューを専用テストファイルへ分離した。
- `app/src/renderer/App.charts.test.tsx`: 年表チャート系テストとして分離した。
- `app/src/renderer/App.dateCharts.test.tsx`: 日付チャート系テストとして分離した。
- `app/src/renderer/App.cowork.test.tsx`: Coworkパネル、チャット履歴、OpenAI API方式表示のテストとして分離した。
- `app/src/renderer/App.externalChanges.test.tsx`: 外部変更検知、衝突解消、ファイルタブ再選択・閉じる挙動のテストとして分離した。
- `app/src/renderer/App.fileActions.test.tsx`: コマンドパレット、クイックスイッチャー、ドラッグ&ドロップ、複数選択、ピン留めのテストとして分離した。
- `app/src/renderer/App.fileRename.test.tsx`: 本文上部タイトル、リネーム前保存、ファイルツリー右クリック操作のテストとして分離した。
- `app/src/renderer/App.fileTabs.test.tsx`: ファイル読み込み、タブ操作、自動保存、保存失敗時のテストとして分離した。
- `app/src/renderer/App.navigationShortcuts.test.tsx`: 画面タブ、分割表示、ソースモード、ショートカットのテストとして分離した。
- `app/src/renderer/App.railPanels.test.tsx`: 右パネル、フロントマター設定、暦設定レールのテストとして分離した。
- `app/src/renderer/App.searchLinks.test.tsx`: 検索、フロントマター検索、リンクパネルのテストとして分離した。
- `app/src/renderer/App.sidebarPanels.test.tsx`: フォルダ開閉、サイドバー幅、右パネル開閉のテストとして分離した。
- `app/src/renderer/App.workspaces.test.tsx`: 新規ファイル/フォルダ、ワークスペース登録・切替・リネームのテストとして分離した。
- `app/src/renderer/components/Editor.frontmatter.test.tsx`: フロントマター表示、折りたたみ、追加・削除、配列入力のテストとして分離した。
- `app/src/renderer/components/Editor.frontmatterFields.test.tsx`: chronicle、plannedDate、YAML、ユーザー定義フィールド入力のテストとして分離した。
- `app/src/renderer/components/Editor.table.test.tsx`: 表プレビュー、セル編集、貼り付け、キーボード移動、行列操作のテストとして分離した。

### 危険パターン再調査

- `TODO` / `FIXME` / `as any` / `@ts-ignore` は `app/src` には見つからなかった。
- `console.log` は `Editor.livePreview.test.tsx` のコードブロック表示用テスト文字列だけで、実行されるログではないため修正不要。
- `eslint-disable` は3件残存。`codexAppServerClient.ts` はapp-server手順の順序保証、`aiWorkspaceIndex.ts` は部分文字列出現回数の走査、`Editor.tsx` はエディタ再生成制御のための既存除外であり、今回のテスト分割範囲では挙動変更リスクの方が大きいため維持した。

### 分割しきれなかったファイル

- なし。`app/src` の `ts` / `tsx` では、1000行超と700行超のファイルは現時点で残っていない。

### 追加検証結果

- `pnpm typecheck`: 成功。
- `pnpm exec vitest run src/renderer/components/Editor.test.tsx src/renderer/components/Editor.table.test.tsx src/renderer/components/Editor.frontmatter.test.tsx src/renderer/components/Editor.frontmatterFields.test.tsx src/renderer/components/Editor.livePreview.test.tsx`: 成功。103 tests が成功。
- `pnpm exec vitest run src/renderer/App.test.tsx src/renderer/App.fileTabs.test.tsx src/renderer/App.externalChanges.test.tsx src/renderer/App.sidebarPanels.test.tsx src/renderer/App.cowork.test.tsx src/renderer/App.railPanels.test.tsx src/renderer/App.charts.test.tsx src/renderer/App.dateCharts.test.tsx src/renderer/App.navigationShortcuts.test.tsx src/renderer/App.workspaces.test.tsx src/renderer/App.fileRename.test.tsx src/renderer/App.fileActions.test.tsx src/renderer/App.searchLinks.test.tsx`: 成功。105 tests が成功。
- `pnpm verify:full`: 成功。118 test files / 885 tests が成功し、`git -C .. diff --check` も通過した。
- `pnpm build:mac:safe`: 通常権限では `github.com` の名前解決で失敗したが、ネットワーク許可付き再実行で成功。`out/Relic-darwin-arm64` のunpacked app、`Relic.app`、`app.asar` を確認し、`Setup.exe` / `Update.exe` / `.nupkg` / `RELEASES` がないことを確認した。
