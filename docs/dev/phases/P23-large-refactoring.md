# P23-large-refactoring.md

Relicの大規模リファクタリングフェーズの正本。

このフェーズでは、既存挙動を保ったまま、肥大化したコード、責務が混ざった処理、検証しづらい構造を段階的に整理する。
ただし、具体的なリファクタリング対象はユーザーが指定したもの、またはコード確認後にユーザーへ提示して合意したものだけを対象にする。

---

## 読み込みルール

Relicの大規模リファクタリングフェーズ。

AIはこのフェーズを前提にユーザーへ接する。
対象は既存挙動を保ったコード構造の整理であり、仕様変更、UI変更、保存形式変更、機能追加へ広げる場合は、事前にユーザーへ確認する。

最初に読む:

- この文書

必要になったときだけ読む:

- 実装規約: `../conventions.md`
- テスト方針: `../testing.md`
- アーキテクチャ前提: `../../architecture/overview.md`, `../../architecture/decisions.md`
- 対象機能の正解: 対応する `../../spec/*.md`
- UI挙動に触れる場合: `../../ui/screens-macos.md`, `../../ui/navigation.md`, `../../ui/DESIGN.md`

注意:

- ユーザーが指定したリファクタリング対象、またはコード確認後にユーザーへ提示して合意した対象だけを扱う
- 既存挙動を変えない。挙動変更が必要になった場合は、リファクタリングから分けて確認する
- 大きなファイル移動・責務分割は、対象、理由、検証方法を明示してから進める
- 変更後は `pnpm typecheck` と、対象に応じたテストを確認する
- 実アプリ確認が必要な挙動は、確認範囲と未確認理由をP23正本に残す

---

## フェーズの目的

- 既存機能と保存データを壊さず、コードの責務境界を整理する
- 大きくなったコンポーネント、store、IPC、ファイル操作処理を扱いやすい単位に分ける
- 重複、暗黙の依存、テストしづらい処理を減らす
- 変更単位ごとに型検査と自動テストで挙動維持を確認する

---

## 作業方針

- 実装前に、対象、今の問題、変更範囲、変えない挙動、検証方法を明示する
- 1回の変更は、レビューと検証ができる小さい単位に分ける
- 仕様変更、UI変更、保存形式変更、機能追加をリファクタリングに混ぜない
- 挙動変更が必要になった場合は、理由と影響範囲を説明し、別作業としてユーザーに確認する
- 変更後は `pnpm typecheck` と、対象に応じたテストを確認する
- 実アプリ確認が必要な挙動は、確認した範囲と未確認理由を記録する
- このフェーズ文書には日誌を書かない。日付順の作業履歴は `docs/journal/` に分ける

---

## 開始時チェック

リファクタリング対象ごとに、実装前に以下を確認する。

- [ ] 対象ファイル・対象モジュール
- [ ] 今の問題、または整理したい責務
- [ ] 変更してよいコード範囲
- [ ] 変えてはいけない既存挙動
- [ ] 仕様・UI・保存形式への影響有無
- [ ] 最初に作る最小単位
- [ ] 自動テストで確認する範囲
- [ ] 実アプリ確認が必要な範囲

---

## 進捗

このフェーズでは、ユーザーが指定または合意したリファクタリング単位ごとに、次回作業時の判断に必要な状態だけを記録する。
日付順の作業ログ、感想、細かな経緯はここに書かない。

必要な場合だけ、以下を同じ項目内にまとめる。

- 方向性
- 実施
- 確認
- 残り

### フェーズ開始

- 方向性: P23は、既存挙動を保ちながらコード構造を整理する大規模リファクタリングフェーズとして進める
- 実施: `docs/dev/phases.md` の現在フェーズをP23へ変更し、P23正本を追加した
- 確認: コード実装には入らず、フェーズ開始文書だけを更新する
- 残り: 最初のリファクタリング対象は共通処理抽出として実施済み。以後は次のリファクタリング単位ごとに対象、変更範囲、検証方法を確認してから実装する

### 共通処理抽出

