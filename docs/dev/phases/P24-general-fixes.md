# P24-general-fixes.md

Relicの全般修正フェーズの正本。

このフェーズでは、P23後に見つかった不具合、表示崩れ、操作違和感、文書と実装の小さなズレ、軽微な内部修正を扱う。
ただし、具体的な修正対象はユーザーが指定したもの、または調査後にユーザーへ提示して合意したものだけを対象にする。

---

## 読み込みルール

Relicの全般修正フェーズ。

AIはこのフェーズを前提にユーザーへ接する。
対象は既存機能を前提にした不具合修正、UI/UXの小修正、文書整合、軽微な実装整理であり、新機能追加、大きな仕様変更、保存形式変更、配布判断へ広げる場合は、事前にユーザーへ確認する。

最初に読む:

- この文書

必要になったときだけ読む:

- 実装規約: `../conventions.md`
- テスト方針: `../testing.md`
- 対象機能の正解: 対応する `../../spec/*.md`
- UI挙動に触れる場合: `../../ui/screens-macos.md`, `../../ui/navigation.md`, `../../ui/DESIGN.md`
- アーキテクチャ前提に触れる場合: `../../architecture/overview.md`, `../../architecture/decisions.md`

注意:

- ユーザーが指定した修正対象、または調査後にユーザーへ提示して合意した対象だけを扱う
- 修正前に、対象、問題、変更範囲、変えてはいけない挙動、検証方法を明示する
- UI変更では、指定された画面・場所・操作対象だけを変更する
- 仕様変更、保存形式変更、IPC/preload API変更、store状態構造変更が必要になった場合は、全般修正から分けて確認する
- 変更後は対象に応じたテスト、`pnpm typecheck`、`pnpm test`、`git diff --check` の必要範囲を確認する
- 実アプリ確認が必要な挙動は、確認した範囲と未確認理由を記録する

---

## フェーズの目的

- P23後のコード・文書・UIを実利用前提で整える
- 不具合、表示崩れ、操作違和感、文書の小さなズレを一つずつ潰す
- 既存機能と保存データを壊さず、必要最小限の修正で安定させる
- 修正単位ごとに検証し、次の作業者が状態を判断できる記録を残す

---

## 作業方針

- 1回の作業は、問題単位または近い原因を共有する小さなまとまりに分ける
- 実装前に、対象、今の問題、変更範囲、変えない挙動、検証方法を明示する
- ユーザーの指定範囲を越える修正候補は、実装せず提案として分ける
- 仕様変更、UI追加、保存形式変更、機能追加を混ぜない
- 変更後は、対象テスト、関連回帰テスト、型検査、全体テスト、diff whitespaceの必要範囲を確認する
- このフェーズ文書には日誌を書かない。日付順の作業履歴は `docs/journal/` に分ける

---

## 開始時チェック

修正対象ごとに、実装前に以下を確認する。

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

P24では、事前に固定した長い実施リストは置かない。
ユーザー指定、または調査で合意した修正単位ごとに、この文書の「進捗」へ方向性、実施、確認、残りを記録する。

完了条件:

- 合意した修正単位が完了している
- 変更範囲に応じた自動テスト、`pnpm typecheck`、`pnpm test`、`git diff --check` の必要範囲を確認している
- 実アプリ確認が必要な項目は、確認結果または未確認理由を記録している
- 次フェーズへ移る場合は、ユーザーが明示している

---

## 進捗

このフェーズでは、修正単位ごとに次回作業時の判断に必要な状態だけを記録する。
日付順の作業ログ、感想、細かな経緯はここに書かない。

必要な場合だけ、以下を同じ項目内にまとめる。

- 方向性
- 実施
- 確認
- 残り

### フェーズ開始

- 方向性: P24は、P23後に見つかった不具合、表示崩れ、操作違和感、文書と実装の小さなズレ、軽微な実装整理を扱う全般修正フェーズとして進める
- 実施: `docs/dev/phases.md` の現在フェーズをP24へ変更し、P24正本を追加した
- 確認: コード実装には入らず、フェーズ開始文書だけを更新する
- 残り: 最初の修正対象は、ユーザー指定または調査後の合意に基づいて決める

### 補助パネルUIモダン化

