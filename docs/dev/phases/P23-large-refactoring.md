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

## 残り実施リスト

P23の残りは、実装単位で12件と見積もる。
内訳は、正本整備1件、主要リファクタリング10件、締め確認1件とする。

以後はこの順番で1件ずつ進める。
各単位は、対象差分とこのP23正本をまとめて確認し、日本語コミットを作る。
UI、保存形式、IPC/preload API、store状態構造、既存import経路は変更しない。

1. [x] **P23残り実施リスト正本化**
   - `docs/dev/phases/P23-large-refactoring.md` に残りリスト、順序、完了条件を追加する。
   - この追加自体を1コミットにする。
2. [x] **App.tsx orchestrator整理**
   - `App.tsx` に残るstore接続、pane/tab組み立て、workspace effect、callback束を追加hook/modelへ分離する。
   - UI、store状態構造、IPC/preload APIは変更しない。
3. [x] **Editor table widget追加分割**
   - `editorTableWidget.ts` のDOM生成、active state、drag/drop、context menu、edge add buttonを内部moduleへ分ける。
   - Markdown table保存形式、CSS class、menu文言、操作順は変更しない。
4. [x] **Editor frontmatter widget追加分割**
   - `editorFrontmatterWidget.ts` のrow rendering、input生成、field更新、collapse decorationを分ける。
   - YAML仕様、UI文言、CSS class、frontmatter保存形式は変更しない。
5. [x] **main IPC handler追加分割**
   - `workspaceHandlers.ts`、`fileHandlers.ts`、`toolHandlers.ts` のhandler登録と個別処理をdomain別moduleへ分ける。
   - IPCチャンネル名、戻り値、エラーdetails、preload APIは変更しない。
6. [x] **editorStore action分離**
   - `editorStore.ts` のpane/tab操作、panel/gantt/file tab操作、履歴更新補助を純粋helperへ分ける。
   - Zustand state shapeと既存hook利用方法は変更しない。
7. [x] **ChronicleChartGrid描画追加分割**
   - `ChronicleChartGrid.tsx` と `chronicleChartParts.tsx` のname column、tracks、entry bar、today/guide描画を整理する。
   - DOM class、ARIA、drag挙動、表示文言は変更しない。
8. [x] **Graph layout model追加分割**
   - `graphLayout.ts` のfilter/group/stats、layout初期化、simulation tick、viewBoxをmodule分割する。
   - 既存export経路はfacadeで維持する。
9. [x] **Gantt/frontmatter data処理分割**
   - `ganttChartData.ts` のchart正規化、frontmatter read/write、legacy chronicle変換を分ける。
   - 保存形式とfallback挙動は変更しない。
10. [x] **main file domain追加分割**
    - `markdownFiles.ts`、`linkUpdater.ts`、`folders.ts`、`replace.ts` 周辺で、ファイル名検証、path変換、リンク更新、読み書き操作を必要範囲で整理する。
    - ファイル操作仕様、リンク更新仕様、エラーコードは変更しない。
11. [x] **残存300行級UI/modelの仕上げ**
    - `RailNavigation.tsx`、`ToolsSidebarSections.tsx`、`DashboardPanel.tsx` / `dashboardModel.ts`、`useWorkspaceFileMutationActions.ts` など、300行前後でまだ責務が混ざる箇所を最後に小分けで処理する。
    - ここは各ファイルごとに小さいコミットへ分ける。
12. [x] **P23締め確認**
    - 大型ファイル一覧、既存テスト、`pnpm typecheck`、`pnpm test`、`git diff --check` で最終確認する。
    - P23正本に「完了判断・残した意図的な未分割箇所・実アプリ未確認理由」を追記する。

完了条件:

- 各実装単位で、対象ユニット/コンポーネントテスト、影響範囲の既存回帰テスト、`pnpm typecheck`、`pnpm test`、`git diff --check` を確認する。
- 文書だけの単位では、`git diff --check` を最低確認とし、コードテストは不要と判断した理由を完了報告に書く。
- 実アプリ確認は、UI/仕様を変えない内部分離では原則未実施とし、自動テストで差分が出た場合だけ必要範囲を判断する。
- P23の残量は無限に細かく分けず、現時点で300行超または責務混在が明確な箇所を完了対象にする。

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

### App shell/render責務分離

- 方向性: UI文言、CSS class名、DOM role、rail/menu/PaneView/AppTopBar/AppRightPanelの既存挙動、IPC/preload API、store状態構造、保存形式を変えず、`App.tsx` に残っていたshell派生値、rail、files sidebar、editor workspace、status bar描画を内部moduleへ分離する
- 実施: `appShellModel.ts` を追加し、登録workspace fallback、open file/panel tab集合、active panel/chart判定、panel label、feature toggleによるrail表示、rail group分割を純粋処理へ移した。`AppRail.tsx`、`AppFilesSidebar.tsx`、`AppEditorWorkspace.tsx`、`AppStatusBar.tsx` を追加し、`App.tsx` はstore/hook接続、主要callback、panel tab組み立て、overlay組み立てを中心にした
- 確認: `pnpm exec vitest run src/renderer/appShellModel.test.ts src/renderer/App.test.tsx`、`pnpm typecheck`、`pnpm test`、`git diff --check` が通過した。全体テストは67ファイル、477件が通過した
- 残り: 今回指定されたApp追加分割単位は完了。実アプリ確認はUI/仕様を変えない内部component/model分離のため未実施