- 方向性: 最初のリファクタリング単位は、挙動を変えずにワークスペースツリー走査、mainプロセスのワークスペース相対パス変換、renderer側のパス表示・結合ヘルパーを共通化する
- 実施: `collectMarkdownPaths` を shared の共通処理へ集約し、main側の重複した `toWorkspaceRelativePath` を `app/src/main/files/paths.ts` へ集約した。renderer側は `app/src/renderer/workspacePaths.ts` をパス表示・結合ヘルパーの参照先にした
- 確認: `pnpm typecheck` と `pnpm test` が通過した。テストは34ファイル、324件が通過した
- 残り: `Editor.tsx`、`App.tsx`、`ChronicleSidebar.tsx` の大きな責務分割は次のリファクタリング単位として扱う

### Appチャート補助処理抽出

- 方向性: `App.tsx` 末尾に残っていたチャート正規化、Markdown frontmatter からのdateチャート補完、チャート更新IPC未提供時の保存fallbackをrenderer内の純粋寄りモジュールへ分離する
- 実施: `app/src/renderer/ganttChartData.ts` を追加し、`App.tsx` は `window.relic` から取得した読み書き関数を渡す呼び出し側に限定した。IPC、preload API、UI、保存形式は変更しない
- 確認: `pnpm typecheck` と `pnpm test` が通過した。テストは35ファイル、332件が通過した
- 残り: `ChronicleSidebar.tsx` の描画・ドラッグ処理分割、`Editor.tsx` のCodeMirror/frontmatter/table責務分割、main側 `chronicle.ts` との重複整理は別単位として扱う

### Chronicleチャート計算処理抽出

- 方向性: `ChronicleSidebar.tsx` のReact描画と、行生成・絞り込み・ソート・軸・目盛り・minimap・ドラッグ差分計算を分離し、チャート計算を純粋関数として検証できる形にする
- 実施: `app/src/renderer/chronicleTimeline.ts` を追加し、`ChronicleSidebar.tsx` にはReact component、hook、ref、pointer event handler、JSXを残した。IPC、preload API、UI、保存形式は変更しない
- 確認: `pnpm typecheck` と `pnpm test` が通過した。テストは36ファイル、338件が通過した
- 残り: `ChronicleSidebar.tsx` の描画用小コンポーネント分割、`Editor.tsx` のCodeMirror/frontmatter/table責務分割、`App.tsx` の追加分割、main側 `chronicle.ts` との重複整理は別単位として扱う

### Editor・Chronicle・App追加分割

- 方向性: 既存P23変更を保持したまま、仕様、UI、保存形式、IPC/preload APIを変えず、巨大化した `Editor.tsx`、`ChronicleSidebar.tsx`、`chronicle.ts`、`App.tsx` の責務境界を内部モジュールへ分ける
- 実施: `Editor.tsx` から表編集、frontmatter/YAML保持、live preview、CodeMirror拡張構築、編集可否compartmentを分離した。Chronicle/Ganttは軸・ガイド線・今日線・オフスクリーンジャンプ・安定bounds hookを描画部品へ移し、main側の年表データ整形を `chronicleData.ts` に分離した。日付/年表座標変換とrange配列化は `app/src/shared/chartTime.ts` に集約した。`App.tsx` はレール定義とワークスペース切替UIを `RailNavigation.tsx` へ移し、タブ閉じ、レール飛行、split閉じ演出をhook化した
- 確認: `pnpm exec vitest run src/renderer/components/Editor.test.tsx`、`pnpm exec vitest run src/renderer/chronicleTimeline.test.ts src/renderer/ganttChartData.test.ts src/main/files/chronicle.test.ts`、`pnpm exec vitest run src/renderer/App.test.tsx` が通過した。最終確認として `pnpm typecheck` と `pnpm test` が通過し、全体テストは36ファイル、338件が通過した
- 残り: 今回指定された分割単位は完了。以後は追加で大きな責務が残る箇所を対象化する場合、同じく仕様変更とUI変更を混ぜずに別単位として扱う

### App周辺の責務分割