- 方向性: 設定、フロントマター設定、ファイル加工、グラフ操作パネルの `setting-row` 系UIを、既存の設定値、保存形式、IPC/preload API、store状態構造を変えず、macOS設定型の静かなグルーピング、セグメント操作、スイッチ表示へ揃える
- 実施: `SettingsSegmentedControl` を追加し、設定タブを表示、エディタ、機能、アプリ情報の `settings-group` へ再構成した。チェックボックスはCSSでスイッチ表示にし、テーマ、言語、フォント、最大幅は既存値のままセグメント操作へ変更した。フロントマター設定、ファイル加工、グラフ操作パネルも `settings-page` / `settings-group` / `settings-stack` / `setting-row` の共通スタイルへ寄せた。i18nには設定タブのセクション見出しだけを追加した
- 確認: `pnpm exec vitest run src/renderer/components/SettingsSidebar.test.tsx src/renderer/components/ToolsSidebar.test.tsx src/renderer/components/GraphControlSections.test.tsx src/renderer/App.test.tsx`、`pnpm typecheck`、`pnpm test`、`git diff --check` が通過した。全体テストは78ファイル、516件が通過した。開発版レンダラーを `pnpm exec vite --host 127.0.0.1 --port 5173 --config vite.renderer.config.ts` で起動し、設定タブ、フロントマター設定、ファイル加工の未登録ワークスペース表示、グラフ空状態、設定タブのダーク表示を確認した
- 残り: Electron実機でワークスペースを開いた状態のファイル加工入力群とグラフhover操作パネルの目視確認は、ユーザーのワークスペースまたは検証用フォルダ選択が必要なため未実施。対象コンポーネントの操作・保存挙動は自動テストで確認済み

### チャートビューの固定単位化

- 方向性: チャートビューのスケール切り替え、ズームイン、ズームアウト、全体表示ボタンを廃止し、`chronicle` は1年単位、日付チャートは1日単位だけで固定表示する。既存データ形式、IPC/preload API、store状態構造は変えない
- 実施: `SCALE_OPTIONS`、scale index、scale表示文言、ツールバーのスケール操作を削除し、モデル側は `tickInterval = 1` と day scale に固定した。`chronicle` の軸・ガイドは1年単位を基準にし、日付チャートは常に年・月・日の3段軸を表示する。dateの「今日」移動だけは残した。仕様文書のチャート説明も固定単位へ更新した
- 確認: `pnpm exec vitest run src/renderer/components/ChronicleToolbar.test.tsx src/renderer/components/ChronicleChartGrid.test.tsx src/renderer/hooks/useChronicleChartModel.test.tsx src/renderer/hooks/useChronicleChartViewport.test.tsx src/renderer/chronicleTimeline.test.ts src/renderer/chronicleTimelineAxis.test.ts src/renderer/App.test.tsx`、`pnpm typecheck`、`pnpm test`、`git diff --check` が通過した。全体テストは78ファイル、516件が通過した。開発版レンダラーを `pnpm exec vite --host 127.0.0.1 --port 5173 --config vite.renderer.config.ts` で起動し、チャートタブにスケール、ズーム、全体ボタンが表示されないこととコンソールエラーなしを確認した
- 残り: 実ワークスペースを開いたElectron実機目視は未実施

### dateチャートの視認性改善

- 方向性: dateチャートでも全体位置を把握できるようにし、横スクロール中に表示中の年・月が分からなくなる違和感を減らす。対象は既存チャートビュー内の表示・操作だけに限定し、既存データ形式、IPC/preload API、store状態構造、バー編集挙動は変えない
- 実施: `chronicle` 専用だったミニマップ表示・項目計算・ミニマップ操作をdateチャートでも使うようにした。ミニマップのアクセシブル名は年表専用ではなくチャート共通の文言に変更した。date軸では、年・月のセル枠を維持したまま、ラベル文字だけを横スクロール位置に追従させ、区間内で表示中の年月が分かるようにした
- 確認: `pnpm exec vitest run src/renderer/components/ChronicleMinimap.test.tsx src/renderer/hooks/useChronicleChartModel.test.tsx src/renderer/hooks/useChronicleChartViewport.test.tsx src/renderer/App.test.tsx`、`pnpm exec vitest run src/renderer/chronicleTimelineAxis.test.ts src/renderer/components/ChronicleChartGrid.test.tsx src/renderer/App.test.tsx`、`pnpm typecheck`、`pnpm test`、`git diff --check` が通過した。全体テストは最終確認時点で78ファイル、519件が通過した
- 残り: 実ワークスペースを開いたElectron実機目視は未実施

### グラフ操作パネル最小状態の視認性改善

- 方向性: グラフビュー右上のhover操作パネルだけを対象に、最小化後の復帰入口を見つけやすくする。既存のグラフ描画、保存形式、IPC/preload API、store状態構造は変えない
- 実施: 最小化時の三点表示を三本線系SVGへ変更し、アクセシブル名とtitleは既存の「展開」のまま維持した。最小状態のパネルだけ常時表示にし、ボタンサイズ、枠、影、文字色を強めた。展開後の通常パネルは従来どおりhover/focus時に表示する
- 確認: `pnpm exec vitest run src/renderer/components/GraphControls.test.tsx`、`pnpm typecheck`、`git diff --check` が通過した。開発版レンダラーでグラフビューを開き、最小化後の三本線ボタンがhoverなしで表示されることを確認した
- 残り: Electron実機で実ワークスペースを開いた状態の目視確認は未実施