### FilesSidebar検索・tree表示責務分離

- 方向性: UI文言、CSS class名、DOM構造、検索方法menu、frontmatter候補datalist、workspace action、FileTree呼び出し、IPC/preload API、保存形式を変えず、`FilesSidebar.tsx` に残っていた検索UI、検索結果、pin/tree表示、workspace action、検索派生値を内部moduleへ分離する
- 実施: `filesSidebarModel.ts` を追加し、frontmatter検索field候補、value候補、filtering判定、検索mode表示を純粋処理へ移した。`FilesSidebarSearch.tsx`、`FilesSearchResults.tsx`、`FilesSidebarTreeSection.tsx`、`FilesWorkspaceActions.tsx` を追加し、`FilesSidebar.tsx` は選択状態、展開要求、子component組み立てを中心にした
- 確認: `pnpm exec vitest run src/renderer/filesSidebarModel.test.ts src/renderer/components/FilesSidebarSearch.test.tsx src/renderer/components/FilesSearchResults.test.tsx src/renderer/components/FileTree.test.tsx src/renderer/App.test.tsx`、`pnpm typecheck`、`pnpm test`、`git diff --check` が通過した。全体テストは70ファイル、485件が通過した
- 残り: 今回指定されたFilesSidebar分割単位は完了。実アプリ確認はUI/仕様を変えない内部component/model分離のため未実施

### ToolsSidebarツールフォーム責務分離

- 方向性: UI文言、CSS class名、DOM構造、各フォームの入力項目、IPC/preload API、保存形式、status文言を変えず、`ToolsSidebar.tsx` に残っていたtitle list、TOC、merge、splitのdraft状態、IPC入力生成、status整形、section描画を内部moduleへ分離する
- 実施: `toolsSidebarModel.ts` を追加し、各ツールdraft初期値、IPC入力生成、成功/失敗status整形、status error判定を純粋処理へ移した。`useToolsSidebarState.ts` を追加し、draft状態と実行handlerをhook化した。`ToolsSidebarSections.tsx` を追加し、title list、TOC、merge、split、共通status表示を分け、`ToolsSidebar.tsx` はworkspace有無分岐とsection組み立てに絞った
- 確認: `pnpm exec vitest run src/renderer/toolsSidebarModel.test.ts src/renderer/components/ToolsSidebar.test.tsx src/renderer/App.test.tsx`、`pnpm typecheck`、`pnpm test`、`git diff --check` が通過した。全体テストは71ファイル、491件が通過した
- 残り: 今回指定されたToolsSidebar分割単位は完了。実アプリ確認はUI/仕様を変えない内部component/hook/model分離のため未実施

### Editor context menu / frontmatter dialog責務分離

- 方向性: UI文言、CSS class名、DOM構造、右クリックメニュー項目、clipboard挙動、frontmatter追加dialog、CodeMirror extension構成、`Editor.tsx` の既存re-exportを変えず、`Editor.tsx` に残っていたcontext menu、clipboard、frontmatter dialog、補助候補判定を内部moduleへ分離する
- 実施: `editorContextMenuModel.ts` を追加し、context menu位置clampとfrontmatter dialog候補判定を純粋処理へ移した。`editorClipboard.ts` を追加し、renderer clipboard読み書きとElectron native menu判定を分けた。`useEditorContextMenu.ts` と `useEditorFrontmatterDialog.ts` を追加し、右クリックメニュー状態、copy/cut/paste/select all、frontmatter dialog状態とsubmit処理をhook化した。`EditorContextMenu.tsx` と `EditorFrontmatterDialog.tsx` を追加し、`Editor.tsx` はCodeMirror生成、props/ref同期、event bridge、子component組み立てに寄せた
- 確認: `pnpm exec vitest run src/renderer/editorContextMenuModel.test.ts src/renderer/components/Editor.test.tsx src/renderer/App.test.tsx`、`pnpm typecheck`、`pnpm test`、`git diff --check` が通過した。全体テストは72ファイル、493件が通過した
- 残り: 今回指定されたEditor追加分割単位は完了。実アプリ確認はUI/仕様を変えない内部component/hook/model分離のため未実施

### ChronicleTimeline純粋処理責務分離

