---
name: relic-change-card-view
description: Relicのカードビューについて、frontmatter `card` と本文の最初のflavortextからの派生一覧、一覧選択・再選択、選択中だけの安全な画像読込、空値・失敗表示、ワークスペース切替、縦横に収まるカード表示を追加・修正する。カード固有の対象抽出、選択、画像、非同期状態、レスポンシブ表示に使う。YAML解析はrelic-change-frontmatter、画像形式・安全な読込はrelic-change-attachments、共有索引はrelic-change-links-index、タブ遷移はrelic-change-navigation、見た目だけはrelic-change-uiを優先または併用する。
---

# Relic Card View Change

## 対象と正本を確定する

1. 調査、説明、レビューだけの依頼では編集せず、追加、変更、修正が明示された場合だけ実装する。
2. `git status --short` を確認し、card派生、flavortext抽出、一覧取得、選択、画像path解決、非同期読込、伸縮表示のどこを変えるか限定する。
3. `docs/features/frontmatter.md`、`docs/features/navigation.md`、`docs/engineering/data-model.md`、`docs/design/DESIGN.md` のカード節を読む。画像境界へ触れる場合は `docs/engineering/file-access-boundaries.md` も読む。
4. Markdown、frontmatter `card`、最初の完結した `flavortext` blockを正本、カード一覧・選択・画像data URLを再生成可能な派生状態として扱う。

## カード対象と選択を安定させる

1. トップレベルに `card` keyがあるMarkdownを、値の空・型・画像読込可否にかかわらずカード対象へ含める。
2. 画像pathは空でない文字列だけを候補にし、本文や添付から代表画像を推測しない。flavortextは最初に完結したblockだけを使い、存在しない場合は空欄を保つ。
3. 共有索引のfile識別情報とparse cacheを利用し、独自の全ファイル再走査やカード専用正本を作らない。
4. 初期選択は同じworkspaceの前回選択、現在開いている対象、一覧先頭の順にし、workspace切替で以前の選択を引き継がない。
5. 未選択項目のclickはカード切替だけ、選択中の同じ項目の再clickだけを同一paneのfile表示にする。大きなカード本体は表示専用に保つ。
6. 対象が消えた場合は残る対象から初期規則で選び直し、対象がなければ案内付きの空状態にする。

## 画像読込と非同期状態を閉じ込める

1. 一覧取得に画像byteやdata URLを含めず、選択中の1件だけを既存の安全な画像読込APIへ渡す。
2. `card` pathを対象Markdownのfolder基準で解決し、ワークスペース外、非対応形式、無効path、読込失敗を同じ安全境界で拒否する。形式とIPC安全性は `$relic-change-attachments` に委ねる。
3. 選択またはworkspaceが変わった時点で以前の読込を無効化し、遅れて完了したdata URLやerrorを現在のカードへ反映しない。
4. loading、ready、failedを選択path単位で分け、失敗時もカード名、説明、選択操作、画像領域の寸法を残す。
5. 同じworkspace更新番号の一覧取得を上限付きで再利用し、view再表示だけでMarkdownを再解析しない。保存、外部変更、手動refreshでは共有索引更新後に再取得する。

## カードを利用可能な領域へ収める

1. 一覧と選択カードを一体のviewとして扱い、右側へ装飾目的の追加surfaceや重複見出しを置かない。
2. カード幅を右列の利用可能な横幅と縦幅の両方から決め、縦が不足する場合は画像枠、説明欄、余白を同じ比率関係で縮める。
3. 画像を縦横比どおり枠内へ収め、切り取らない。画像なし・loading・failedも同じ枠寸法を保つ。
4. file名、画像、flavortextの順序と意味を維持し、狭幅・低い高さ・長い名前・長文で一覧や操作を画面外へ押し出さない。
5. `prefers-reduced-motion` と既存theme・focus表現へ追従し、意味のないhover説明やカード化を追加しない。

## 検証して完了する

1. 派生modelで空の `card`、非文字列、相対画像、flavortextなし・複数、同名fileを確認する。
2. componentで初期選択、項目切替、再選択file表示、対象消失、空・loading・errorを確認する。
3. 画像で選択中だけの読込、連続選択、古い応答、無効path、失敗、workspace切替を確認する。
4. CSS・layout変更では広い・狭い・低い領域、長い名前・説明、画像なし、Light / Darkを対象テストで確認する。
5. `app/` で対象のcard・rendererテスト、`pnpm typecheck`、IPCや共有索引変更時は `pnpm architecture:check`、影響が広い場合は `pnpm verify` を実行する。
6. ユーザーが実画面確認を明示した場合だけ `$relic-test-development-app` に従う。仕様を正本文書へ同期し、`git diff --check` と全差分を確認する。変更した対象抽出・選択・画像・layout契約、対象テスト、未確認事項を報告し、コミット時は `$relic-commit` に従う。
