---
name: relic-change-ui
description: RelicのUI、デザイン、画面構成、操作感、表示状態を実装または修正し、関連仕様、状態別テスト、開発版での実画面確認、説明画像まで安全に整合させる。見た目、レイアウト、テーマ、hover・focus・drag・zoom・pointerup・pointercancel・lost capture・狭幅、アニメーション、README掲載画像の変更依頼に使う。UI用語・日英翻訳はrelic-change-localization、グラフ・クロニクル固有操作はrelic-change-graph・relic-change-chronicle、機能固有の状態遷移やデータ規則は対応する機能変更Skillを優先または併用し、調査・レビューだけでは読み取り専用、Issue起点はrelic-issue、コミットだけはrelic-commitを優先する。
---

# Relic UI Change

## 境界を決める

1. 調査、説明、レビューだけの依頼では編集しない。変更が明示されている場合だけ実装へ進む。
2. Issue番号またはURLが入口なら `$relic-issue`、検証済み差分のコミットだけなら `$relic-commit` を優先する。
3. `git status --short` と対象画面の実装を確認し、無関係な差分を保護する。
4. 対象画面、操作、期待状態を具体化する。見た目の好みだけでなく、何を識別・操作しやすくする変更かを定める。

## 正本と受入条件を確認する

1. `docs/INDEX.md` から対象機能の正本を選び、見た目は `docs/design/DESIGN.md`、操作や表示条件は該当する `docs/features/` を読む。
2. 正本と実装が一致しない場合は、今回の変更目的と確認済みの事実から、どちらを更新すべきか判断する。履歴や他製品の見た目を仕様として扱わない。
3. 関係する状態だけを受入条件として列挙する。次を機械的に全件確認せず、変更の影響がある項目を選ぶ。
   - Light / Dark theme
   - 通常、hover、focus、active、selected、disabled、error
   - click、keyboard、drag、scroll、zoom
   - 狭い幅、長い文言、空状態、大量表示
   - reduced motion、対象OS固有のウインドウ操作
4. 変更前の表示を確認する必要がある場合も、既存のRelicウインドウ、配布版、`app/out/` のアプリを操作しない。

## 実装する

1. 既存のコンポーネント責務、デザイントークン、Light / Darkの対応、モーション規則を保つ。用途を説明できない色、装飾、コンテナ、アニメーションを追加しない。
2. UI用語、日英翻訳、翻訳キーを変更する場合は `$relic-change-localization` を併用し、本Skillでは文字量、折返し、見切れ、操作性への影響を確認する。
3. 見た目の変更を理由に、Markdown正本、保存形式、IPC契約、ファイルアクセス境界を変えない。必要な場合は別の影響として明示する。
4. Canvasや複雑な描画では、座標・ヒット判定・表示閾値を純粋なmodelへ置き、描画処理と操作状態を分ける。
5. 依頼と無関係な画面刷新や大規模なスタイル整理を同時に行わない。
6. pointer操作は確定を表す `pointerup` と、中断を表す `pointercancel`・`lostpointercapture` を分ける。中断時にdrop、保存、選択確定などの永続的な副作用を起こさず、一時レイヤー、capture、速度・drag状態を解除し、次のpointer操作を直ちに開始できる状態へ戻す。

## 検証する

1. 状態遷移や操作を変えた場合はReact Testing Libraryの回帰テスト、計算や座標を変えた場合はmodelの単体テストを追加または更新する。pointer操作では通常の `pointerup`、`pointercancel`、`lostpointercapture`、中断後の再操作を分け、副作用と一時状態の解放を確認する。壊れやすいピクセル値だけをテストへ固定しない。
2. 仕様分岐や状態遷移を追加・変更した場合は対象テストまたは回帰テストを追加し、`app/` で `pnpm verify` を実行する。軽微な見た目だけの変更は対象rendererテストと `pnpm typecheck` を実行し、影響が広い場合は `pnpm verify`、構造境界に触れた場合は `pnpm architecture:check` も実行する。
3. テスト成功だけで視覚的な完了と判断しない。見た目、操作感、テーマ、Canvas、プラットフォーム差など自動テストで判断できない変更は実画面で確認する。
4. 実画面確認が必要な場合は `$relic-test-development-app` に従い、その作業中に起動したことを証明できる開発版だけを使う。
5. 実画面では受入条件に選んだ状態を確認し、必要なら表示、操作結果、計算済みスタイル、コンソールエラーを記録する。確認していない状態を確認済みと報告しない。
6. 表示と操作が確定してから、ユーザーから見える仕様を `docs/design/DESIGN.md` と該当機能文書へ同期する。README掲載画像が現行表示を説明できなくなる場合だけ、実際の開発版から画像を更新する。
7. `git diff --check` と全差分を確認し、意図しない画像、生成物、絶対パス、他製品名がないことを確かめる。

## 完了する

変更した状態、更新した正本、自動テスト、実画面で確認した状態、未確認項目と理由を報告する。コミットする場合は `$relic-commit` に従う。
