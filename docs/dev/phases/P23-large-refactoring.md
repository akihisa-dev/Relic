# P23-large-refactoring.md

Relicの大規模リファクタリングフェーズの正本。

このフェーズでは、既存挙動を保ったまま、肥大化したコード、責務が混ざった処理、検証しづらい構造を段階的に整理する。
ただし、具体的なリファクタリング対象はユーザーが指定したもの、またはコード確認後にユーザーへ提示して合意したものだけを対象にする。

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
