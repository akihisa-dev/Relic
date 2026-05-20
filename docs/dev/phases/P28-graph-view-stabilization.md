# P28-graph-view-stabilization.md

Relicのグラフビュー安定化フェーズの正本。

このフェーズでは、PixiJS/d3-force化したグラフビューを、1000ノード級でも見た目、操作、読み込み、描画更新が安定して使える状態へ整える。

---

## 読み込みルール

AIはこのフェーズを前提にユーザーへ接する。

最初に読む:

- この文書
- `../conventions.md`
- `../testing.md`

必要になったときだけ読む:

- グラフ関連の実装: `../../../app/src/main/files/graph.ts`, `../../../app/src/renderer/store/graphStore.ts`, `../../../app/src/renderer/graphLayout*.ts`, `../../../app/src/renderer/graphRenderModel.ts`, `../../../app/src/renderer/components/Graph*.tsx`, `../../../app/src/renderer/hooks/useGraph*.ts`, `../../../app/src/renderer/workers/graphSimulationWorker.ts`
- 対象機能に関係する仕様: `../../spec/`
- 対象画面に関係するUI文書: `../../ui/`
- アーキテクチャ前提に触れる場合: `../../architecture/overview.md`, `../../architecture/decisions.md`

注意:

- ユーザーが指定したグラフビューの違和感、不安定さ、重さ、見た目の差分、または調査後にユーザーへ提示して合意した対象だけを扱う
- 実装前に、対象、問題、変更範囲、変えてはいけない挙動、検証方法を明示する
- 既存のMarkdownファイル、グラフデータ生成の外部契約、IPC/preload API、保存形式、store状態構造を変更する必要がある場合は、P28内の通常作業から分けて確認する
- `app/out/` 配下の配布版は、ユーザーが明示した場合以外は確認対象にしない
- 変更後は対象に応じたテスト、`pnpm typecheck`、`pnpm test`、`git diff --check` の必要範囲を確認する
- 実アプリ確認が必要な項目は、確認した範囲と未確認理由を記録する

---

## フェーズの目的

- グラフビューの初期表示、ズーム、パン、hover、選択、ドラッグが破綻しない状態にする
- 1000ノード級で読み込み、simulation、Pixi描画更新が操作不能にならない状態にする
- Obsidianを基準に、グラフの密度、強調、ラベル、リンク、ズーム感を安定させる
- 既存データ、Markdown本文、保存形式、IPC/preload APIを壊さず、変更単位ごとに検証する
- 次回作業者が判断できる粒度で、実施したことだけを簡潔に記録する

---

## 作業方針

- 1回の作業は、グラフビュー内の安定化対象または近い原因を共有する小さなまとまりに分ける
- 原因が見た目、layout、simulation、Pixi描画、読み込み、操作入力のどこにあるかを絞ってから修正する
- ユーザーの指定範囲を越える修正候補は、実装せず提案として分ける
- パフォーマンス改善と仕様変更を混ぜない
- 実機目視が必要な変更では、開発版Electronだけを対象にし、確認できなかった場合は未確認理由を残す
- このフェーズ文書には日誌を書かない。日付順の作業履歴は `docs/journal/` に分ける

---

## 修正管理

P28では、事前に固定した長い実施リストは置かない。
ユーザー指定、または調査で合意した安定化単位ごとに、この文書の「進捗」へ実施したことだけを簡潔に記録する。

完了条件:

- 合意したグラフビュー安定化単位が完了している
- 変更範囲に応じた自動テスト、`pnpm typecheck`、`pnpm test`、`git diff --check` の必要範囲を確認している
- 実アプリ確認が必要な項目は、確認結果または未確認理由を記録している
- 次フェーズへ移る場合は、ユーザーが明示している

---

## 進捗

このフェーズでは、修正単位ごとに次回作業時の判断に必要な状態だけを記録する。

### フェーズ開始