- 方向性: UI文言、DOM構造、CSS、IPC/preload API、Gantt保存形式、`chronicleTimeline.ts` の既存import経路を変えず、年表/日付チャートの行生成、軸・目盛り、minimap/offscreen navigation、drag差分計算、定数を内部moduleへ分離する
- 実施: `chronicleTimelineConstants.ts`、`chronicleTimelineAxis.ts`、`chronicleTimelineRows.ts`、`chronicleTimelineNavigation.ts`、`chronicleTimelineDrag.ts` を追加し、`chronicleTimeline.ts` は既存named exportを維持するfacadeにした。追加で `chronicleTimelineAxis.test.ts` と `chronicleTimelineRows.test.ts` を追加し、分離後のmodule境界を直接確認した
- 確認: `pnpm exec vitest run src/renderer/chronicleTimelineAxis.test.ts src/renderer/chronicleTimelineRows.test.ts src/renderer/chronicleTimeline.test.ts src/renderer/components/ChronicleChartGrid.test.tsx src/renderer/hooks/useChronicleChartModel.test.tsx src/renderer/hooks/useChronicleChartViewport.test.tsx src/renderer/hooks/useChronicleEntryDrag.test.tsx src/renderer/App.test.tsx`、`pnpm typecheck`、`pnpm test`、`git diff --check` が通過した。全体テストは74ファイル、498件が通過した
- 残り: 今回指定されたChronicleTimeline追加分割単位は完了。実アプリ確認はUI/仕様を変えない内部module分離のため未実施

### Toolbar UI責務分離

- 方向性: UI文言、CSS class名、DOM構造、ボタン順、CodeMirrorコマンド、`Toolbar` と `insertBlockIds` の既存import経路を変えず、`Toolbar.tsx` に残っていたpanel状態、target view解決、表Markdown生成、ボタン群描画を内部moduleへ分離する
- 実施: `toolbarModel.ts` を追加し、heading level、panel class、表サイズ正規化、表Markdown生成を純粋処理へ移した。`useToolbarActions.ts` を追加し、target view記憶、panel開閉、各Markdown操作handlerをhook化した。`ToolbarButtonGroups.tsx` を追加し、inline、block、list、insertの各ボタン群を分け、`Toolbar.tsx` は既存exportを維持する組み立て役にした
- 確認: `pnpm exec vitest run src/renderer/toolbarModel.test.ts src/renderer/components/Toolbar.test.tsx src/renderer/App.test.tsx`、`pnpm typecheck`、`pnpm test`、`git diff --check` が通過した。全体テストは75ファイル、501件が通過した
- 残り: 今回指定されたToolbar分割単位は完了。実アプリ確認はUI/仕様を変えない内部component/hook/model分離のため未実施

### P23残り実施リスト正本化

- 方向性: P23の残りを無限に細分化せず、現時点で300行超または責務混在が明確な箇所を、正本上の実施リストとして固定する
- 実施: `残り実施リスト` を追加し、正本整備1件、主要リファクタリング10件、締め確認1件の順番と完了条件を明記した
- 確認: 文書更新のみのため、`git diff --check` を確認する。コードテストは不要
- 残り: 次は実施リスト2件目の `App.tsx orchestrator整理` から順番に進める

### App.tsx orchestrator整理

- 方向性: UI、store状態構造、IPC/preload API、PaneView/AppRail/AppEditorWorkspaceの呼び出し仕様を変えず、`App.tsx` に残っていたrail派生値、railからのtab open処理、panel/gantt tab rendererをhookへ分離する
- 実施: `useAppRailNavigation.tsx` を追加し、sidebar view定義の翻訳、panel/chart rail表示状態、rail button handler、sidebar panel化effect、panel tab icon描画を移した。`useAppTabRenderers.tsx` を追加し、Gantt chart tabとpanel tabのrender callbackを移した。`App.tsx` はstore/hook接続、主要callback、子component組み立てを中心にした
- 確認: `pnpm exec vitest run src/renderer/App.test.tsx src/renderer/appShellModel.test.ts`、`pnpm typecheck`、`pnpm test`、`git diff --check` が通過した。全体テストは75ファイル、501件が通過した
- 残り: 次は実施リスト3件目の `Editor table widget追加分割` に進む。実アプリ確認はUI/仕様を変えない内部hook分離のため未実施

### Editor table widget追加分割

- 方向性: Markdown table保存形式、CSS class、menu文言、操作順、CodeMirror decoration経路を変えず、`editorTableWidget.ts` に残っていたDOM補助、active state、drag/drop、context menu、edge add buttonを内部moduleへ分離する
- 実施: `editorTableWidgetDom.ts`、`editorTableWidgetState.ts`、`editorTableWidgetDrag.ts`、`editorTableWidgetMenu.ts` を追加し、EditorView解決/セルfocus/書き戻し、active/affordance状態、行列drag、context menu、edge add buttonを分けた。`TableWidget` はtable DOM組み立てと各moduleの接続を中心にした
- 確認: `pnpm exec vitest run src/renderer/editorTableModel.test.ts src/renderer/components/Editor.test.tsx`、`pnpm typecheck`、`pnpm test`、`git diff --check` が通過した。全体テストは75ファイル、501件が通過した
- 残り: 次は実施リスト4件目の `Editor frontmatter widget追加分割` に進む。実アプリ確認はUI/仕様を変えない内部DOM補助分離のため未実施

