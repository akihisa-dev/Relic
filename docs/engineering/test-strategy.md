# テスト戦略

Relicの自動テスト、実アプリ確認、OS別配布物確認が、それぞれどの失敗を検出するかを定義する。

## 役割別の構成

`app/` で `pnpm test:inventory` を実行すると、すべてのVitestファイルを次の主責務へ一度だけ分類する。2026年7月15日時点では186ファイルである。

| 役割 | ファイル数 | 主に検出する失敗 |
|------|-----------:|------------------|
| 純粋関数・モデル | 64 | parse、正規化、状態遷移、描画モデル、共有契約 |
| React表示・操作 | 46 | 利用者操作、表示状態、フォーカス、drag、保存接続 |
| Main handler・validator | 18 | IPC登録、入力拒否、Main処理への接続 |
| Preload契約 | 2 | `window.relic`の公開名、transport、IPCチャンネル |
| ファイルシステム統合 | 39 | 一時領域での読込・保存・検索・監視・設定永続化 |
| 開発・検証script | 17 | workflow、配布内容、文書、版、容量、診断処理 |
| Electron実行スモーク | 0 | Vitest外の専用コマンドで実際のElectronプロセス接続とウインドウ動作を確認 |
| OS別package | 0 | Vitest外のOS別workflowで成果物の構造と起動を確認 |

末尾2役はVitestファイル数ではなく、別プロセスで実行する確認責務を表す。Electron実行スモークは隔離した開発版を通常CIで起動し、OS別packageはPre-release VerificationとRelease workflowで実際の成果物を起動する。

## Electron起動スモーク

### 検出対象と分担

| 種別 | 確認すること | 実行場所 |
|------|--------------|----------|
| 開発版 | Electronプロセス、メインウインドウ、Renderer初期画面、`window.relic`、ワークスペース状態取得IPC、未登録の初期空状態 | ローカルの `pnpm smoke:electron`、Pull Request・`main`・手動のCode CI |
| 配布版 | 上記の接続に加え、package後の実行ファイル、ASAR、asset、production用HTMLから起動できること | macOS／WindowsのPre-release VerificationとDraft Release workflowで `pnpm smoke:package` |

両者は異なる失敗を検出するため、一方の成功を他方の成功として扱わない。起動スモークは一時ユーザーデータだけを使い、成功・失敗にかかわらず削除する。Mainは確認結果をJSONへ記録し、起動側はMain・Preload・Rendererの標準出力、標準エラー、JSON reportを証拠として保存する。CIでは失敗時に証拠をartifactとして取得できる。

### 技術選定

| 候補 | 依存追加 | 実行時間 | OS対応 | 不安定性 | 失敗調査 |
|------|----------|----------|--------|----------|----------|
| Mainから起動境界を直接確認する専用モード（採用） | なし | 開発serverまたはpackage起動時間だけ。外側で120秒を上限にする | Electronが動くLinux・macOS・Windowsで同じ確認本体を使用 | 座標、focus、描画待ちに依存しない | 段階別JSON reportとプロセスログを保持 |
| GUI自動操作ライブラリ | 開発依存と操作driverが必要 | 起動に操作待ちが加わる | runnerごとの表示serverと操作差を吸収する必要がある | focus、animation、座標、画面速度の影響を受ける | screenshotは得やすいが、接続失敗以前の切り分けが増える |
| 手動起動だけ | なし | 人による確認時間が毎回必要 | 各OSの実機で可能 | 自動的なflaky失敗はないが、確認漏れと手順差が残る | 観察者が記録しない限り証拠が残らない |

全操作のE2E化ではなく、実Electronでしか証明できない起動境界だけを直接確認する専用モードを採用する。追加のGUI操作が必要になった場合も、既存のVitestで証明できない独立した受入条件があるかを先に判断する。

## 主要利用経路の保護