- 方向性: 仕様、UI、保存形式、IPC/preload APIを変えず、`App.tsx` と `useWorkspaceFileActions` 周辺に残るファイル操作補助、右パネル、上部バー、オーバーレイの責務を内部モジュールへ分離する
- 実施: `useWorkspaceFileActions` から重複除外、ユニーク名生成、作成後path探索、フォルダ配下タブ更新、削除対象path判定を `workspaceFileActionHelpers.ts` へ分離した。`App.tsx` からサイドバーの飛行演出つきファイル操作を `useSidebarFileInteractions.ts`、active document導出を `useActiveDocumentContext.ts`、右パネルを `AppRightPanel.tsx`、上部バーを `AppTopBar.tsx`、オーバーレイ群を `AppOverlays.tsx` へ分離した
- 確認: `pnpm exec vitest run src/renderer/hooks/workspaceFileActionHelpers.test.ts`、`pnpm exec vitest run src/renderer/App.test.tsx`、`pnpm typecheck`、`pnpm test`、`git diff --check` が通過した。全体テストは37ファイル、344件が通過した
- 残り: 今回指定された分割単位は完了。実アプリ確認は自動テストで表示・操作差分が残らなかったため未実施

### GraphSidebar計算分離

- 方向性: 仕様、UI、保存形式、IPC/preload API、`graphStore` の状態構造を変えず、`GraphSidebar.tsx` に同居していたグラフ表示の純粋計算をrenderer内モジュールへ分離する
- 実施: `app/src/renderer/graphLayout.ts` を追加し、viewBox計算、zoom範囲、フォルダ/タグ候補、絞り込み済みgraph生成、関連ノード抽出、group query判定、local depth抽出、初期レイアウト、simulation tickを移した。`GraphSidebar.tsx` はstore接続、React state、pointer/key/wheel handler、JSX描画を中心に残し、既存の `buildGraphViewBox` named export は再exportで維持した
- 確認: `pnpm exec vitest run src/renderer/graphLayout.test.ts`、`pnpm exec vitest run src/renderer/components/GraphSidebar.test.tsx`、`pnpm typecheck`、`pnpm test`、`git diff --check` が通過した。全体テストは38ファイル、353件が通過した
- 残り: 今回指定された分割単位は完了。実アプリ確認は仕様・UI・IPC・保存形式を変えない内部計算分離のため未実施

### GraphSidebar操作パネル分離

- 方向性: 仕様、UI文言、CSS、保存形式、IPC/preload API、`graphStore` の状態構造を変えず、`GraphSidebar.tsx` に残っていたグラフ操作パネルを独立componentへ分離する
- 実施: `app/src/renderer/components/GraphControls.tsx` を追加し、`GraphControls`、操作パネルsection、浮動パネル位置調整hookを移した。`GraphSidebar.tsx` は `GraphPanel`、SVG操作、node drag/pan/key/wheel handler、キャンバス描画を中心に残した
- 確認: `pnpm exec vitest run src/renderer/components/GraphControls.test.tsx`、`pnpm exec vitest run src/renderer/components/GraphSidebar.test.tsx`、`pnpm exec vitest run src/renderer/App.test.tsx`、`pnpm typecheck`、`pnpm test`、`git diff --check` が通過した。全体テストは39ファイル、357件が通過した
- 残り: 今回指定された分割単位は完了。実アプリ確認はUI/仕様を変えない内部component分離のため未実施

### GraphSidebar SVGキャンバス分離

- 方向性: 仕様、UI文言、CSS、保存形式、IPC/preload API、`graphStore`、`graphLayout.ts` の計算処理を変えず、`GraphSidebar.tsx` に残っていたSVGキャンバス描画を独立componentへ分離する
- 実施: `app/src/renderer/components/GraphCanvas.tsx` を追加し、SVG本体、arrow marker定義、edge layer、node layer、label描画を移した。`GraphSidebar.tsx` はgraph状態、simulation、pan/zoom/drag handler、loading/error/empty表示、summary、`GraphControls` 呼び出しを中心に残した
- 確認: `pnpm exec vitest run src/renderer/components/GraphCanvas.test.tsx`、`pnpm exec vitest run src/renderer/components/GraphSidebar.test.tsx`、`pnpm exec vitest run src/renderer/App.test.tsx`、`pnpm typecheck`、`pnpm test`、`git diff --check` が通過した。全体テストは40ファイル、361件が通過した
- 残り: 今回指定された分割単位は完了。実アプリ確認はUI/仕様を変えない内部component分離のため未実施

### GraphSidebar interaction hook分離