### Editor frontmatter widget追加分割

- 方向性: YAML仕様、UI文言、CSS class、frontmatter保存形式、CodeMirror decoration経路を変えず、`editorFrontmatterWidget.ts` に残っていたrow rendering、入力生成、field更新、collapse decorationを内部moduleへ分離する
- 実施: `editorFrontmatterWidgetDom.ts` を追加してヘッダー、追加行、YAML行に対応するrow描画を分けた。`editorFrontmatterWidgetInputs.ts` を追加してscalar/select/boolean/array/date/chronicle/complex YAML入力とwidget内event遮断を分けた。`editorFrontmatterWidget.ts` はcollapse状態、Decoration生成、frontmatter書き戻しを中心にした
- 確認: `pnpm exec vitest run src/renderer/editorFrontmatterModel.test.ts src/renderer/components/Editor.test.tsx`、`pnpm typecheck`、`pnpm test`、`git diff --check` が通過した。全体テストは75ファイル、501件が通過した
- 残り: 次は実施リスト5件目の `main IPC handler追加分割` に進む。実アプリ確認はUI/仕様を変えない内部DOM/input分離のため未実施

### main IPC handler追加分割

- 方向性: IPCチャンネル名、戻り値、エラーdetails、preload APIを変えず、`workspaceHandlers.ts`、`fileHandlers.ts`、`toolHandlers.ts` に残っていたhandler登録と個別処理をdomain別moduleへ分離する
- 実施: workspace系は状態構築、登録/切替、workspace data、preference保存へ分け、`workspaceHandlers.ts` は登録facadeと `buildWorkspaceState` re-exportにした。file系は検索/置換/読み取り、Markdownファイル操作、フォルダ/ゴミ箱操作へ分け、`fileHandlers.ts` は登録facadeにした。tool系はmerge/split/title list/TOCの処理を `toolActions.ts` へ移し、`toolHandlers.ts` はIPC登録と既存failure変換を中心にした
- 確認: `pnpm exec vitest run src/main/ipc/workspaceHandlers.test.ts src/main/ipc/fileHandlerValidators.test.ts src/main/ipc/workspaceHandlerValidators.test.ts src/main/files/markdownFiles.test.ts src/main/files/folders.test.ts src/main/files/replace.test.ts src/renderer/App.test.tsx`、`pnpm typecheck`、`pnpm test`、`git diff --check` が通過した。全体テストは75ファイル、501件が通過した
- 残り: 次は実施リスト6件目の `editorStore action分離` に進む。実アプリ確認はIPC/preload APIと戻り値を変えない内部handler分離のため未実施

### editorStore action分離

- 方向性: Zustandのstate shape、既存hook利用方法、PaneView/Appからの呼び出し方を変えず、`editorStore.ts` に同居していたpane/tab操作、panel/gantt/file tab操作、履歴更新補助を純粋helperへ分離する
- 実施: `editorStoreModel.ts` を追加し、file/panel/gantt tab open、tab close、active履歴更新、split toggle、close other/right/all、pane間move、file tab更新を純粋な状態遷移関数へ移した。`editorStore.ts` はZustand actionと設定更新の接続を中心にした。追加で `editorStoreModel.test.ts` を作り、同path file再利用、共有tab close、無効move no-op、split解除時のpane統合を直接確認した
- 確認: `pnpm exec vitest run src/renderer/store/editorStoreModel.test.ts src/renderer/store/editorStore.test.ts src/renderer/components/PaneView.test.tsx src/renderer/App.test.tsx`、`pnpm typecheck`、`pnpm test`、`git diff --check` が通過した。全体テストは76ファイル、505件が通過した
- 残り: 次は実施リスト7件目の `ChronicleChartGrid描画追加分割` に進む。実アプリ確認はstore状態構造とUIを変えない内部model分離のため未実施

### ChronicleChartGrid描画追加分割

- 方向性: DOM class、ARIA、drag挙動、表示文言、Gantt/Chronicleデータ処理を変えず、`ChronicleChartGrid.tsx` に残っていたname column、tracks、entry bar描画をcomponentへ分離する
- 実施: `ChronicleNameColumn.tsx` を追加してファイル名列、date planned/actual summary、chronicle period jumpを移した。`ChronicleTracks.tsx` を追加してguide/today lineの配置、entry bar、resize handle、drag preview反映を移した。`ChronicleChartGrid.tsx` はchart外枠、offscreen jump、axis、子component組み立てを中心にした
- 確認: `pnpm exec vitest run src/renderer/components/ChronicleChartGrid.test.tsx src/renderer/hooks/useChronicleChartModel.test.tsx src/renderer/hooks/useChronicleChartViewport.test.tsx src/renderer/hooks/useChronicleEntryDrag.test.tsx src/renderer/App.test.tsx`、`pnpm typecheck`、`pnpm test`、`git diff --check` が通過した。全体テストは76ファイル、505件が通過した
- 残り: 次は実施リスト8件目の `Graph layout model追加分割` に進む。実アプリ確認はUI/仕様を変えない内部component分離のため未実施

