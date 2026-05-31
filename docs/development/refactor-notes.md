# refactor-notes

P9 全リファクタリングフェーズで実施した肥大ファイル調査、分割結果、検証結果を記録する。

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
| 2496 | `app/src/renderer/components/Editor.test.tsx` |
| 899 | `app/src/main/ai/aiWorkspaceService.test.ts` |
| 873 | `app/src/renderer/diagramPreview.test.ts` |
| 754 | `app/src/renderer/App.tsx` |
| 564 | `app/src/main/files/charts.test.ts` |
| 561 | `app/src/main/ai/codexAppServerClient.ts` |
| 497 | `app/src/renderer/chronicleTimelineAxis.ts` |
| 495 | `app/src/renderer/components/Editor.tsx` |
| 489 | `app/src/main/ai/aiWorkspaceService.ts` |

### 実際に分割したファイル

- `app/src/main/ai/aiWorkspaceService.ts`: 1298行から489行へ削減し、Coworkの接続役に寄せた。
- `app/src/renderer/App.tsx`: 984行から754行へ削減し、終了前保存、外部変更反映、出力、レイアウト幅、AI操作ハンドラをhookへ分離した。
- `app/src/renderer/App.test.tsx`: 共通レンダリングと環境操作を `appTestHelpers.tsx` へ分離した。
- `app/src/renderer/components/Editor.test.tsx`: ライブプレビューとフロントマター展開用のテストヘルパーを `editorTestHelpers.ts` へ分離した。

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

- なし。今回は画面構造を変えず、既存コンポーネントを接続するhook分離を優先した。

### 新規作成した lib modules

- `app/src/main/ai/aiWorkspaceChatModel.ts`
- `app/src/main/ai/aiWorkspaceReferences.ts`
- `app/src/main/ai/aiWorkspaceOperations.ts`
- `app/src/main/ai/aiWorkspaceMessages.ts`
- `app/src/main/ai/aiWorkspaceStateMapper.ts`
- `app/src/main/ai/aiWorkspaceAbort.ts`
- `app/src/main/ai/aiWorkspaceText.ts`
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
- 更新: `app/src/main/ai/aiWorkspaceService.test.ts` は既存の統合動作確認として維持。
- 更新: `app/src/renderer/App.test.tsx`
- 更新: `app/src/renderer/components/Editor.test.tsx`

### 更新した仕様書

- なし。外部仕様、保存形式、UI文言、操作導線は変更していない。

### 更新した docs

- `docs/development/refactor-notes.md`
- `docs/development/coding-rules.md`
- `docs/engineering/architecture.md`
- `docs/development/phases/P9.md`

### 実装を正として修正した仕様書・docs の不一致

- 添付テキストでは `docs/dev/refactor-notes.md`、`docs/dev/phases.md`、`docs/dev/doc-code-alignment.md` が指定されていたが、現行リポジトリの正しい開発文書配置は `docs/development/` であり、`docs/dev/` と `doc-code-alignment.md` は存在しない。現行の `docs/development/phases.md` とP9正本を正として、`docs/development/refactor-notes.md` を作成した。
- `docs/engineering/architecture.md` のCowork Service説明は大枠として正しかったが、実装分割後の責務境界を追記した。

### 分割しきれなかったファイル

- `app/src/renderer/App.test.tsx`
- `app/src/renderer/components/Editor.test.tsx`
- `app/src/main/ai/aiWorkspaceService.test.ts`
- `app/src/renderer/diagramPreview.test.ts`
- `app/src/renderer/App.tsx`

### 分割しきれなかった理由

- `App.test.tsx` と `Editor.test.tsx` は広いUI統合テストを含み、単純な機械分割ではテストの前提共有やモック順序を壊しやすい。今回は共通ヘルパーを先に外へ出し、機能別テストファイルへ分ける準備を優先した。
- `App.tsx` は大きく削減したが、タイトルバー・サイドバー・エディタワークスペースへのprops接続がまだ残っている。次に分けるなら、表示用props assemblyを専用hookまたはcontainerへ移す。
- `diagramPreview.test.ts` は今回のCowork / App分割の直接対象外だったため、挙動確認だけに留めた。

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
