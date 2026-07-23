---
name: relic-change-bubble
description: Relicのバブルビューについて、Markdown由来のfile・tag・添付・未解決nodeとedge、共有索引consumer、検索・filter・group、Canvas 2D描画、Web Worker物理演算、pan・zoom・drag・hit判定・再描画停止を追加・修正する。バブル固有の派生データ、操作、性能変更に使う。リンク・共有索引はrelic-change-links-index、3次元スフィアのWebGL・camera・星表現はrelic-change-sphere、添付形式はrelic-change-attachments、タブ遷移はrelic-change-navigation、クロニクルCanvasはrelic-change-chronicleを優先または併用する。
---

# Relic Bubble Change

## 対象と正本を確定する

1. 調査、説明、レビュー、性能診断だけの依頼では編集せず、追加、変更、修正が明示された場合だけ実装する。
2. `git status --short` を確認し、派生graph、検索・filter、描画model、interaction、simulation、表示設定のどこを変えるか限定する。
3. `docs/features/links.md`、`docs/features/navigation.md`、`docs/engineering/data-model.md`、`docs/engineering/decisions.md`、`docs/design/DESIGN.md` のバブル節を読む。
4. process境界へ触れる場合は `docs/engineering/architecture.md`、性能を変える場合は `docs/development.md` の検証節も読む。
5. Markdownとフロントマターを正本、グラフdata、座標、simulation、hover、drag、cameraを再生成可能な派生状態として扱う。

## グラフ派生データを守る

1. nodeをワークスペース内Markdown、フロントマター `tags`、バブル専用の本文 `#タグ`、参照された対応画像、未解決linkから生成する。
2. edgeをfile間・fileと添付を結ぶ `link`、fileとtagを結ぶ `tag` に分け、同じ始点・終点・種別を件数付きの一件へ集約する。
3. code block内の記法、外部URL、workspace外参照、非対応画像をnode・edgeへ追加しない。
4. link・aliases・tags・Markdown parseと共有workspace索引の変更は `$relic-change-links-index`、対応画像形式とpath安全性は `$relic-change-attachments` に委ねる。
5. shared索引のsnapshotから一貫したgraphを生成し、workspace切替や再構築後の古い結果を現在画面へ反映しない。
6. node座標、物理配置、一時drag、pan、zoom、hover、固定強調をMarkdownやworkspace設定へ書き戻さない。
7. filter、力学、色group、group順、設定panel状態だけをrendererの既存browser保存領域へ保持し、不正な保存値を既定値へ正規化する。

## 描画と物理演算を分離する

1. Markdown解析とgraph生成をmainまたはsharedの純粋処理へ置き、React componentから分離する。
2. Canvas座標変換、layout、hit判定、filter、検索、描画命令を純粋modelへ置き、DOM、React state、描画loopと分ける。
3. CanvasのCSS寸法とdevice pixel ratioを分け、resize、倍率変更後もworld・screen変換、pointer、文字、line端点を一致させる。
4. pan、zoom、zoom中心、慣性、選択閾値を同じscreen・world変換から計算する。
5. 物理演算を既存Web Workerとd3-force境界に保ち、Transferable座標、世代ID、停止、再起動、worker破棄を明示する。
6. staleなworker応答、古いnode集合、連続filter、workspace切替後の座標を現在graphへ適用しない。
7. React stateを毎frame更新せず、描画用refと `requestAnimationFrame` を使い、unmount時にworker、frame、listenerを止める。
8. `SharedArrayBuffer` はcross-origin isolationを満たす設計確認なしに導入しない。

## Canvas操作の生存期間を守る

1. pointerdownからpointerupまでcapture、pointer ID、開始点、直近速度、対象nodeを一つの操作状態として追跡する。
2. 5px以内のfile・tag node操作だけをclickとして扱い、dragとbackground panをopen・tag検索から分離する。
3. file nodeは現行button契約でfileを開き、tag nodeはsidebarを開いてtag検索へ渡す。添付・未解決nodeを誤ってfileとして開かない。
4. node dragでは一時固定、background panでは直近速度からの短い慣性を使い、pointerup後に操作状態とcaptureを必ず解放する。
5. `pointercancel`、lost capture、unmount、workspace切替では一時固定、速度、capture、hover待機、操作stateを消し、file open、tag検索、固定強調、慣性などの永続的副作用を起こさない。
6. 中断後の次のpointer操作を通常どおり開始できることを不変条件にする。
7. wheelでは拡大時のcursor下と縮小時の画面中央を現行規則どおり扱い、keyboardの連続pan・zoomとShift倍率を別入力として確認する。
8. 右clickの固定強調、background解除、hover grace、検索・group queryの `path:`、`file:`、`tag:`、`type:`、`is:`、除外prefixを保つ。

## 必要な間だけ再描画する

1. 操作、慣性、zoom遷移、simulation、hover・固定発光が静止したらframe予約を止める。
2. pointer・wheel・keyboard入力、graph data、filter、表示設定、worker座標、theme、Canvas size、device pixel ratioの変更で再描画を再開する。
3. 同じ時点に複数のframeを予約せず、停止済みloopを再開するときも一つのframe ownershipを保つ。
4. theme変更時はCanvas色cacheと描画styleを無効化し、Light・Darkの古い色を次frameへ残さない。
5. workerのtickが止まった後もhover発光など必要な一時animationだけを継続し、不要になった時点で停止する。

## 検証する

1. workspace graphで全node種別、edge種別、重複集約、code除外、外部参照、同名・未解決、本文tag、添付を確認する。
2. graph modelで座標変換、DPR、resize、hit判定、低倍率、line端点、検索・filter・groupを確認する。
3. interactionでclick閾値、drag、pan、wheel、keyboard、hover、右click、pointercancel、lost capture、中断後の再操作を確認する。
4. simulationでseedまたは純粋入力を固定し、worker世代、Transferable、stale応答、停止、破棄を確認する。
5. frame loopでidle停止、全restart契機、重複予約なし、theme cache無効化、unmount cleanupを確認する。
6. `app/` で対象のnode・rendererテストと `pnpm typecheck` を実行し、process境界へ触れた場合は `pnpm architecture:check`、影響が広い場合は `pnpm verify` を実行する。
7. 大規模dataへの影響は `pnpm performance:workspace` またはlarge版を同条件で比較し、Rendererのbuildまたは初期読込境界へ影響する場合は `pnpm renderer:production:check` を実行する。
8. 見た目や操作を変えた場合は `$relic-change-ui` を併用し、ユーザーが実画面確認を明示した場合だけ `$relic-test-development-app` に従う。
9. 仕様をlinks、navigation、design、data-model、decisionsの該当正本へ同期し、`git diff --check` と全差分を確認する。

## 完了する

変更したgraph派生、描画・操作、永続化しない状態、frame・worker契約、性能条件、更新した正本、テスト、実画面確認、未確認項目を報告する。コミット時は `$relic-commit` に従う。
