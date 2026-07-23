---
name: relic-change-chronicle
description: Relicのクロニクルビューについて、frontmatter `chronicle` の暦・単年・期間、基準暦と追加暦の設定・換算・暦面、暦ツリーとカテゴリ集約、共有索引consumer、年軸・配置、Canvas 2D描画、pan・zoom・drag・hit判定・再描画停止を追加・修正する。年表の解析、表示、操作、性能変更に使う。YAML往復はrelic-change-frontmatter、共有索引はrelic-change-links-index、暦設定schemaはrelic-change-settings、タブ遷移はrelic-change-navigationを優先または併用する。グラフCanvasはrelic-change-bubbleが所有し、両Canvasで共有するinteraction helperや契約を変える場合は両Skillを使う。
---

# Relic Chronicle Change

## 対象と正本を確定する

1. 調査、説明、レビュー、性能診断だけの依頼では編集せず、追加、変更、修正が明示された場合だけ実装する。
2. `git status --short` を確認し、chronicle parse、共有索引consumer、年軸、scene、描画、interaction、入口・設定のどこを変えるか限定する。
3. `docs/features/frontmatter.md`、`docs/features/navigation.md`、`docs/engineering/data-model.md`、`docs/design/DESIGN.md` のクロニクル節を読む。
4. process境界へ触れる場合は `docs/engineering/architecture.md`、設定へ触れる場合は設定正本、性能を変える場合は `docs/development.md` の検証節も読む。
5. Markdownと `chronicle` frontmatterを正本、年表entry、scene、座標、camera、hover、dragを再生成可能な派生状態として扱う。

## Chronicle値を安全に解釈する

1. 標準形式を、設定済みの `calendar` と0以外の整数 `start`・`end` を持つmappingとする。単年も `start` と `end` を同じ年にして保存する。
2. 期間は `start <= end` の場合だけ有効とし、負の年を保持する。どの暦にも0年を設けず、小数、文字列、0、空、不完全mapping、逆転期間を表示対象にしない。
3. 無効な既存値を勝手に修正・削除せず、formではerror、年表では非表示にする。
4. 整数scalarは基準暦の単年、`end` 省略mappingは単年として互換読込し、form編集後は標準形式へ書き戻す。旧配列形式は表示・編集対象にせず、そのまま保持する。
5. 設定にない暦名はMarkdown内で保持し、formではerror、年表では非表示にする。互換値と無効値を現行標準として新規保存しない。
6. YAML parse、対象propertyの書換え、comment・quote・他fieldの保持は `$relic-change-frontmatter` に委ねる。
7. main側共有索引のfile recordとfrontmatter parse結果を利用し、独自の第二索引を作らない。索引構造を変える場合は `$relic-change-links-index` を併用する。
8. workspace切替、外部変更、連続読込後の古いentryを現在の年表へ反映しない。

## 暦設定と派生状態を構成する

1. 基準暦名と追加暦の `yearOne`・`range` をワークスペース設定から読み、追加暦の1年を対応する基準暦年へ換算する。追加暦の保存範囲は自身の1年から終了年までとし、0年をまたぐ換算は連続する序数で扱う。
2. 基準暦と追加暦を暦ツリーの親、その暦で使われるカテゴリを子として派生し、「年表全体」では同名カテゴリを暦横断で集約する。
3. 追加暦面の表示切替は既存のワークスペース設定へ保存する。カテゴリ表示、基準暦側のカテゴリ一括表示、検索、ツリー開閉、中間状態、カテゴリ色、追加暦色はRendererの一時的な派生状態とし、Markdownやワークスペース設定へ書き戻さない。
4. 追加暦を基準暦Canvas上の暦面として設定順に置き、暦自身の年目盛りを表示する。設定範囲外の既存項目を消さず、警告領域と件数で示す。
5. 暦ツリー検索だけではCanvasの表示対象、年代位置、camera、zoom、期間scaleを変更しない。ワークスペース切替やタブ終了時には一時状態を初期化する。

## 年軸とsceneを構成する

1. 単年を一つの節点、期間を開始・終了節点と接続線として、左を過去、右を未来に固定する。
2. 基準暦の連続する時間軸を項目の有無から独立して構成し、期間scaleと順序を保つ圧縮規則で長い空白を縮める。年数差をそのままpixel距離にしない。
3. 縦位置に時間上の意味を持たせず、item、label、期間lineの衝突回避にだけ使う。
4. scene生成、時間変換、layout、hit判定、opacity、label配置を純粋modelへ置き、React componentと描画処理から分離する。
5. 初期表示、camera、期間scaleは現行のnavigation・design正本と実装を照合し、項目数だけから独自に決めたり一時状態を永続化したりしない。
6. 配置に乱数を使う場合は一回の表示中に位置と色を安定させ、テストではseedまたは純粋入力を固定する。
7. itemの一時drag、配置、pan、zoom、hover、色をMarkdown、frontmatter、workspace設定へ書き戻さない。