- 方向性: 仕様、UI、CSS、保存形式、IPC/preload API、`graphStore`、`graphLayout.ts` の計算処理を変えず、`GraphSidebar.tsx` に残っていたgraph simulation、pan/zoom、node drag/click/key処理をhookへ分離する
- 実施: `app/src/renderer/hooks/useGraphCanvasInteractions.ts` を追加し、simPoints/ref、simulation tick、pan/isPanning/svgRef、graph wheel/key/pointer handler、node click/key/pointer/hover handler、viewBoxとrelatedPaths導出を移した。`GraphSidebar.tsx` はstore接続、filtered graph導出、loading/error/empty、summary、`GraphControls` と `GraphCanvas` の組み立てを中心に残した
- 確認: `pnpm exec vitest run src/renderer/hooks/useGraphCanvasInteractions.test.tsx`、`pnpm exec vitest run src/renderer/components/GraphCanvas.test.tsx`、`pnpm exec vitest run src/renderer/components/GraphSidebar.test.tsx`、`pnpm exec vitest run src/renderer/App.test.tsx`、`pnpm typecheck`、`pnpm test`、`git diff --check` が通過した。全体テストは41ファイル、366件が通過した
- 残り: 今回指定された分割単位は完了。実アプリ確認はUI/仕様を変えない内部hook分離のため未実施

### GraphControls section分離

- 方向性: 仕様、UI文言、DOM class名、CSS、保存形式、IPC/preload API、`graphStore` の状態構造を変えず、`GraphControls.tsx` にまとまって残っていた操作パネル各sectionを内部componentへ分離する
- 実施: `app/src/renderer/components/GraphControlSections.tsx` を追加し、filter、groups、display、forcesの各sectionと共通section wrapperを移した。`GraphControls.tsx` はworkspaceIdによる既存graph読込、最小化/展開、topbar、再読み込み、section開閉状態、reset button、浮動パネル位置調整hookを中心に残した
- 確認: `pnpm exec vitest run src/renderer/components/GraphControlSections.test.tsx`、`pnpm exec vitest run src/renderer/components/GraphControls.test.tsx`、`pnpm exec vitest run src/renderer/components/GraphSidebar.test.tsx`、`pnpm exec vitest run src/renderer/App.test.tsx`、`pnpm typecheck`、`pnpm test`、`git diff --check` が通過した。全体テストは42ファイル、370件が通過した
- 残り: 今回指定された分割単位は完了。実アプリ確認はUI/仕様を変えない内部component分離のため未実施

### GraphControls floating panel hook分離

- 方向性: 仕様、UI文言、DOM class名、CSS、保存形式、IPC/preload API、`graphStore` の状態構造を変えず、`GraphControls.tsx` に残っていた浮動パネル位置調整hookをhooks配下へ分離する
- 実施: `app/src/renderer/hooks/useGraphFloatingPanelPosition.ts` を追加し、drag handleのpointer down、初期位置style、pointermove時のclamp、pointerup/pointercancel時のlistener解除処理を移した。`GraphSidebar.tsx` は新hookをhooks配下からimportし、`GraphControls.tsx` は操作パネルcomponent本体に絞った
- 確認: `pnpm exec vitest run src/renderer/hooks/useGraphFloatingPanelPosition.test.tsx`、`pnpm exec vitest run src/renderer/components/GraphControls.test.tsx`、`pnpm exec vitest run src/renderer/components/GraphSidebar.test.tsx`、`pnpm exec vitest run src/renderer/App.test.tsx`、`pnpm typecheck`、`pnpm test`、`git diff --check` が通過した。全体テストは43ファイル、374件が通過した
- 残り: 今回指定された分割単位は完了。実アプリ確認はUI/仕様を変えない内部hook分離のため未実施

### GraphPanel model hook分離