| 利用経路 | 主な保護層 | 代表テスト |
|----------|------------|------------|
| 保存と保存競合 | hook・Main handler・安全書込の接続、ファイル統合 | `useEditorAutoSave.test.ts`、`editorHandlers.test.ts`、`markdownFiles.test.ts`、`atomicWrite.test.ts`、`secureVersionedJsonStore.test.ts` |
| 外部変更と再読込 | watcher、Preload通知、Renderer状態遷移 | `workspaceWatcher.test.ts`、`preload.test.ts`、`App.externalChanges.test.tsx` |
| 検索と置換 | Main handler、検索・置換統合、Renderer操作 | `fileSearchHandlers.test.ts`、`search.test.ts`、`replace.test.ts`、`App.searchLinks.test.tsx` |
| HTML・SVG・PDF出力 | Renderer生成・安全化、Main出力handler | `outputHtml.test.ts`、`previewMarkdown.test.ts`、`sanitizeOutputSvg.test.ts`、`outputHandlers.test.ts` |
| Main / Preload / Renderer契約 | 共有IPC台帳を基準にPreload公開とMain登録を全件照合 | `preload/ipcContract.test.ts`、`main/ipc/ipcContract.test.ts`、`shared/ipcContract.test.ts`、`renderer/relicClient.test.ts` |

## 0.6.4〜0.6.11の回帰対応

| 版 | 不具合または性能回帰 | 回帰条件を固定するテスト | 判定 |
|----|----------------------|--------------------------|------|
| 0.6.4 | 設定保存の並行更新で変更が消える | `secureVersionedJsonStore.test.ts` | 同じ保存ファイルの更新queueを一時領域で再現しており十分 |
| 0.6.5 | グラフ描画中のテーマ参照が反復する | `GraphView.test.tsx`、`graphDrawingModel.test.ts`、`graphViewRuntime.test.ts` | 表示接続と純粋描画責務を分けて維持 |
| 0.6.6 | 年表の中断操作が確定扱いになる | `ChronicleCanvas.cursor.test.tsx` | `pointercancel`時の利用者操作をコンポーネント層で再現 |
| 0.6.7 | 年表項目の一部からしか開けない | `chronicleCanvasModel.test.ts` | hit判定モデルを固定し、表示文言へ依存しない |
| 0.6.8 | 年表drag中断後に一時配置が残る | `chronicleCanvasModel.test.ts` | cancel時の一時状態破棄をモデル層で再現 |
| 0.6.9 | グラフの中断操作が確定扱いになる | `GraphView.test.tsx` | `pointercancel`と確定処理を表示接続で区別 |
| 0.6.10 | 静止中もグラフを再描画する | `GraphView.test.tsx`、`graphViewRuntime.test.ts`、`App.charts.test.tsx` | runtime停止と画面接続の両方を確認 |
| 0.6.11 | watcher開始・実行中の失敗から復旧しない | `workspaceWatcher.test.ts`、`preload.test.ts`、`App.externalChanges.test.tsx`、`shared/ipcContract.test.ts` | Main→Preload→Rendererの各契約と復旧状態を確認 |

## 重複と不足の判断

- 同じIPCチャンネルをPreloadとMainの双方で確認するテストは重複削除しない。一方は公開APIの誤接続、他方はhandler登録漏れを検出し、失敗責務が異なる。
- 純粋モデルとReactコンポーネントで同じ操作を扱う場合も、モデルの状態遷移と実イベント接続を分けている限り維持する。
- 大量の内部スナップショットは採用せず、保存結果、拒否、状態遷移、副作用の有無を確認する。
- `pnpm test:inventory` の分類漏れは低リスクで機械検知できるため、検証scriptの回帰テストで保護する。

## 自動化しない範囲

次は起動スモークの対象外とし、既存の自動テスト、対象機能の隔離した実アプリ確認、または配布前の手動確認へ残す。

- 実OSファイル監視のイベント順序と権限差
- 出力用BrowserWindowからのPDF生成
- OSの警告表示、未署名・未公証成果物に対する利用者操作
- ファイル編集、drag、focus、図表などの包括的なGUI操作

ファイル監視、PDF、OS警告は権限、dialog、実ファイルイベントなど起動以外の条件を必要とし、短い起動確認へ混ぜると原因と保守責務が曖昧になる。利用者操作は既存のReactテストを優先し、実画面だけで判断できる状態に限って隔離した開発版で確認する。