- ユーザー指示により、P28グラフビュー安定化フェーズを開始した。
- グラフキャンバスのPixi表示を等倍スケール化し、ノードの楕円化、巨大ラベル、過大な選択リング、太い強調リンク、大規模グラフの密度とfit表示をObsidian風に調整した。
- 拡大時のラベル荒れを抑えるためPixi Textの解像度と画面上スケールを補正し、Obsidian画像に合わせて通常ノードとリンクの濃度を調整した。
- simulation tickの座標更新をReact再renderから分離し、Pixi描画ループがpointsRefを直接読んでフレーム補間する構成にして、1000ノード級のパン、ズーム、描画更新の滑らかさを改善した。
- Obsidian画像へさらに寄せるため、degree由来のノードサイズ差、大規模時の選択リング、選択だけで出るラベルを外し、均一ノード、濃い通常リンク、詰まったstandard layoutへ調整した。
- Obsidianの実ノードに寄せるため、ノードを縁なしの高不透明度ベタ丸にし、ズーム時は一定範囲で画面上の半径が大きく見えるよう補正した。
- Obsidianの拡大表示に合わせて、通常リンクの画面上線幅とノード半径の基準値を上げ、線とノードが細く小さく見えすぎないよう調整した。
- hoverだけで接続線が濃く太くなる挙動とmotion線を外し、線の強調は選択済みノード由来に限定した。
- 開発版Electronでの目視確認は未実施。今回の変更は描画モデル、layout、GraphCanvas関連テスト、型チェック、全Vitest、diff checkで確認した。
- グラフ設定メニューのドラッグ移動を廃止し、Obsidian基準に合わせて右上固定表示へ戻した。`pnpm exec vitest run src/renderer/components/GraphControls.test.tsx src/renderer/components/GraphSidebar.test.tsx src/renderer/App.test.tsx`、`pnpm typecheck`、`pnpm test`、`git diff --check` が通過した。
- 最大ズーム上限を28へ引き上げ、Pixiラベル位置をノードへ近づけた。`pnpm exec vitest run src/renderer/graphLayout.test.ts src/renderer/components/GraphCanvas.test.tsx src/renderer/graphRenderModel.test.ts`、`pnpm typecheck`、`pnpm test`、`git diff --check` が通過した。
- 最大ズーム上限を80へ再調整し、ズーム時のラベル画面サイズを拡大する補正へ変更したうえで、ラベルをノード直下中央へ配置した。`pnpm exec vitest run src/renderer/graphLayout.test.ts src/renderer/components/GraphCanvas.test.tsx src/renderer/graphRenderModel.test.ts`、`pnpm typecheck`、`pnpm test`、`git diff --check` が通過した。
- 継続simulationによるゆらぎを止め、hover由来のfocus/afterglow強調を無効化した。大規模グラフのラベルは読めるズーム距離でhoverなしでも表示し、過密時は重なりを避けるため間引くよう調整した。`pnpm exec vitest run src/renderer/hooks/useGraphSimulation.test.tsx src/renderer/hooks/useGraphPanelModel.test.tsx src/renderer/hooks/useGraphNodeInteractions.test.tsx src/renderer/hooks/useGraphCanvasInteractions.test.tsx src/renderer/graphRenderModel.test.ts src/renderer/components/GraphCanvas.test.tsx`、`pnpm typecheck`、`pnpm test`、`git diff --check` が通過した。
- クリック選択によるグラフ強調を描画から外し、hover中ノードの近傍だけをObsidian風に強調するよう戻した。グラフ設定メニューは初期状態で右側に開き、各セクションも展開状態にした。ラベルはデフォルト距離で大きく出すぎないよう下限を落とし、ズーム時だけ読みやすい画面サイズへ上がる補正にした。`pnpm exec vitest run src/renderer/App.test.tsx src/renderer/components/GraphControls.test.tsx src/renderer/graphRenderModel.test.ts src/renderer/components/GraphCanvas.test.tsx`、`pnpm typecheck`、`pnpm test`、`git diff --check` が通過した。
- 最大ズーム上限を40へ落とし、ノードサイズとリンク太さのスライダー最小値を中間サイズ相当に上げた。力設定変更時は常時揺れずに短時間settleして配置へ反映し、hover hit判定はズーム倍率込みの画面サイズ基準へ変更した。`pnpm exec vitest run src/renderer/graphLayout.test.ts src/renderer/components/GraphControlSections.test.tsx src/renderer/components/GraphCanvas.test.tsx src/renderer/hooks/useGraphSimulation.test.tsx`、`pnpm typecheck`、`pnpm test`、`git diff --check` が通過した。
- Obsidianの全体表示へ寄せるため、大規模グラフのノード半径とリンク線幅を大幅に下げ、中心へ潰れてblob化しないよう力学プロファイルの中心引き込みとリンク収縮を弱め、反発と包含半径を上げた。`pnpm exec vitest run src/renderer/graphRenderModel.test.ts src/renderer/graphLayout.test.ts src/renderer/components/GraphControlSections.test.tsx src/renderer/components/GraphCanvas.test.tsx src/renderer/hooks/useGraphSimulation.test.tsx`、`pnpm typecheck`、`pnpm test`、`git diff --check` が通過した。
- グラフ設定メニューをObsidianのパネル構造へ寄せ、独立したタイトル行を廃止してフィルタ行にリセット/閉じる操作を置いた。フィルタは検索とトグル行、グループは紫の追加ボタンを主表示にし、大規模グラフは中心blobを避けるためsettle回数と反発をさらに上げた。`pnpm exec vitest run src/renderer/components/GraphControls.test.tsx src/renderer/components/GraphControlSections.test.tsx src/renderer/graphLayout.test.ts src/renderer/graphRenderModel.test.ts src/renderer/components/GraphCanvas.test.tsx`、`pnpm typecheck`、`pnpm test`、`git diff --check` が通過した。
- グラフ設定メニューの内部スクロールバーを出さないようoverflowを外し、最小化時のメニュー起動アイコンを歯車に変更した。表示セクションに「アニメーション開始」を戻し、押下時はstoreのanimation epochを進めて短時間settleを再実行するようにした。`pnpm exec vitest run src/renderer/hooks/useGraphSimulation.test.tsx src/renderer/components/GraphControls.test.tsx src/renderer/components/GraphControlSections.test.tsx src/renderer/hooks/useGraphCanvasInteractions.test.tsx src/renderer/hooks/useGraphPanelModel.test.tsx src/shared/i18n.test.ts`、`pnpm typecheck`、`pnpm test`、`git diff --check` が通過した。
- 最小化時の歯車の下にwand sparklesの「アニメーション開始」ボタンを追加し、表示セクションのボタンと同じanimation epochを進めるようにした。アニメーション開始時は一括settleではなく、既存座標から複数フレームでsimulation tickを走らせ、画面上で力学配置が再開する挙動にした。`pnpm exec vitest run src/renderer/hooks/useGraphSimulation.test.tsx src/renderer/components/GraphControls.test.tsx src/renderer/components/GraphControlSections.test.tsx src/renderer/hooks/useGraphCanvasInteractions.test.tsx src/renderer/hooks/useGraphPanelModel.test.tsx src/shared/i18n.test.ts`、`pnpm typecheck`、`pnpm test`、`git diff --check` が通過した。
- hover中ノードと隣接ノードだけを濃くし、それ以外の線とノードを薄くする描画分岐を廃止した。hover状態は判定用の状態として残し、ノード色、ノード透明度、リンク色、リンク透明度、リンク太さ、ラベル透明度には反映しないようにした。`pnpm exec vitest run src/renderer/graphRenderModel.test.ts src/renderer/components/GraphCanvas.test.tsx src/renderer/hooks/useGraphCanvasInteractions.test.tsx src/renderer/hooks/useGraphPanelModel.test.tsx`、`pnpm typecheck`、`pnpm test`、`git diff --check` が通過した。
- 「アニメーション開始」を力学配置の再settleではなく、空の状態からノードとリンクが順に生成されるPixi reveal animationへ変更した。animation epochはGraphCanvasへ渡し、epoch更新時にノードをフェードイン、リンクを始点から終点へ伸ばしながら太さと透明度を上げる。simulation hookからanimation epoch依存を外した。`pnpm exec vitest run src/renderer/components/GraphCanvas.test.tsx src/renderer/hooks/useGraphSimulation.test.tsx src/renderer/hooks/useGraphCanvasInteractions.test.tsx src/renderer/hooks/useGraphPanelModel.test.tsx src/renderer/components/GraphControls.test.tsx src/renderer/components/GraphControlSections.test.tsx`、`pnpm typecheck`、`pnpm test`、`git diff --check` が通過した。
- hover由来の描画差分が残っていたため、render stateへfocused/related/motion状態を持ち込まないようにし、ラベル表示順からfocusedPath優先を外した。矢印描画もfocused edgeでサイズとalphaを変えないよう固定化し、hoverあり/なしでノード、リンク、ラベルの描画値が一致するテストへ更新した。`pnpm exec vitest run src/renderer/graphRenderModel.test.ts src/renderer/components/GraphCanvas.test.tsx src/renderer/hooks/useGraphCanvasInteractions.test.tsx src/renderer/hooks/useGraphPanelModel.test.tsx`、`pnpm typecheck`、`pnpm test`、`git diff --check` が通過した。
- グラフビューのタブ側に縦スクロールバーが出ないようgraph panelをoverflow hiddenにし、右上メニューだけを内部スクロール可能にした。メニュー内スクロールバーは非表示にした。アニメーション開始はノードindex順に1ノードずつ出現し、出現したノードに接続するリンクが順に伸びて増える生成演出へ調整した。`pnpm exec vitest run src/renderer/components/GraphCanvas.test.tsx src/renderer/components/GraphControls.test.tsx src/renderer/components/GraphControlSections.test.tsx src/renderer/components/GraphSidebar.test.tsx src/renderer/App.test.tsx`、`pnpm typecheck`、`pnpm test`、`git diff --check` が通過した。
- ズーム操作中のReact state更新をwheelイベントごとではなく次のrequestAnimationFrameでまとめて確定するようにし、連続wheel入力を1フレームに合成した。ズーム値の丸めを細かくして段階的な拡大縮小の粗さを抑えた。`pnpm exec vitest run src/renderer/hooks/useGraphViewportInteractions.test.tsx src/renderer/hooks/useGraphCanvasInteractions.test.tsx src/renderer/components/GraphCanvas.test.tsx`、`pnpm typecheck`、`pnpm test`、`git diff --check` が通過した。