- 方向性: 仕様、UI文言、DOM class名、CSS、保存形式、IPC/preload API、`graphStore` の状態構造を変えず、`GraphSidebar.tsx` に残っていたstore接続、graph読込、表示モデル導出をhookへ分離する
- 実施: `app/src/renderer/hooks/useGraphPanelModel.ts` を追加し、GraphPanel用store state/action取得、workspaceIdによる既存graph読込effect、hoveredPath state、filteredGraph、focusedPath、labelOpacity、groupByPath、forceSettings導出、`useGraphCanvasInteractions` 呼び出しを移した。`GraphSidebar.tsx` は `useT`、浮動パネルhook、model hook、loading/error/empty分岐、`GraphControls` と `GraphCanvas` のJSX組み立てを中心に残した
- 確認: `pnpm exec vitest run src/renderer/hooks/useGraphPanelModel.test.tsx`、`pnpm exec vitest run src/renderer/hooks/useGraphCanvasInteractions.test.tsx`、`pnpm exec vitest run src/renderer/components/GraphCanvas.test.tsx`、`pnpm exec vitest run src/renderer/components/GraphSidebar.test.tsx`、`pnpm exec vitest run src/renderer/App.test.tsx`、`pnpm typecheck`、`pnpm test`、`git diff --check` が通過した。全体テストは44ファイル、379件が通過した
- 残り: 今回指定された分割単位は完了。実アプリ確認はUI/仕様を変えない内部hook分離のため未実施

### Graph canvas internals分離

- 方向性: 仕様、UI文言、DOM class名、CSS、保存形式、IPC/preload API、`graphStore`、`graphLayout.ts` の計算処理を変えず、Graph canvas内部に残っていたinteraction/rendering責務をhook/componentへ分離する
- 実施: `app/src/renderer/hooks/useGraphSimulation.ts`、`useGraphViewportInteractions.ts`、`useGraphNodeInteractions.ts` を追加し、`useGraphCanvasInteractions.ts` は既存input/outputを維持したorchestratorにした。`app/src/renderer/components/GraphCanvasLayers.tsx` を追加し、arrow marker、edge layer、node layerを分離した。`GraphCanvasProps`、marker id、class名、role、tabIndex、aria-label、node click/key behaviorは維持した
- 確認: `pnpm exec vitest run src/renderer/hooks/useGraphSimulation.test.tsx`、`pnpm exec vitest run src/renderer/hooks/useGraphViewportInteractions.test.tsx`、`pnpm exec vitest run src/renderer/hooks/useGraphNodeInteractions.test.tsx`、`pnpm exec vitest run src/renderer/hooks/useGraphCanvasInteractions.test.tsx`、`pnpm exec vitest run src/renderer/components/GraphCanvasLayers.test.tsx`、`pnpm exec vitest run src/renderer/components/GraphCanvas.test.tsx`、`pnpm exec vitest run src/renderer/components/GraphSidebar.test.tsx`、`pnpm exec vitest run src/renderer/App.test.tsx`、`pnpm typecheck`、`pnpm test`、`git diff --check` が通過した。全体テストは48ファイル、395件が通過した
- 残り: 今回指定された分割単位は完了。実アプリ確認はUI/仕様を変えない内部hook/component分離のため未実施

### Graph canvas internals再確認

- 方向性: 直近のGraph canvas internals分離を、追加リファクタリング前の安全確認として再確認する
- 実施: 作業開始時点でGraph分割の未コミット差分が残っていないことを確認し、Graph関連hook/componentテストを再実行した
- 確認: `pnpm exec vitest run src/renderer/hooks/useGraphSimulation.test.tsx src/renderer/hooks/useGraphViewportInteractions.test.tsx src/renderer/hooks/useGraphNodeInteractions.test.tsx src/renderer/hooks/useGraphCanvasInteractions.test.tsx src/renderer/components/GraphCanvasLayers.test.tsx src/renderer/components/GraphCanvas.test.tsx src/renderer/components/GraphSidebar.test.tsx` が通過した。7ファイル、27件が通過した
- 残り: Graph分割の締めとして追加対応は不要

### App状態・pane補助処理追加分割

- 方向性: 仕様、UI、保存形式、IPC/preload API、store状態構造を変えず、`App.tsx` に残っていたtoast、workspace由来データ、Gantt更新、workspace rename rail保持、pane/file補助操作をhookへ分離する
- 実施: `useAppToast.ts`、`useWorkspaceAliases.ts`、`useWorkspaceGanttCharts.ts`、`useWorkspaceRenameRailHold.ts`、`useAppPaneFileActions.ts` を追加した。`App.tsx` は画面構成、store接続、主要hookの組み立てを中心に残した
- 確認: `pnpm exec vitest run src/renderer/App.test.tsx`、`pnpm typecheck`、`pnpm test`、`git diff --check` が通過した。全体テストは49ファイル、401件が通過した
- 残り: 今回指定されたApp追加分割単位は完了。実アプリ確認はUI/仕様を変えない内部hook分離のため未実施

