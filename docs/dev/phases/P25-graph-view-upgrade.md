# P25-graph-view-upgrade.md

Relicのグラフビューアップグレードフェーズの正本。

このフェーズでは、グラフビューの見やすさ、操作しやすさ、表示制御、グラフ操作パネルの挙動を、既存データと既存機能を壊さず段階的に改善する。
ただし、具体的な変更対象はユーザーが指定したもの、または調査後にユーザーへ提示して合意したものだけを対象にする。

---

## 読み込みルール

Relicのグラフビューアップグレードフェーズ。

AIはこのフェーズを前提にユーザーへ接する。
対象はグラフビュー内の表示、操作、フィルタ、グループ化、力学設定、操作パネル、関連する軽微な内部整理であり、保存形式変更、IPC/preload API変更、store状態構造変更、グラフ以外のUI変更へ広げる場合は、事前にユーザーへ確認する。

最初に読む:

- この文書

必要になったときだけ読む:

- 実装規約: `../conventions.md`
- テスト方針: `../testing.md`
- グラフ関連の実装: `../../../app/src/main/files/graph.ts`, `../../../app/src/renderer/store/graphStore.ts`, `../../../app/src/renderer/graphLayout*.ts`, `../../../app/src/renderer/components/Graph*.tsx`, `../../../app/src/renderer/hooks/useGraph*.ts`
- UI挙動に触れる場合: `../../ui/screens-macos.md`, `../../ui/navigation.md`, `../../ui/DESIGN.md`
- アーキテクチャ前提に触れる場合: `../../architecture/overview.md`, `../../architecture/decisions.md`

注意:

- ユーザーが指定したグラフビュー変更、または調査後にユーザーへ提示して合意した対象だけを扱う
- 実装前に、対象、問題、変更範囲、変えてはいけない挙動、検証方法を明示する
- UI変更では、指定された画面・場所・操作対象だけを変更する
- 保存形式変更、IPC/preload API変更、store状態構造変更が必要になった場合は、P25内の通常作業から分けて確認する
- 変更後は対象に応じたテスト、`pnpm typecheck`、`pnpm test`、`git diff --check` の必要範囲を確認する
- 実アプリ確認が必要な挙動は、確認した範囲と未確認理由を記録する

---

## フェーズの目的

- グラフビューの初期表示と操作入口を、実利用で迷いにくい状態にする
- ノード、リンク、ラベル、フィルタ、グループ化、力学調整の視認性と操作性を改善する
- グラフ描画、保存データ、既存ファイル操作を壊さず、変更単位ごとに検証する
- 次回作業者が判断できる粒度で、実施したことだけを簡潔に記録する

---

## 作業方針

- 1回の作業は、グラフビュー内の問題単位または近い原因を共有する小さなまとまりに分ける
- 実装前に、対象、今の問題、変更範囲、変えない挙動、検証方法を明示する
- ユーザーの指定範囲を越える修正候補は、実装せず提案として分ける
- 保存形式変更、IPC/preload API変更、store状態構造変更、グラフビュー外のUI変更を混ぜない
- 変更後は、対象テスト、関連回帰テスト、型検査、全体テスト、diff whitespaceの必要範囲を確認する
- このフェーズ文書には日誌を書かない。日付順の作業履歴は `docs/journal/` に分ける

---

## 開始時チェック

グラフビュー変更対象ごとに、実装前に以下を確認する。

- [ ] 対象ファイル・対象画面・対象操作
- [ ] 今の問題、または修正したい違和感
- [ ] 変更してよい範囲
- [ ] 変えてはいけない既存挙動
- [ ] 仕様・UI・保存形式・IPC/preload APIへの影響有無
- [ ] 最初に作る最小修正
- [ ] 自動テストで確認する範囲
- [ ] 実アプリ確認が必要な範囲

---

## 修正管理

P25では、事前に固定した長い実施リストは置かない。
ユーザー指定、または調査で合意したグラフビュー改善単位ごとに、この文書の「進捗」へ実施したことだけを簡潔に記録する。

完了条件:

