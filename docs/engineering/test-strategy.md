# テスト戦略

Relicの自動テスト、実アプリ確認、OS別配布物確認が、それぞれどの失敗を検出するかを定義する。

## 役割別の構成

`app/` で `pnpm test:inventory` を実行すると、すべてのテストファイルを次の主責務へ一度だけ分類する。2026年7月14日の監査時点では184ファイルである。

| 役割 | ファイル数 | 主に検出する失敗 |
|------|-----------:|------------------|
| 純粋関数・モデル | 63 | parse、正規化、状態遷移、描画モデル、共有契約 |
| React表示・操作 | 46 | 利用者操作、表示状態、フォーカス、drag、保存接続 |
| Main handler・validator | 18 | IPC登録、入力拒否、Main処理への接続 |
| Preload契約 | 2 | `window.relic`の公開名、transport、IPCチャンネル |
| ファイルシステム統合 | 39 | 一時領域での読込・保存・検索・監視・設定永続化 |
| 開発・検証script | 16 | workflow、配布内容、文書、版、容量、診断処理 |
| Electron実行スモーク | 0 | 実際のElectronプロセス接続とウインドウ動作 |
| OS別package | 0 | macOS／Windows成果物の構造と起動 |

末尾2役はVitestファイル数ではなく、自動テスト外の確認責務を表す。Electron実行スモークは必要時に隔離した開発版で手動確認し、OS別packageは手動のPre-release VerificationまたはRelease workflowで確認する。

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

## 自動テストだけでは証明しない範囲

次は現在モックまたは手動確認に依存する重要経路である。

- 実Electron上の`contextBridge`とプロセス間通信
- 実OSファイル監視のイベント順序と権限差
- 出力用BrowserWindowからのPDF生成
- macOS／Windowsのpackage版起動、OS警告、未署名成果物の扱い

これらを通常CIの必須E2Eへ追加する場合は、runner時間、flaky要因、隔離用ユーザーデータ、成果物保持、OS別デバッグ手順を独立した技術選定として決める。現時点では、チャンネル不一致は共有契約テスト、package構造は安全ビルド、利用者操作だけが必要な状態は隔離した開発版で検証する。