### ファイル操作UIモデル分離

- 方向性: ファイル操作の仕様、確認ダイアログ、リンク更新挙動を変えず、`FileTree.tsx` と `FilesSidebar.tsx` に同居していたツリー計算、移動判定、複数選択状態を分離する
- 実施: `app/src/renderer/fileTreeModel.ts` を追加し、node探索、展開要求判定、移動先正規化、移動対象filter、context menu位置計算を移した。`useFileTreeSelection.ts` を追加し、`FilesSidebar.tsx` の選択anchor、range選択、toggle選択、選択数通知をhook化した
- 確認: `pnpm exec vitest run src/renderer/fileTreeModel.test.ts src/renderer/hooks/workspaceFileActionHelpers.test.ts`、`pnpm typecheck`、`pnpm test`、`git diff --check` が通過した。全体テストは49ファイル、401件が通過した
- 残り: 今回指定されたファイル操作UI分割単位は完了。実アプリ確認はUI/仕様を変えない内部model/hook分離のため未実施

### main IPC active workspace helper整理

- 方向性: IPCチャンネル名、preload API、戻り値、エラーコード、main/renderer責務境界を変えず、`fileHandlers.ts` と `workspaceHandlers.ts` に重複していたactive workspace取得と例外details変換を共通化する
- 実施: `activeWorkspace.ts` に `getActiveWorkspaceContext` と `ipcErrorDetails` を追加し、`fileHandlers.ts` はファイル操作handlerのactive workspace取得とsettings参照を共通context経由にした。`workspaceHandlers.ts` はタグ、frontmatter候補、aliases、chronicle、graph、Gantt設定保存/更新のactive workspace取得を共通context経由にした
- 確認: `pnpm exec vitest run src/main/files/markdownFiles.test.ts src/main/files/chronicle.test.ts`、`pnpm typecheck`、`pnpm test`、`git diff --check` が通過した。全体テストは49ファイル、401件が通過した
- 残り: 今回指定されたIPC helper整理単位は完了。実アプリ確認はIPC/preload APIと戻り値を変えない内部helper整理のため未実施

### ファイル操作hook・IPC validator・Toolbar・Dashboard分離

- 方向性: 仕様、UI、文言、CSS、保存形式、IPC/preload API、store構造を変えず、残っていたファイル操作hook、IPC入力検証、Toolbar編集コマンド、Dashboard計算modelの責務を小さい内部moduleへ分離する
- 実施: `useWorkspaceFileActions.ts` を既存返り値を維持するfacadeにし、workspace登録/切替、ファイル作成、open/link open、移動/rename/delete/duplicateをhookへ分けた。`fileHandlers.ts` と `workspaceHandlers.ts` の入力検証を validator moduleへ移し、対象テストを追加した。`Toolbar.tsx` のCodeMirror編集コマンドとtarget view解決を `toolbarCommands.ts` へ移し、既存の `insertBlockIds` named exportはre-exportで維持した。`DashboardPanel.tsx` の統計、frontmatter集計、treemap/donut計算を `dashboardModel.ts` へ移し、既存named exportはre-exportで維持した
- 確認: `pnpm exec vitest run src/renderer/App.test.tsx src/renderer/hooks/workspaceFileActionHelpers.test.ts src/renderer/components/Toolbar.test.tsx src/renderer/components/DashboardPanel.test.tsx src/renderer/dashboardModel.test.ts src/main/ipc/workspaceHandlers.test.ts src/main/ipc/fileHandlerValidators.test.ts src/main/ipc/workspaceHandlerValidators.test.ts` が通過した。対象テストは8ファイル、118件が通過した。最終確認として `pnpm typecheck`、`pnpm test`、`git diff --check` が通過し、全体テストは52ファイル、411件が通過した
- 残り: 今回指定された継続リファクタリング単位は完了。`ChronicleSidebar.tsx` の追加分割は次の単位に回す。実アプリ確認はUI/仕様を変えない内部module分離のため未実施

### ChronicleSidebar表示・操作分離

