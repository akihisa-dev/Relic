# テスト戦略

Relicの自動テスト、実アプリ確認、macOS配布物確認が、それぞれどの失敗を検出するかを定義する。

## 役割別の構成

`app/` で `pnpm test:inventory` を実行すると、Vitest設定と共有する収集方針を使い、すべてのテストファイルを次の主責務へ一度だけ分類する。あわせてNode・Renderer project別のファイル数、テスト宣言数、総行数、無効化・単独実行指定、700行以上の要整理候補を表示する。収集対象なのにどのprojectにも属さないファイル、またはVitestが収集するのに棚卸し対象外となるファイルがあれば失敗する。`it.each` は入力ごとの実行件数ではなく、1つのテスト宣言として数える。テスト追加のたびに変化する件数は文書へ固定せず、このコマンドの出力を現在値の正本とする。

| 役割 | 主に検出する失敗 |
|------|------------------|
| 純粋関数・モデル | parse、正規化、状態遷移、描画モデル、共有契約 |
| React表示・操作 | 利用者操作、表示状態、フォーカス、drag、保存接続 |
| Main handler・validator | IPC登録、入力拒否、Main処理への接続 |
| Preload契約 | `window.relic`の公開名、transport、IPCチャンネル |
| ファイルシステム統合 | 一時領域での読込・保存・検索・監視・設定永続化 |
| 開発・検証script | workflow、配布内容、文書、版、容量、診断処理 |
| Electron実行スモーク | Vitest外の専用コマンドで実際のElectronプロセス接続とウインドウ動作を確認 |
| macOS package | Vitest外のmacOS workflowで成果物の構造と起動を確認 |

末尾2役はVitestではなく、別プロセスで実行する確認責務を表す。Electron実行スモークは隔離した開発版を起動し、macOS packageはタグpush前の `pnpm verify:local:release` で実際のローカル成果物を起動する。

ローカル作業では、実アプリの起動、GUI操作、スクリーンショット、E2E、`smoke:electron`、`smoke:package` を、ユーザーがその作業で明示的に指示した場合だけ実行する。UI変更や自動テストで判断できない状態があることだけでは起動せず、未実施を通常変更の完了阻害条件にしない。タグpushまたはリリースが明示された場合だけは、公開前検証 `pnpm verify:local:release` に含まれる、その作業で生成した配布版の自動起動スモークまで許可されたものとして扱う。

## Electron起動スモーク

### 検出対象と分担

| 種別 | 確認すること | 実行場所 |
|------|--------------|----------|
| 開発版 | Electronプロセス、メインウインドウ、Renderer初期画面、`window.relic`、ワークスペース状態取得IPC、未登録の初期空状態 | ローカルの `pnpm smoke:electron`、Pull Request・`main`・手動のCode CI |
| 配布版 | 上記の接続に加え、package後の実行ファイル、ASAR、asset、production用HTMLから起動できること | タグpush前のローカル `pnpm verify:local:release` で `pnpm smoke:package` |

両者は異なる失敗を検出するため、一方の成功を他方の成功として扱わない。起動スモークは一時ユーザーデータだけを使い、成功・失敗にかかわらず削除する。Mainは確認結果をJSONへ記録し、起動側はMain・Preload・Rendererの標準出力、標準エラー、JSON reportを証拠として保存する。CIでは失敗時に証拠をartifactとして取得できる。

### 技術選定

| 候補 | 依存追加 | 実行時間 | OS対応 | 不安定性 | 失敗調査 |
|------|----------|----------|--------|----------|----------|
| Mainから起動境界を直接確認する専用モード（採用） | なし | 開発serverまたはpackage起動時間だけ。外側で120秒を上限にする | macOSの開発版と配布版で同じ確認本体を使用 | 座標、focus、描画待ちに依存しない | 段階別JSON reportとプロセスログを保持 |
| GUI自動操作ライブラリ | 開発依存と操作driverが必要 | 起動に操作待ちが加わる | runnerごとの表示serverと操作差を吸収する必要がある | focus、animation、座標、画面速度の影響を受ける | screenshotは得やすいが、接続失敗以前の切り分けが増える |
| 手動起動だけ | なし | 人による確認時間が毎回必要 | 各OSの実機で可能 | 自動的なflaky失敗はないが、確認漏れと手順差が残る | 観察者が記録しない限り証拠が残らない |

全操作のE2E化ではなく、実Electronでしか証明できない起動境界だけを直接確認する専用モードを採用する。ローカルで使うのはユーザーが明示した場合だけとし、その範囲でも既存のVitestで証明できない独立した受入条件があるかを先に判断する。

## 主要利用経路の保護