### ファイルビュー検索の入力エラー修正

- 方向性: ファイルビュー検索で検索語を入れても `検索語句を入力してください` になる問題を、検索処理本体ではなくIPC入力正規化の問題として直す。検索UI、検索モード、検索対象、保存形式は変えない
- 実施: `workspace:search` の入力を正規形 `{ query, mode }` と互換形 `{ searchQuery, searchMode }` の両方から正規化する処理を追加し、handlerは正規化済み入力を検索本体へ渡すようにした。不正な構造のエラー文言は検索語句不足ではなく検索リクエスト不正に分けた。ファイル名検索と正規表現検索のrenderer経路テストも追加した。実機で `検索リクエストが正しくありません` が残ったため、IPC handlerを可変引数で受け、位置引数 `[query, mode]` / `[mode, query]`、単独文字列、`searchTerm` / `type` などの別名入力も正規化できるようにした。検索modeがUI表示名の `全文` / `タグ` などで届く場合も内部modeへ変換するようにした。プロパティ以外の検索で `frontmatterField: undefined` が渡ると不正扱いになる問題を直し、renderer側も非プロパティ検索では `frontmatterField` を送らないようにした
- 確認: `pnpm exec vitest run src/main/ipc/fileHandlerValidators.test.ts src/main/files/search.test.ts src/renderer/components/FilesSidebarSearch.test.tsx src/renderer/App.test.tsx -t "検索|search"`、`pnpm typecheck`、`git diff --check` が通過した。追加確認として、全文検索で本文中の `ファイルツリー` と部分語 `ファイル` が一致行を返すことを `src/main/files/search.test.ts` に固定し、`pnpm exec vitest run src/main/files/search.test.ts` が通過した。再追加確認として、検索IPC入力の位置引数・単独文字列・別名入力・UI表示名modeの正規化、任意の `frontmatterField` が `undefined` で来た場合の扱いを `src/main/ipc/fileHandlerValidators.test.ts` に固定した。rendererからの全文、タグ、ファイル名検索入力に `frontmatterField: undefined` が混ざらないことも `src/renderer/App.test.tsx` に固定した
- 残り: Electron実機で実ワークスペースを開いた状態の目視確認は未実施

### プロパティ検索と date 互換の整理

- 方向性: プロパティ検索は固定プロパティと登録済みカスタムプロパティだけを対象にし、ワークスペース内Markdownに偶然ある未登録キーは候補・検索対象にしない。フロントマターキーとしての旧 `date` 互換は削除し、日付チャート種別 `source: "date"` とカスタム入力タイプ `date` は別概念として残す
- 実施: ファイルビューのプロパティ検索フィールドを登録済み候補から選ぶselectに変更し、renderer/mainとも未登録プロパティ検索を結果なしにした。固定プロパティ、予約名、日付レンジ入力、チャート読み取り・書き戻しから旧 `date:` 互換を外し、`plannedDate` / `actualDate` のみをチャート日付フィールドとして扱うようにした。`date` はカスタムプロパティ名として登録可能に戻し、検索・フロントマター仕様文書も更新した
- 確認: `pnpm exec vitest run src/renderer/filesSidebarModel.test.ts src/renderer/components/FilesSidebarSearch.test.tsx src/renderer/App.test.tsx src/main/files/chronicle.test.ts src/renderer/ganttChartData.test.ts src/renderer/frontmatterSettingsModel.test.ts src/renderer/components/SettingsSidebar.test.tsx src/main/ipc/workspaceHandlerValidators.test.ts src/renderer/components/Editor.test.tsx -t "検索|search|date|Date|プロパティ|frontmatter|Frontmatter|chronicle|チャート|field|Field"`、`pnpm typecheck` が通過した
- 残り: 実ワークスペースを開いたElectron実機で、プロパティ検索候補のselect表示と旧 `date:` のチャート非表示を目視確認する作業は未実施

### フェーズ終了

- 方向性: P24は、P23後の全般修正として扱った補助パネルUI、チャートビュー、検索、プロパティ/date整理までを完了範囲にして終了する
- 実施: ユーザー指示によりP24を終了扱いにし、次フェーズをP25グラフビューアップグレードへ移す
- 確認: P24終了時点の最終確認は、各修正単位の記録に従う
- 残り: グラフビュー固有の改善はP25で扱う