- 合意したグラフビュー改善単位が完了している
- 変更範囲に応じた自動テスト、`pnpm typecheck`、`pnpm test`、`git diff --check` の必要範囲を確認している
- 実アプリ確認が必要な項目は、確認結果または未確認理由を記録している
- 次フェーズへ移る場合は、ユーザーが明示している

---

## 進捗

このフェーズでは、修正単位ごとに次回作業時の判断に必要な状態だけを記録する。
日付順の作業ログ、感想、細かな経緯はここに書かない。

必要な確認結果や未確認事項がある場合も、実施内容の一部として短くまとめる。

### フェーズ開始

- `docs/dev/phases.md` の現在フェーズをP25へ変更し、P25正本を追加した。
- 最初の実装対象を、グラフビュー右上のホバー操作メニューをデフォルトで閉じる変更にした。

### グラフ操作パネル初期状態変更

- `GraphControls` の初期 `isMinimized` を `true` に変更し、グラフビュー右上のホバー操作パネルを初期表示では閉じた状態にした。
- `GraphControls.test.tsx` と `App.test.tsx` を、初期状態では「展開」ボタンが表示される前提へ更新した。
- `pnpm exec vitest run src/renderer/components/GraphControls.test.tsx src/renderer/components/GraphSidebar.test.tsx src/renderer/App.test.tsx`、`pnpm typecheck`、`pnpm test`、`git diff --check` が通過した。全体テストは78ファイル、523件が通過した。
- Electron実機で実ワークスペースを開いた状態の目視確認は未実施。

### 正本記録形式の簡略化

- `AI.md` の作業記録ルールを、方向性、実施、確認、残りの4項目形式から、実施したことだけを簡潔に書く形式へ変更した。
- P25正本の記録ルールと既存進捗を同じ形式へ整理した。

### グラフ操作パネル開閉モーション調整

- グラフビュー右上のホバー操作パネルについて、最小化ボタンと展開パネルの切り替え時に、外枠の幅、最大高さ、余白、影、透明度、位置が連動して遷移するようCSSを調整した。
- 展開時のパネル本体と最小化ボタンに短い出現アニメーションを追加し、低モーション設定では既存の短縮ルールへ含めるようにした。
- `pnpm exec vitest run src/renderer/components/GraphControls.test.tsx src/renderer/components/GraphSidebar.test.tsx`、`pnpm typecheck`、`git diff --check` が通過した。Electron実機での目視確認は未実施。

### グラフビュー演出改善

- グラフビューのクリックとEnterキーによるファイルオープン挙動を維持したまま、ノードの常時呼吸、ホバー/キーボードフォーカス時の鼓動、接続リンクの光の伝播、ホバー解除後約1秒の余韻表示を追加した。
- 演出用に `hoveredPath` と `afterglowPath` を分け、`motionPath` だけを伝播と鼓動のトリガーに使うようにした。低モーション設定では新規アニメーションも既存の短縮ルールへ含めた。
- `pnpm exec vitest run src/renderer/components/GraphCanvasLayers.test.tsx src/renderer/components/GraphCanvas.test.tsx src/renderer/hooks/useGraphCanvasInteractions.test.tsx src/renderer/hooks/useGraphPanelModel.test.tsx`、`pnpm typecheck`、`git diff --check` が通過した。Electron実機での目視確認は未実施。

### グラフノードの二段階クリック化

- グラフビューの未選択ノードをクリックした場合は選択だけ行い、選択済みノードを改めてクリックした場合だけファイルを開くようにした。ダブルクリック判定は追加せず、EnterキーとSpaceキーは選択だけを行う。
- クリック開始時点で選択済みだったかを判定し、初回クリックの `pointerDown` による選択更新ではファイルを開かないようにした。グラフビュー内のドラッグ、ホバー演出、余韻表示は維持した。
- `pnpm exec vitest run src/renderer/hooks/useGraphNodeInteractions.test.tsx src/renderer/hooks/useGraphCanvasInteractions.test.tsx src/renderer/hooks/useGraphPanelModel.test.tsx src/renderer/components/GraphCanvas.test.tsx src/renderer/components/GraphCanvasLayers.test.tsx`、`pnpm typecheck`、`git diff --check` が通過した。Electron実機での目視確認は未実施。