| 利用経路 | 主な保護層 | 代表テスト |
|----------|------------|------------|
| 保存と保存競合 | hook・Main handler・安全書込の接続、ファイル統合 | `useEditorAutoSave.test.ts`、`editorHandlers.test.ts`、`markdownFileContent.test.ts`、`markdownFileCreation.test.ts`、`markdownFileRelocation.test.ts`、`atomicWrite.test.ts`、`secureVersionedJsonStore.test.ts` |
| 外部変更と再読込 | watcher、Preload通知、Renderer状態遷移 | `workspaceWatcher.test.ts`、`preload.test.ts`、`App.externalChanges.test.tsx` |
| 検索と置換 | Main handler、検索・置換統合、Renderer操作 | `fileSearchHandlers.test.ts`、`search.test.ts`、`replace.test.ts`、`App.searchLinks.test.tsx` |
| ワークスペース切替中の非同期処理 | 共有要求世代と要求キー付きhook、切替成功から再描画までを含む旧要求の完了破棄、監視通知queue、初期・保存後の状態再取得、画像取込、Preload API差し替え時のcache破棄 | `useWorkspaceRequestGuard.test.ts`、`useWorkspaceDataRevision.test.ts`、`workspaceGraphLoader.test.ts`、`useWorkspaceGraphState.test.ts`、`useWorkspaceCardsState.test.ts`、`useWorkspaceCharts.test.tsx`、`useWorkspaceFileOpenActions.test.ts`、`useWorkspaceRegistryActions.test.ts`、`useAppSettingsState.test.ts`、`useAppFileSaved.test.ts`、`App.refresh.test.tsx`、`App.workspaceRace.test.tsx`、`editorImageDrop.test.ts` |
| ワークスペース読込復旧 | 空フォルダとパス消失・権限不足・一時障害の分類、索引・設定の部分失敗、再試行、フォルダ再指定、登録解除、利用不能時の操作停止 | `main/ipc/workspaceState.test.ts`、`main/ipc/workspaceHandlers.test.ts`、`main/ipc/workspaceRegistrationHandlers.test.ts`、`renderer/App.workspaces.test.tsx` |
| HTML・SVG・PDF出力 | Renderer生成・安全化、Main登録、入力検証、一時ウィンドウの実行と後始末 | `outputHtml.test.ts`、`previewMarkdown.test.ts`、`sanitizeOutputSvg.test.ts`、`outputHandlers.test.ts`、`diagramOutputHandlers.test.ts`、`previewPdfHandler.test.ts`、`previewPdfRuntime.test.ts`、`previewPdfValidator.test.ts` |
| Main / Preload / Renderer契約 | 共有IPC台帳を基準にPreload公開とMain登録を全件照合 | `preload/ipcContract.test.ts`、`main/ipc/ipcContract.test.ts`、`shared/ipcContract.test.ts`、`renderer/relicClient.test.ts` |
| Markdown共有走査 | コード範囲、パスのデコードと正規化をリンクとグラフの共通入力で確認 | `shared/markdownScan.test.ts`、`shared/links.test.ts`、`main/files/workspaceGraph.test.ts` |
| 設定の初期状態 | 欠損設定の読み込みごとに独立した値を生成し、同じpathの更新queueとは別の契約として確認 | `main/settings/secureVersionedJsonStore.test.ts`、`main/settings/appSettings.test.ts`、`main/settings/workspaceSettings.test.ts` |
| 設定の並行保存 | 同じ設定ファイルの更新queue、安全書き込み、保存値の保持 | `secureVersionedJsonStore.test.ts` |
| アプリ設定の起動復旧 | 壊れたJSONの内容保持退避、非対応schemaの無変更表示と明示操作後の退避、初期設定作成、専用ウインドウの権限制限と許可操作 | `main/settings/appSettingsRecovery.test.ts`、`main/settings/appSettingsRecoveryWindow.test.ts` |
| バブルの操作と描画停止 | 中断操作と確定処理の分離、テーマ参照、停止中の再描画抑制 | `BubbleView.test.tsx`、`bubbleDrawingModel.test.ts`、`bubbleViewRuntime.test.ts`、`App.charts.test.tsx` |
| クロニクルの操作 | 中断時の一時状態破棄、項目全体のhit判定、対象ファイルを開く接続 | `ChronicleCanvas.cursor.test.tsx`、`chronicleCanvasModel.test.ts` |

## 重複と不足の判断

- 同じIPCチャンネルをPreloadとMainの双方で確認するテストは重複削除しない。一方は公開APIの誤接続、他方はhandler登録漏れを検出し、失敗責務が異なる。
- 純粋モデルとReactコンポーネントで同じ操作を扱う場合も、モデルの状態遷移と実イベント接続を分けている限り維持する。
- 大量の内部スナップショットは採用せず、保存結果、拒否、状態遷移、副作用の有無を確認する。
- ワークスペース由来の非同期データは、切替直後に前の内容を返さないことと、前の要求が後から完了しても現在の内容を上書きしないことをhook単位で確認する。
- `pnpm test:inventory` とVitestは同じ収集方針を参照し、分類漏れだけでなくprojectへの収集漏れも検証scriptの回帰テストで保護する。
- 700行以上という表示は、失敗責務の分割を検討するための保守上の注意であり、機械的な分割や合否判定には使わない。共有setupの重複が増える場合や、一続きの統合シナリオとして読む方が明確な場合は、責務を確認したうえで維持する。
- 無効化または単独実行指定は、意図せず検証対象が欠ける可能性があるため、棚卸し結果に常に表示する。

## 自動化しない範囲

次は起動スモークの対象外とし、既存の自動テスト、ユーザーが明示した場合だけ行う隔離した実アプリ確認、または配布前の手動確認へ残す。

- 実OSファイル監視のイベント順序と権限差
- 出力用BrowserWindowからのPDF生成
- OSの警告表示、未署名・未公証成果物に対する利用者操作
- ファイル編集、drag、focus、図表などの包括的なGUI操作

ファイル監視、PDF、OS警告は権限、dialog、実ファイルイベントなど起動以外の条件を必要とし、短い起動確認へ混ぜると原因と保守責務が曖昧になる。利用者操作は既存のReactテストを優先し、ユーザーが明示した場合だけ、実画面でしか判断できない状態を隔離した開発版で確認する。