### Graph layout model追加分割

- 方向性: 既存の `graphLayout.ts` named export経路、Graph UI、store状態構造を変えず、filter/group/stats、layout初期化、simulation tick、viewBoxを内部moduleへ分ける
- 実施: `graphLayoutTypes.ts`、`graphLayoutConstants.ts`、`graphLayoutFilters.ts`、`graphLayoutView.ts`、`graphLayoutSimulation.ts` を追加し、型/定数、folder/tag候補、filter/local graph/group/stats、viewBox、初期layoutとsimulation tickを分離した。`graphLayout.ts` は既存import経路を維持するfacadeにした
- 確認: `pnpm exec vitest run src/renderer/graphLayout.test.ts src/renderer/hooks/useGraphSimulation.test.tsx src/renderer/hooks/useGraphPanelModel.test.tsx src/renderer/hooks/useGraphViewportInteractions.test.tsx src/renderer/components/GraphSidebar.test.tsx src/renderer/App.test.tsx`、`pnpm typecheck`、`pnpm test`、`git diff --check` が通過した。全体テストは76ファイル、505件が通過した
- 残り: 次は実施リスト9件目の `Gantt/frontmatter data処理分割` に進む。実アプリ確認はUI/仕様を変えない内部model分離のため未実施

### Gantt/frontmatter data処理分割

- 方向性: Gantt保存形式、frontmatter書き換え形式、date/chronicle fallback挙動、`ganttChartData.ts` の既存export経路を変えず、chart正規化、date chart読取、frontmatter read/write、IPC fallbackをmodule分割する
- 実施: `ganttChartNormalize.ts` に現行/legacy chart正規化を移し、`ganttChartDateEntries.ts` にMarkdown frontmatterからのdate chart補完を移した。`ganttChartFrontmatter.ts` にfrontmatter block解析、YAML配列field read/write、date/chronicle連動更新を移し、`ganttChartFallback.ts` にIPC未提供時の読み書きfallbackを移した。`ganttChartData.ts` は既存named exportを維持するfacadeにした
- 確認: `pnpm exec vitest run src/renderer/ganttChartData.test.ts src/renderer/components/ChronicleChartGrid.test.tsx src/renderer/App.test.tsx`、`pnpm typecheck`、`pnpm test`、`git diff --check` が通過した。全体テストは76ファイル、505件が通過した
- 残り: 次は実施リスト10件目の `main file domain追加分割` に進む。実アプリ確認は保存形式とUIを変えない内部data処理分離のため未実施

### main file domain追加分割

- 方向性: ファイル操作仕様、リンク更新仕様、エラーコード、IPC/preload APIを変えず、main file domainに残っていたファイル名検証、path変換、リンク更新純粋処理、置換regex処理を必要範囲で分離する
- 実施: `fileSystem.ts` を追加してerrno判定、path存在確認、error details化を共通化した。`markdownFilePaths.ts` にMarkdownファイル名正規化、移動/rename/copy先path生成を移した。`linkUpdaterModel.ts` にwiki link置換、link body parse、code fence maskを移し、`linkUpdater.ts` はworkspace走査と読み書きに絞った。`replaceModel.ts` に置換regex構築とpreview行生成を移した
- 確認: `pnpm exec vitest run src/main/files/markdownFiles.test.ts src/main/files/linkUpdater.test.ts src/main/files/folders.test.ts src/main/files/replace.test.ts src/main/files/paths.test.ts src/main/ipc/fileHandlerValidators.test.ts src/renderer/App.test.tsx`、`pnpm typecheck`、`pnpm test`、`git diff --check` が通過した。全体テストは76ファイル、505件が通過した
- 残り: 次は実施リスト11件目の `残存300行級UI/modelの仕上げ` に進む。実アプリ確認はファイル操作仕様とUIを変えない内部helper分離のため未実施

### 残存300行級UI/modelの仕上げ - file mutation hook

- 方向性: UI文言、確認dialog文言、ファイル操作仕様、IPC/preload API、store状態構造を変えず、`useWorkspaceFileMutationActions.ts` に残っていたactive file tab判定、folder path生成、delete対象tab算出を純粋helperへ分離する
- 実施: `workspaceFileMutationModel.ts` を追加し、active file tab取得、移動/rename後folder path生成、削除確認文言、単体/複数tree item削除時のtab close対象算出を移した。`useWorkspaceFileMutationActions.ts` はIPC呼び出し、state更新、hook callback接続を中心にした
- 確認: `pnpm exec vitest run src/renderer/hooks/workspaceFileMutationModel.test.ts src/renderer/hooks/workspaceFileActionHelpers.test.ts src/renderer/App.test.tsx`、`pnpm typecheck`、`pnpm test`、`git diff --check` が通過した。全体テストは77ファイル、509件が通過した
- 残り: 11番内の次の小分けとして `RailNavigation.tsx`、`ToolsSidebarSections.tsx`、`dashboardModel.ts` を確認する。実アプリ確認はUI文言とファイル操作仕様を変えない内部model分離のため未実施

