---
name: relic-change-electron-boundaries
description: Relicのmain・preload・renderer間のElectron境界、型付きIPC、window.relic、IPC送信元認可と入力検証、BrowserWindow安全設定、外部遷移・権限・CSPを追加・変更し、処理前の拒否と契約回帰テストまで整合させる。IPCチャンネル追加、preload API変更、main handler登録、validator・送信元・上限変更、ウィンドウ生成・終了・通知の安全条件変更に使う。Markdown出力ウィンドウはrelic-change-markdown-output、添付ファイルの読込・表示契約はrelic-change-attachments、構造監査だけはrelic-audit-code-health、ElectronやForgeの更新はrelic-update-dependencies、配布診断はrelic-debug-packagingを優先する。
---

# Relic Electron Boundary Change

## 作業境界を決める

1. 調査、説明、レビューだけの依頼では編集しない。追加、変更、修正が明示されている場合だけ実装する。
2. `git status --short` を確認し、無関係な差分を変更、取消、ステージしない。
3. `docs/engineering/architecture.md`、`docs/development.md` と対象機能の正本を読む。
4. rendererからOS処理までの入力、検証、処理、結果、通知の流れを先に特定する。
5. ファイルやパスを扱う場合は `docs/engineering/file-access-boundaries.md` も確認する。

## IPC契約を設計する

1. 型、チャンネル、部分API、契約情報を用途に対応する `app/src/shared/ipc/*.ts` へ置く。
2. `shared/ipc.ts` を既存import向けのre-export境界として保ち、`RelicApi` をflatなAPIとして維持する。
3. 既存チャンネル文字列と契約versionを無断で変えず、必要な変更では互換性と利用箇所を確認する。
4. main・preload・rendererをまたぐ入力と出力を共有型で定義し、handlerでは外部入力を未検証として扱う。
5. 文字列長、パス長、配列件数、本文byte数など、操作量に応じた共有上限を定めて型検証と同じ境界で拒否する。
6. `invoke`、通知、購読、lifecycleから、操作の性質に合う登録方式を選ぶ。
7. 汎用ファイル操作や任意クリップボード読み取りなど、必要以上に強いAPIを公開しない。
8. 成功と失敗を呼出側が判定できる形で返し、Rendererへ返す詳細を安全化する。
9. 旧入力を残す場合は互換アダプタへ隔離し、現行処理へ旧形式の分岐を広げない。
10. `invoke` handlerは入力検証より前に、現在のメインウィンドウの `webContents` 由来であることを中央境界で認可する。通知型など共通handlerを通らないeventも同じ送信元条件を個別に適用する。

## 実装する

1. shared契約、preload公開、main handler、renderer clientの順に同じ操作を追跡できる形で整合させる。
2. preloadでは契約に対応する最小の `ipcRenderer` 呼び出しだけを `contextBridge` へ公開する。
3. rendererでは `window.relic` を直接参照せず、既存のclient境界から利用する。
4. main handlerは送信元を認可し、入力を検証してから、責務を持つserviceやfile処理へ接続する。
5. active workspaceが必要な操作は未選択時に処理せず、書き込み直前の安全条件も再確認する。
6. subscribeや終了確認ではlistenerの重複、解除漏れ、破棄後の通知を防ぐ。
7. BrowserWindowではcontext isolation、sandbox、web securityと、main・出力ウィンドウで分離された一時session partitionを維持し、Node.js統合を有効にしない。
8. 新規ウィンドウ、webview、権限要求、許可外遷移を拒否し、外部URLは現行許可範囲だけをOSへ渡す。
9. CSPは機能に必要な最小範囲だけを許可し、開発版の例外をpackage版へ持ち込まない。
10. メインウィンドウの破棄・差替え中や送信元を確認できないeventは拒否し、handler本体、ファイル作成、設定変更、通知などの副作用を開始しない。

入力検証を変更した場合は、validator単体の成功だけで完了としない。main handlerが不正入力、上限超過、未選択workspaceを処理本体へ渡さず、Rendererが失敗を判定できるところまでを同じ契約として扱う。

## 検証する

1. shared、preload、mainのIPC契約テストを更新し、API、チャンネル、登録方式、入力検証要否を一致させる。
2. handlerとvalidatorの対象テストへ正常入力、不正入力、上限境界、過大入力、処理未実行、失敗結果を追加する。
3. IPC送信元を変えた場合は、現在のメインウィンドウ由来の許可、別・破棄済み・不明なsenderの拒否、拒否時に処理本体とファイル・設定副作用がないことを確認する。
4. パス入力では絶対パス、`..`、NUL文字、外部を指すシンボリックリンクを必要に応じて確認する。
5. ウィンドウ変更ではwindow options、security、終了保護、出力ウィンドウの対象テストを実行する。
6. IPC送信元・入力検証、handlerの仕様分岐、ファイル操作へ触れた場合は、対象テストまたは回帰テストを追加し、`app/` で `pnpm verify` を実行する。その他の境界変更でも `pnpm architecture:check`、`pnpm typecheck` と対象のNode・rendererテストを実行し、影響が広い場合は `pnpm verify` を実行する。
7. ユーザーがlifecycleの実確認を明示的に指示した場合だけ、その作業で起動した開発版と一時userDataを使う。
8. ユーザーから見える契約や安全条件を変えた場合は、関連機能文書とarchitectureを同期する。
9. `git diff --check` と全差分を確認し、秘密情報、絶対パス、一時ログを残さない。

## 完了する

変更した契約、検証した入力境界、安全条件、互換性、テスト、未確認項目を報告する。コミットする場合は `$relic-commit` に従う。