- 方向性: 仕様、UI文言、DOM class名、CSS、保存形式、IPC/preload API、`GanttChartView` の呼び出し方を変えず、`ChronicleSidebar.tsx` に残っていた表示モデル、スクロール・ドラッグ操作、toolbar、minimap、chart grid描画を内部moduleへ分離する
- 実施: `useChronicleChartModel.ts`、`useChronicleChartViewport.ts`、`useChronicleEntryDrag.ts`、`useStableTimelineBounds.ts` を追加し、active chart選択、rows/axis/minimap導出、viewport scroll/pan/minimap操作、entry move/resize previewと更新input生成をhook化した。`ChronicleToolbar.tsx`、`ChronicleMinimap.tsx`、`ChronicleChartGrid.tsx` を追加し、`ChronicleSidebar.tsx` はhook呼び出しと子component組み立てを中心に残した
- 確認: `pnpm exec vitest run src/renderer/hooks/useChronicleChartModel.test.tsx src/renderer/hooks/useChronicleChartViewport.test.tsx src/renderer/hooks/useChronicleEntryDrag.test.tsx src/renderer/components/ChronicleToolbar.test.tsx src/renderer/components/ChronicleMinimap.test.tsx src/renderer/components/ChronicleChartGrid.test.tsx` が通過した。周辺確認として `pnpm exec vitest run src/renderer/chronicleTimeline.test.ts src/renderer/ganttChartData.test.ts src/renderer/App.test.tsx`、最終確認として `pnpm typecheck` と `pnpm test` が通過し、全体テストは58ファイル、429件が通過した
- 残り: 今回指定されたChronicleSidebar追加分割単位は完了。実アプリ確認はUI/仕様を変えない内部hook/component分離のため未実施

### Editor frontmatter/table責務分離

- 方向性: 仕様、UI文言、DOM class名、CSS、保存形式、IPC/preload API、`Editor.tsx` の既存re-exportを変えず、`editorFrontmatter.ts` と `editorTables.ts` に残っていたmodel処理とCodeMirror/DOM widget処理を分離する
- 実施: `editorFrontmatterModel.ts` と `editorFrontmatterWidget.ts` を追加し、YAML行解析、固定フィールド判定、date/chronicle入力解析、YAML保持シリアライズ、frontmatter widgetを分けた。`editorTableModel.ts` と `editorTableWidget.ts` を追加し、table検出、format、行列操作、table widgetを分けた。既存の `editorFrontmatter.ts` と `editorTables.ts` はnamed exportを維持するfacadeにした
- 確認: `pnpm exec vitest run src/renderer/editorFrontmatterModel.test.ts src/renderer/editorTableModel.test.ts src/renderer/components/Editor.test.tsx`、`pnpm typecheck`、`pnpm test`、`git diff --check` が通過した。全体テストは60ファイル、439件が通過した
- 残り: 今回指定されたEditor周辺分割単位は完了。実アプリ確認はUI/仕様を変えない内部model/widget分離のため未実施

### Markdown Preview / Live Preview責務分離

- 方向性: 仕様、UI文言、DOM class名、CSS、Markdown保存形式、IPC/preload API、`Editor.tsx` と `Preview.tsx` の既存export経路を変えず、Markdown live previewとpreview renderingに残っていた純粋処理、CodeMirror widget、React hook責務を分離する
- 実施: `editorLivePreviewModel.ts` と `editorLivePreviewWidgets.ts` を追加し、inline記法検出、重なり判定、クリック可能リンク判定、CodeMirror widgetを分けた。`previewMarkdown.ts` と `usePreviewEmbeds.ts` を追加し、Markdown rendering、embed target正規化、checkbox更新、埋め込み読み込みeffectを分けた。既存の `editorLivePreview.ts` と `components/Preview.tsx` は既存exportを維持したまま組み立て側に寄せた
- 確認: `pnpm exec vitest run src/renderer/editorLivePreviewModel.test.ts src/renderer/previewMarkdown.test.ts src/renderer/components/Preview.test.tsx src/renderer/components/Editor.test.tsx`、`pnpm typecheck`、`pnpm test`、`git diff --check` が通過した。全体テストは62ファイル、449件が通過した
- 残り: 今回指定されたMarkdown Preview / Live Preview分割単位は完了。実アプリ確認はUI/仕様を変えない内部model/widget/hook分離のため未実施

### FileTree UI責務分離