### 残存300行級UI/modelの仕上げ - RailNavigation

- 方向性: UI文言、SVG、workspace switcherのDOM class、context menu項目、既存import経路を変えず、`RailNavigation.tsx` に残っていたicon/view定義、context menu位置計算、workspace switcher描画を分離する
- 実施: `RailNavigationIcons.tsx` にrail icon群と `sidebarViewDefs` を移し、`RailWorkspaceSwitcher.tsx` にworkspace switcherのrename/context menu描画を移した。`railNavigationModel.ts` に `fixedMenuPosition` を移し、`RailNavigation.tsx` は既存named exportを維持するfacadeにした
- 確認: `pnpm exec vitest run src/renderer/App.test.tsx`、`pnpm typecheck`、`pnpm test`、`git diff --check` が通過した。全体テストは77ファイル、509件が通過した
- 残り: 11番内の次の小分けとして `ToolsSidebarSections.tsx`、`dashboardModel.ts` を確認する。実アプリ確認はUI文言とDOM classを変えない内部component分離のため未実施

### 残存300行級UI/modelの仕上げ - ToolsSidebarSections

- 方向性: UI文言、DOM class、フォーム項目、status文言、`ToolsSidebar.tsx` からの既存import経路を変えず、`ToolsSidebarSections.tsx` にまとまっていた各tool section描画を小さいcomponentへ分離する
- 実施: `ToolStatus.tsx` にstatus表示、`ToolsSidebarTitleSections.tsx` にtitle list/TOC、`ToolsSidebarMergeSections.tsx` にmerge/splitを移した。`ToolsSidebarSections.tsx` は既存named exportを維持するfacadeにした
- 確認: `pnpm exec vitest run src/renderer/components/ToolsSidebar.test.tsx src/renderer/toolsSidebarModel.test.ts src/renderer/App.test.tsx`、`pnpm typecheck`、`pnpm test`、`git diff --check` が通過した。全体テストは77ファイル、509件が通過した
- 残り: 11番内の次の小分けとして `dashboardModel.ts` を確認する。実アプリ確認はUI文言とDOM classを変えない内部component分離のため未実施

### 残存300行級UI/modelの仕上げ - dashboardModel

- 方向性: Dashboardの表示、集計値、frontmatter解析、treemap/donut描画用データ、`DashboardPanel.tsx` からの既存export経路を変えず、`dashboardModel.ts` に残っていた型、Markdown/frontmatter解析、chart補助を分離する
- 実施: `dashboardTypes.ts` にDashboard型、`dashboardStats.ts` にMarkdown/frontmatter解析と統計/property分布、`dashboardCharts.ts` に数値format、percentage、treemap、donut gradientを移した。`dashboardModel.ts` は既存named exportを維持するfacadeにした
- 確認: `pnpm exec vitest run src/renderer/dashboardModel.test.ts src/renderer/components/DashboardPanel.test.tsx src/renderer/App.test.tsx`、`pnpm typecheck`、`pnpm test`、`git diff --check` が通過した。全体テストは77ファイル、509件が通過した
- 残り: 実施リスト11件目は完了。次は12件目の `P23締め確認` に進む。実アプリ確認はUI表示と集計仕様を変えない内部model分離のため未実施

### P23締め確認

- 方向性: 正本化した12件の残り実施リストを完了扱いにできるか、大型ファイル一覧、自動テスト、型検査、diff whitespaceで最終確認する
- 実施: 12件の残り実施リストをすべて完了にした。大型ファイル一覧は `rg --files app/src | xargs wc -l | sort -nr | head -n 40` で確認した
- 確認: `pnpm typecheck`、`pnpm test`、`git diff --check` が通過した。全体テストは77ファイル、509件が通過した
- 完了判断: P23で合意した残り実施リストは完了。UI、保存形式、IPC/preload API、store状態構造、既存import経路は変更していない
- 残した意図的な未分割箇所: `styles.css`、テスト、locale JSON、`shared/ipc.ts` は今回の責務分離対象外。`App.tsx` はcomposition rootとしてstore/hook接続と子component組み立てを残す。`editorStoreModel.ts`、`editorFrontmatterModel.ts`、`editorFrontmatterWidgetInputs.ts`、`toolActions.ts`、`chronicleTimelineAxis.ts` は300行超だが、現時点では純粋処理または単一責務に寄っており、P23の「責務混在が明確な箇所」の対象からは外す
- 実アプリ未確認理由: 今回の残り実施リストはUI文言、DOM class、保存形式、IPC/preload APIを変えない内部module/component/hook/model分離であり、自動テストと型検査で差分確認できたため、実アプリ確認は未実施

## 文書・実装完全整合整理 実施リスト

P23の追加整理として、実装アプリを正にして文書側を現行実装へ合わせる。
コードは変更しない。
`docs/journal/`、`docs/archive/`、過去フェーズ文書は履歴として扱い、過去記録の意味を壊さない。
各単位は順番に実施し、対象文書更新、検証、P23正本更新、コミットまでを1セットにする。

