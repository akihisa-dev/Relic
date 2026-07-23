---
name: relic-change-sphere
description: Relicのスフィアビューについて、共有グラフデータからの3次元派生、WebGL runtime、球状配置、星の等級・星座強調・ガイド、カメラの周回・平行移動・zoom、選択、遅延読込、待機停止、context lossを追加・修正する。スフィア固有の表示、視点、操作、性能、WebGL障害に使う。共有リンク索引とグラフデータ契約はrelic-change-links-index、バブルビューのCanvas・物理演算はrelic-change-bubble、機能トグルと保存設定はrelic-change-settings、タブ遷移はrelic-change-navigation、見た目だけはrelic-change-uiを優先または併用する。
---

# Relic Sphere Change

## 対象と正本を確定する

1. 調査、説明、レビュー、性能診断だけの依頼では編集せず、追加、変更、修正が明示された場合だけ実装する。
2. `git status --short` を確認し、共有データの絞り込み、3次元model、WebGL runtime、guide、camera、interaction、遅延読込、障害表示のどこを変えるか限定する。
3. `docs/features/navigation.md`、`docs/engineering/data-model.md`、`docs/design/DESIGN.md` のスフィア節を読む。process・読込境界は `docs/engineering/architecture.md`、性能変更は `docs/development.md` も読む。
4. Markdownと共有ワークスペース索引を正本、球座標、camera、hover、selection、guide半径を再生成可能な表示状態として扱う。

## 共有データと3次元状態を分ける

1. バブルビューと同じ取得hook・更新番号・cacheを使い、スフィア専用の第二索引や第二IPCを作らない。
2. 共有node・edgeを複製して3次元libraryへ渡し、libraryが付加する座標や内部状態を共有データへ書き戻さない。
3. link・aliases・tags・attachmentの解析と共有索引は `$relic-change-links-index`、バブル固有のscene・Canvas・Workerは `$relic-change-bubble` に委ねる。
4. ワークスペースIDと更新番号を要求キーにし、切替後に古い取得・配置・選択を現在のスフィアへ反映しない。
5. filter、group、色の共有契約を変える場合はグラフ側のconsumerも確認し、3次元固有のcamera・guide・星表現を共有設定へ混ぜない。

## WebGL描画と視認性を保つ

1. node数、平均link数、接続数に応じて距離、反発、node径、link濃度を調整し、密集時もnodeの輪郭と選択可能な大きさを保つ。
2. 中心軸、赤道ring、天球gridは球の向きと奥行きを示す補助表現に限定し、node・linkより先に生成して背面へ置き、hit対象にしない。
3. guideは配置中の広がりへ滑らかに追従させ、極端な外れ値だけで半径を決めない。themeと操作中の状態を含め、背景・node・linkから区別できるか確認する。
4. 星の等級と星座強調はデータ更新時に求め、camera操作中に再計算しない。hover・selectionで配置とcameraを動かさない。
5. WebGLを利用できない場合、生成に失敗した場合、contextを失った場合はスフィアタブ内だけを失敗状態にし、バブルビューとアプリ全体を巻き込まない。

## Cameraとruntimeの生存期間を守る

1. 初期cameraはクォーター視点、球の中心、全体が収まる倍率を一つの契約にし、resetも同じ状態へ戻す。
2. 左dragは中心軸周回、右dragは注視方向を保つ平行移動、wheelはzoomとして分離し、node clickとの移動閾値を混同しない。
3. 平行移動をguide半径内へ制限し、球を完全に見失わない。resize後もcamera、raycast、pointer座標を一致させる。
4. 1回目のnode clickは選択固定、選択中nodeの再clickだけをfile表示またはtag検索にし、背景clickで解除する。
5. runtimeのattach、suspend、park、disposeを一つの所有関係で扱い、非表示・unmount・切替時にframe、listener、GPU資源を残さない。
6. 機能が無効な通常起動では3次元描画codeを初期静的importへ含めない。先読みは機能が有効で、ワークスペース表示後の待機時間だけにする。

## 検証して完了する

1. modelで密度、等級、色、外れ値、空dataを確認し、runtimeでcamera、reset、selection、context loss、disposeを確認する。
2. `app/` で対象のsphere・rendererテスト、`pnpm typecheck`、必要に応じて `pnpm renderer:production:check` と `pnpm architecture:check` を実行する。
3. 性能を変えた場合は同じfixture・run数で `pnpm performance:sphere` を比較する。この検査は開発版またはpackage実行を伴うため、ユーザーが実アプリ確認を明示していない通常作業では実行せず、model・runtimeテストと静的境界で代替する。
4. 見た目や操作を変え、ユーザーが実画面確認を明示した場合だけ `$relic-test-development-app` に従い、Light / Dark、密度、resize、左右drag、zoom、選択、障害表示を確認する。
5. 仕様変更を正本文書へ同期し、`git diff --check` と全差分を確認する。変更した3次元契約、共有データへの影響、性能、対象テスト、未確認事項を報告し、コミット時は `$relic-commit` に従う。