## Canvas描画を実装する

1. 年label、固定header、縦guide、節点、期間line、file名、年・期間textを同じCanvas 2Dへ描画する。
2. CanvasのCSS寸法とdevice pixel ratioを分け、resize、倍率変更後もworld・screen変換、pointer、文字、hit領域を一致させる。
3. 年headerを画面上端へ固定し、縮小時は年labelを間引き、file名と年・期間textのopacityを段階的に下げる。
4. hover時はitemと期間lineを強調し、item名をpointer近くへ表示する。不可視に近いlabelを誤ってhit対象にしない。
5. React stateを毎frame更新せず、scene、camera、pointer、hoverをrefで保持し、描画とsimulationを `requestAnimationFrame` へ集約する。
6. unmount、workspace切替、entry再構築時にframe、listener、一時操作を止め、古いsceneを描画しない。

## Canvas操作の生存期間を守る

1. pointerdownからpointerupまでcapture、pointer ID、開始点、直近pan速度、対象itemを一つの操作状態として追跡する。
2. 空白dragではpanし、pointerup後だけ直近速度から慣性を開始する。pan範囲は現行仕様どおり制限しない。
3. item dragでは一時的に位置を動かし、解放後は対応年への引力を再開する。近傍itemの反発も永続化しない。
4. 移動閾値を超えない節点、期間line、file名のclickだけで、クロニクルtabを残したまま同じpaneへfileを開く。
5. wheel・pinch相当入力ではpointer位置を中心にzoomし、sceneに応じた最小・最大倍率と年の視認性を保つ。
6. `pointercancel`、lost capture、unmount、workspace切替ではdrag固定、pan速度、capture、pointer stateを消し、file openや慣性を開始しない。drag itemは対応年への引力へ戻す。
7. 中断後の次のpointer操作を通常どおり開始できることを不変条件にする。
8. グラフと共通化するのは座標・frame ownershipなど意味が同じhelperだけにし、click対象、閾値、zoom、keyboard有無など異なる操作契約を一つに潰さない。

## 必要な間だけ再描画する

1. scene収束、慣性停止、hover・drag終了後にframe予約を止める。
2. pointer・wheel入力、entry、scene、theme、Canvas size、device pixel ratioの変更で描画を再開する。
3. 同じ時点に複数のframeを予約せず、停止済みloopを再開するときも一つのframe ownershipを保つ。
4. theme変更時はCanvas色cacheと描画styleを無効化し、Light・Darkの古い色を次frameへ残さない。
5. simulationが収束した後はhoverや入力に必要なframeだけを予約し、閲覧中ずっと空回りさせない。

## 検証する

1. chronicle parseで標準mapping、単年、期間、負の年、0、小数、文字列、空、逆転期間、scalar・`end`省略互換、旧配列と不正値の非破壊を確認する。
2. 暦設定・換算で基準暦、追加暦、0年なし、範囲未設定・範囲外、未知の暦、暦面を確認する。
3. 暦ツリーで暦・カテゴリ検索、個別・全体表示、中間状態、件数、色、ワークスペース切替時の初期化を確認する。
4. 年軸・scene modelで順序保持、距離圧縮、期間scale、衝突回避、期間line、seed固定、空dataを確認する。
5. Canvas modelとrendererでDPR、resize、header、暦面、年label間引き、opacity、hit判定、低・高倍率、themeを確認する。
6. interactionでitem click、drag復帰、background pan、慣性、pointer中心zoom、pointercancel、lost capture、中断後の再操作を確認する。
7. frame loopで収束後停止、全restart契機、重複予約なし、theme cache無効化、unmount cleanupを確認する。
8. `app/` で対象のnode・rendererテストと `pnpm typecheck` を実行し、process境界へ触れた場合は `pnpm architecture:check`、影響が広い場合は `pnpm verify` を実行する。
9. 大規模dataへの影響は `pnpm performance:workspace` またはlarge版を同条件で比較し、Rendererのbuildまたは初期読込境界へ影響する場合は `pnpm renderer:production:check` を実行する。
10. 見た目や操作を変えた場合は `$relic-change-ui` を併用し、ユーザーが実画面確認を明示した場合だけ `$relic-test-development-app` に従う。
11. 仕様をfrontmatter、navigation、design、data-modelの該当正本へ同期し、`git diff --check` と全差分を確認する。

## 完了する

変更したchronicle解釈、年軸・scene、描画・操作、互換読込、永続化しない状態、性能条件、更新した正本、テスト、実画面確認、未確認項目を報告する。コミット時は `$relic-commit` に従う。