1. [x] **文書棚卸し・分類**
   - 現行正本、履歴、アーカイブ、テンプレートを分類する。
   - 現行判断に使う文書と、履歴として残す文書を明確にする。
2. [x] **README・AI入口・索引整理**
   - `README.md`、`AI.md`、`AGENTS.md`、`CLAUDE.md`、`docs/INDEX.md`、`docs/_rules.md` を現行運用へ合わせる。
   - 参照先、起動手順、検証手順、文書導線を確認する。
3. [x] **product文書・用語集整理**
   - `docs/product/PLAN.md`、`principles.md`、`project.md`、`glossary.md` を実装済み機能と現行用語へ合わせる。
   - タブ、右パネル、チャート、フロントマター、ファイル加工、ワークスペース用語を統一する。
4. [x] **仕様書全件整理**
   - `docs/spec/` 全件を、実装のUI導線、操作、保存形式、制限事項へ合わせる。
   - エディタ、検索、ファイル管理、リンク/タグ、Markdown、フロントマター、コマンドパレット、ファイル加工を確認する。
5. [x] **UI文書整理**
   - `docs/ui/DESIGN.md`、`screens-macos.md`、`navigation.md` を現行画面構成へ合わせる。
   - 左レール、ファイルサイドバー、メインエリア、パネルタブ、チャートタブ、右パネルの説明を統一する。
6. [x] **architecture文書整理**
   - `docs/architecture/overview.md`、`data-model.md`、`decisions.md` をP23後のmain/preload/renderer責務、IPC境界、設定保存、派生データ生成へ合わせる。
7. [x] **tech文書整理**
   - `docs/tech/stack.md`、`editor-engine.md` を現行依存関係、CodeMirror/marked/DOMPurify/KaTeX/js-yaml、Electron Forge/pnpm/Vitest構成へ合わせる。
8. [x] **dev運用文書整理**
   - `docs/dev/conventions.md`、`testing.md`、`open-questions.md`、`template.md` を現行フェーズ運用・検証方針・編集ルールと照合する。
   - 実体のない古い運用参照は現行正本に合わせる。
9. [ ] **履歴・アーカイブの扱い整理**
   - `docs/journal/` と `docs/archive/` は履歴として原則書き換えない。
   - 現行正本から履歴を参照する必要がある場合だけ、履歴資料であることが分かる形に整理する。
10. [ ] **横断検証・P23締め更新**
    - Markdownリンク、索引、参照語、現行実装との矛盾を再確認する。
    - `pnpm typecheck`、`pnpm test`、`git diff --check` を実行する。
    - P23正本に完了判断、残した履歴文書の扱い、実アプリ未確認理由を記録する。

完了条件:

- 各単位ごとに文書差分を確認し、`git diff --check` を確認する。
- 仕様・技術・UI・用語整理後に、実装との静的照合を行う。
- 最後に `pnpm typecheck`、`pnpm test`、`git diff --check` を確認する。
- 実アプリ操作と配布ビルドは、文書整合整理の基本範囲外とする。

### 文書棚卸し・分類

- 方向性: P23追加整理では、現行正本と履歴・アーカイブ・テンプレートを分け、現行実装との整合確認対象を明確にする
- 実施: `docs/INDEX.md` に文書分類を追加し、`docs/_rules.md` に現行正本と履歴文書を混同しない運用を明記した。日誌とアーカイブは過去記録として残し、実装との整合修正は正本文書側で行う扱いにした
- 確認: `git diff --check` が通過した
- 残り: 次は `README・AI入口・索引整理` に進む

### README・AI入口・索引整理

- 方向性: ルート入口と文書索引は、現行正本への導線だけを持たせ、履歴・アーカイブを正本として読まない運用にそろえる
- 実施: `README.md` のドキュメント案内に索引、用語集、UI文書、開発規約・テスト方針を追加し、履歴資料の扱いを明記した。`AI.md` には `docs/INDEX.md` の分類参照と `docs/archive/` を現行判断に使わないことを追加し、仕様書作成時のヒアリング表現を現在の利用可能ツールに依存しない形へ直した。`AGENTS.md` と `CLAUDE.md` は薄い入口として正しいため編集しない判断を `docs/INDEX.md` と `docs/_rules.md` に反映した
- 確認: `git diff --check` が通過した
- 残り: 次は `product文書・用語集整理` に進む

### product文書・用語集整理

- 方向性: product文書と用語集を、P20以降に実装済みのダッシュボード、グラフ、チャート、右パネル、機能トグル、フロントマター固定/カスタムプロパティの現行用語へ合わせる
- 実施: `docs/product/PLAN.md` にアウトゴーイングリンク、右パネル、ダッシュボード、グラフ、年表 / 日付チャート、設定を現行機能として追加し、機能トグル対象を実装どおりファイル加工ツール、フロントマター設定、右パネルに限定した。`docs/product/principles.md` の参照機能にグラフと年表 / 日付チャートを加えた。`docs/product/glossary.md` に固定プロパティ、カスタムプロパティ、年表チャート、日付チャート、設定、機能トグルを追加した
- 確認: `git diff --check` が通過した
- 残り: 次は `仕様書全件整理` に進む