- 方向性: UI文言、CSS class名、DOM role、context menu項目順、clipboard内容、prompt内容、IPC/preload API、保存形式、ファイル操作仕様、`FilesSidebar.tsx` からの既存import経路を変えず、`FileTree.tsx` に残っていた行表示、context menu、rename、展開、追加表示motionを内部moduleへ分離する
- 実施: `FileTreeContextMenu.tsx` と `FileTreeItemRow.tsx` を追加し、context menu DOMと行表示を分けた。`useFileTreeItemState.ts` と `useFileTreeMotion.ts` を追加し、rename、context menu close、remove motion、展開要求反映、追加表示motionをhook化した。`fileTreeModel.ts` にはrename確定判定、Markdownリンク整形、multi-select操作対象判定、追加path/motion path計算を追加した。`FileTree.tsx` は既存exportを維持し、`FileTree` と `FileTreeItem` の組み立てに絞った
- 確認: `pnpm exec vitest run src/renderer/fileTreeModel.test.ts src/renderer/components/FileTree.test.tsx src/renderer/components/SettingsSidebar.test.tsx src/renderer/App.test.tsx`、`pnpm typecheck`、`pnpm test`、`git diff --check` が通過した。全体テストは63ファイル、458件が通過した
- 残り: 今回指定されたFileTree UI分割単位は完了。実アプリ確認はUI/仕様を変えない内部hook/component/model分離のため未実施

### PaneView UI責務分離

- 方向性: UI文言、CSS class名、DOM role、tab id、clipboard内容、drag MIME type、IPC/preload API、store状態構造、保存形式、`App.tsx` からの呼び出し方を変えず、`PaneView.tsx` に残っていたタブバー、タブ右クリックメニュー、drag/drop、表示surface、heading scroll補助を内部moduleへ分離する
- 実施: `paneViewModel.ts` を追加し、panel tab label、文字数/単語数、Markdownリンク整形、tab drag payload、drop位置判定を分けた。`usePaneTabInteractions.ts` と `usePaneHeadingScroll.ts` を追加し、context menu開閉、drop target、drag/drop handler、heading scroll effectをhook化した。`PaneTabBar.tsx`、`PaneTabContextMenu.tsx`、`PaneContentSurface.tsx` を追加し、`PaneView.tsx` はstore接続、autosave、hook呼び出し、子component組み立て中心にした
- 確認: `pnpm exec vitest run src/renderer/paneViewModel.test.ts src/renderer/components/PaneView.test.tsx src/renderer/App.test.tsx src/renderer/store/editorStore.test.ts`、`pnpm typecheck`、`pnpm test`、`git diff --check` が通過した。全体テストは65ファイル、467件が通過した
- 残り: 今回指定されたPaneView UI分割単位は完了。実アプリ確認はUI/仕様を変えない内部component/hook/model分離のため未実施

### FrontmatterSidebar設定UI責務分離

- 方向性: UI文言、CSS class名、DOM構造、frontmatter設定の保存形式、IPC/preload API、`SettingsSidebar` からの呼び出し方を変えず、`FrontmatterSidebar.tsx` に残っていた固定フィールド表示、カスタムフィールド追加、既存フィールド編集、選択肢編集、YAML例生成を内部moduleへ分離する
- 実施: `frontmatterSettingsModel.ts` を追加し、field type定義、固定フィールド定義、選択肢parse/重複排除、field名検証、YAML例生成を分けた。`useFrontmatterFieldsState.ts` を追加し、draft同期、field追加/更新/削除、選択肢追加、field名確定をhook化した。`FrontmatterFixedFields.tsx`、`FrontmatterFieldAddForm.tsx`、`FrontmatterFieldList.tsx`、`FrontmatterChoiceEditor.tsx` を追加し、`FrontmatterSidebar.tsx` は各部品の組み立てに絞った
- 確認: `pnpm exec vitest run src/renderer/frontmatterSettingsModel.test.ts src/renderer/components/SettingsSidebar.test.tsx`、`pnpm typecheck`、`pnpm test`、`git diff --check` が通過した。全体テストは66ファイル、472件が通過した
- 残り: 今回指定された短時間内のFrontmatterSidebar分割単位は完了。実アプリ確認はUI/仕様を変えない内部component/hook/model分離のため未実施