### 仕様書全件整理

- 方向性: `docs/spec/` は実装済みのUI導線、ショートカット、保存形式、制限事項を正とし、未実装の期待値を仕様として残さない
- 実施: ナビゲーション仕様から未実装の `⌘⇧F` を外し、実装済みの `⌘⇧T` を追加した。検索仕様はファイルサイドバー検索へ統一した。コマンドパレット仕様では、アクティブファイル名変更コマンドの実挙動をファイルサイドバーへの導線として明記した。エディタ、Markdown、フロントマター、ファイル加工仕様は、空コードフェンス挿入、画像プレースホルダー、marked / DOMPurify / highlight.js / KaTeX、現行UIにない全ファイル一括削除、タイトル一覧のフォルダ絞り込みへ合わせた
- 確認: `git diff --check` が通過した
- 残り: 次は `UI文書整理` に進む

### UI文書整理

- 方向性: UI文書は、現行の左レール順、ファイルサイドバー、共有ツールバー、メインエリアのファイル / パネル / チャートタブ、右パネルの構成を正として記述する
- 実施: `docs/ui/screens-macos.md` の全体レイアウトに共有ツールバーと開閉式右パネルを反映し、左レール順を実装の `files / dashboard / graph / tools / frontmatter / chronicle / settings` に合わせた。チャートタブの対象を `chronicle`、`plannedDate`、`actualDate`、互換用 `date` に更新し、右パネル機能トグルの挙動を追記した。`docs/ui/navigation.md` も同じレール順と機能トグル説明にそろえた。`docs/ui/DESIGN.md` は実装CSSに合わせ、UIフォントをシステムフォント、等幅表示を Menlo / SF Mono / Consolas 系として整理した
- 確認: `git diff --check` が通過した
- 残り: 次は `architecture文書整理` に進む

### architecture文書整理

- 方向性: architecture文書は、P23後の main / preload / renderer 境界、IPC経由のファイル操作、JSON設定保存、要求時生成の派生データを正として記述する
- 実施: `docs/architecture/overview.md` に preload / contextBridge と `window.relic` API境界を追加し、アウトラインとアウトゴーイングリンクはレンダラー導出、検索・バックリンク・タグ・別名・グラフ・チャートはメイン生成として責務を分けた。ファイル加工ツールとチャート編集時のフロントマター書き戻しもメイン責務へ明記した。`docs/architecture/data-model.md` では画像を独立管理モデルではなくMarkdown画像記法として整理し、グラフがWikiリンクと通常Markdownリンクから派生すること、日付チャートが `plannedDate` / `actualDate` と互換用 `date` から生成されることを反映した。`docs/architecture/decisions.md` の画像判断も、現行実装の画像プレースホルダー表示へ合わせた
- 確認: `git diff --check` が通過した
- 残り: 次は `tech文書整理` に進む

### tech文書整理

- 方向性: tech文書は `app/package.json`、Electron Forge / Vite設定、Vitest設定、CodeMirror / Markdown preview / YAML処理の実依存関係を正として整理する
- 実施: `docs/tech/stack.md` に `app/` 配下管理、`pnpm@10.10.0`、TypeScript 5.8、Electron 36、React 19、Electron Forge 7 + Vite plugin、Vite 6、Vitest 3 + jsdom + React Testing Library + jest-dom、macOS ZIP/DMG と Windows ZIP maker構成を追加した。Markdown処理には `marked-footnote` を加えた。`docs/tech/editor-engine.md` には `@codemirror/autocomplete`、`@codemirror/commands`、`@codemirror/theme-one-dark`、`marked-footnote` と、`editorExtensions.ts`、`editorLivePreview.ts`、`previewMarkdown.ts`、frontmatter関連実装位置を追記した
- 確認: `git diff --check` が通過した
- 残り: 次は `dev運用文書整理` に進む

### dev運用文書整理

- 方向性: dev運用文書は、P23の現在フェーズ運用、`app/` 配下の検証コマンド、文書整理時の確認単位、履歴を溜めない未決定事項運用へ合わせる
- 実施: `docs/dev/conventions.md` の画像方針を、実画像読み込みではなくMarkdown画像記法のプレースホルダー表示へ統一した。`docs/dev/testing.md` には文書整理単位の `git diff --check`、P23締めの `pnpm typecheck` / `pnpm test` / `git diff --check`、`app/` 配下で実行する検証コマンドを明記した。`docs/dev/open-questions.md` は現在未決定なしを保ち、解決済み経緯を溜めず日誌・過去フェーズ・反映先正本で確認する運用へ整理した。`docs/dev/template.md` には汎用テンプレートとして検証導線と実行場所明記の原則を追加した
- 確認: `git diff --check` が通過した
- 残り: 次は `履歴・アーカイブの扱い整理` に進む
