# engineering/editor-engine.md

エディタエンジンの選定調査・決定を記録するドキュメント。

---

## 決定

**CodeMirror 6** を採用する。

ライブプレビューはCodeMirror 6を中心に実装する。ただし、Markdown解析・HTML安全化・KaTeX連携・図表レンダリングなどは専用ライブラリを組み合わせ、CodeMirrorだけで無理に完結させない。

Markdownプレビューでは `marked` でHTMLを生成し、`marked-footnote` で脚注を追加し、`DOMPurify` で安全化する。コードブロックのハイライトには `highlight.js`、数式表示には `KaTeX` を使う。`mermaid` / `d2` コードブロックの図表示には `Mermaid` と `@terrastruct/d2` を遅延読み込みで使い、生成SVGは表示前に再度 `DOMPurify` で安全化する。フロントマターのYAML読み書きには `js-yaml` を使う。

エディタ設定や表示モードの切り替えには CodeMirror 6 の `Compartment` を使う。フォント、行番号、スペルチェック、ソース/ライブプレビュー、タイプライターモード、補完候補、イベントハンドラは `reconfigure` で差し替え、`EditorView` は破棄しない。これにより本文、選択範囲、Undo/Redo履歴、フォーカス、スクロール位置を維持する。

エディタのフォント、行間、最大幅、現在行などCodeMirror固有の表示設定は、`editorThemeExtensions.ts` で `EditorView.theme` を組み立てる。Light / Darkの色はアプリ共通のCSS変数と `data-theme` に追従させ、追加のCodeMirror用ダークテーマpackageには依存しない。

ライブプレビュー装飾は、可視範囲と `@codemirror/lang-markdown` の構文木を優先して使う。インライン装飾、コードフェンス、表、`mermaid` / `d2` 図の検出は、全文を毎回走査する実装へ戻さない。CodeMirrorの制約上、表や通常コードブロックのようなブロック置換DecorationはViewPluginから直接提供できないため、StateFieldから提供する。初期化時は文書先頭の最小範囲だけでStateFieldを作り、軽量なViewPluginが `visibleRanges` をStateEffectで渡して、コードブロック・表の再構築範囲を可視範囲中心に保つ。document変更がないtransactionでは再構築せず、コードブロック・表の既存装飾外で構造に影響しない通常入力だけが入った場合は、DecorationSetを `map` で移動する。通常コードブロックは、選択が既存のコードブロック装飾や直前にソース表示したコードブロック範囲へ触れない限り、selection変更だけでは再構築しない。装飾範囲に触れた変更、改行、フェンス、表区切りなど構造に影響する可能性がある変更では、最後に同期された可視範囲を中心に再構築する。

インライン装飾はViewPluginがDecorationSetを所有し、本文、選択、viewport、focus、図表編集状態が変わった場合だけ可視範囲を再構築する。IME変換中のdocument変更では既存DecorationSetを `map` してWidgetの不要な再生成を避け、変換終了後に現在の本文から1回再構築する。

通常入力の通知ではCodeMirrorの不変な `Text` を短時間保持し、入力のたびに全文へ `toString()` を行わない。アプリ状態へ反映する80ms境界で、保留中の最新版だけを文字列化する。反映時はペインとタブIDからなる発生元ごとに本文をローカル反映として記録し、同じ本文が同じEditorのReact propsから戻った場合はCodeMirror文書の再文字列化と外部更新処理を省く。文字数・単語数とアウトラインは前回本文との最小変更範囲から更新し、上限到達時など差分更新の安全性を保証できない場合だけ全文計算へ戻す。

インライン装飾、表、通常コードブロック、数式、図表、見出し折りたたみの遅延更新は、EditorViewごとの共通フレームキューへ集約する。更新種別ごとに実行可能時刻と最新版を保持し、期限に達した更新だけを1つのtransactionで各StateFieldへ通知する。軽い即時更新は、重い更新の待機期限を解除しない。EditorViewの破棄時はキューのtimerと `requestAnimationFrame` を解除する。可視範囲の文字数と表・フェンス・数式・リストなどの記法密度から高負荷と判定した場合は短い入力待機時間を設け、判定のために全文を走査しない。

本文、ペイン内のタブ表示用メタ情報、保存状態は別の購読境界で扱う。本文更新では対象ペインのactive tabだけを更新対象とし、反対側のペインは購読値が変わらない限り再描画しない。ファイルパス集合やdirtyファイル集合は本文そのものではなく、集合を変える状態だけを依存キーにする。

外部本文の反映は共通接頭辞・接尾辞から最小のCodeMirror ChangeSetを作り、選択範囲と表示位置をその変更へmapする。全置換では従来どおり文書長へ収め、外部反映をUndo履歴へ追加しない。複数選択はCodeMirrorの状態として有効にし、既存の修飾キー操作と `changeByRange` を使うMarkdown操作へ接続する。

自動保存は、表示中の最新本文とディスクへ保存できた本文を分けて扱う。ストアの本文・保存基準・衝突状態が変わったタブIDだけを保存キューへ通知し、本文変更ごとの全タブ走査を行わない。タブ構成が変わった場合は閉じたタブと移動したタブのキューを整理する。保存中に新しい本文が生じた場合は、先行保存成功時に表示中本文を巻き戻さず保存済み基準だけを進め、後続保存の `expectedContent` にその基準を使う。先行保存が失敗した場合は待機中の後続保存を同じ比較基準のまま実行せず、次の編集または明示的なflushから再試行する。

フロントマター検査は、前回本文、検査対象の終端、YAML解析結果を保持する。最小変更範囲が検査対象より後ろにある場合は結果を再利用し、先頭区切り、YAML本文、終端区切りへ変更が触れた場合だけ `js-yaml` で再解析する。

タイプライターモードの位置計算は `EditorView.requestMeasure` へ集約し、同じ測定キーの予約では最新のカーソル位置だけを処理する。read段階で座標とスクロール位置を取得し、write段階では目標が現在位置と異なる場合だけスクロールを書き換える。

見出し折りたたみはMarkdown構文木の見出しnodeを対象範囲内だけ反復し、文書先頭からコードフェンス状態を再走査しない。探索範囲は対象見出しから最大2000行とし、構文木がコードフェンス内として扱う見出し記法を除外する。

ライブプレビュー表のセル確定は、既存の `formatTable` が生成したMarkdownを正本とし、現在の表との差分から最小のCodeMirror変更範囲を求める。整形結果が同一ならtransactionを発行せず、構造操作では表全体の安全な置換を許容する。

Wikiリンク補完は、候補生成時に正規化済み検索語を持たせ、完全一致、前方一致、部分一致用の索引を作る。補完実行時はqueryから索引キーを引き、候補を絞ってから順位付けする。候補表示数は上位候補に制限し、完全一致、前方一致、部分一致、日本語numericソートの順に並べる。

本文が1MiBを超える、または1行が80,000文字を超えるMarkdownは、Paneで一時的にソース表示として扱い、Editorへ `sourceMode` を渡す時点でライブプレビュー拡張を外す。このfallbackはユーザーの通常設定を変更せず、画面内バナーとtoastで通知する。1行長の判定では巨大な配列を作らないよう、改行までの文字数を逐次走査する。

---

## 選定理由

- Markdownを直接編集する同種用途での採用実績が豊富
- ソースモード編集とライブプレビューの両立が設計の根幹に組み込まれている
- `@codemirror/lang-markdown` による Markdown シンタックスハイライトが公式サポート
- `@codemirror/autocomplete` と `@codemirror/commands` により、内部リンク補完や履歴操作などをCodeMirror拡張として扱える
- TypeScript ネイティブで書かれており、型安全な開発が可能
- 拡張システムが強力で、内部リンク `[[...]]` などのカスタム構文も実装しやすい
- Electron との相性が良く、導入事例も多い

---

## 比較検討した選択肢

| ライブラリ | 概要 | 見送り理由 |
|-----------|------|-----------|
| CodeMirror 6 | **採用** | — |
| ProseMirror | リッチテキスト編集向け | Markdown専用ではなく、ソースモードとの切り替えが複雑になる |
| Monaco Editor | 開発者向けコード編集向け | Markdown編集用途には機能過多でバンドルサイズも大きい |

---

## 主要パッケージ

```
@codemirror/view          # エディタ本体
@codemirror/state         # 状態管理
@codemirror/lang-markdown # Markdownサポート
@codemirror/language      # 言語サポート基盤
@codemirror/autocomplete  # [[...]] などの補完
@codemirror/commands      # 履歴・標準キー操作
marked                    # MarkdownプレビューHTML生成
marked-footnote           # 脚注拡張
dompurify                 # HTML安全化
highlight.js              # コードブロックのシンタックスハイライト
katex                     # 数式表示
mermaid                   # Mermaidコードブロックの図表示
@terrastruct/d2           # D2コードブロックの図表示
js-yaml                   # フロントマターYAML処理
```

主な実装位置:

- `app/src/renderer/editorExtensions.ts`: CodeMirror拡張の既存importを保つ公開facade
- `app/src/renderer/editorExtensionAssembly.ts`: `Compartment` と拡張の初期登録・再構成順序
- `app/src/renderer/editorCompletionExtensions.ts`: Markdown言語サポート、内部リンク補完と候補索引
- `app/src/renderer/editorThemeExtensions.ts`: `EditorView.theme` によるフォント・行間・最大幅・現在行とタイプライターモード
- `app/src/renderer/editorEventExtensions.ts`: キーマップ、リンククリック、入力・IMEイベント
- `app/src/renderer/editorLivePreview.ts`: 可視行のインライン装飾と図表Widgetへの接続
- `app/src/renderer/editorLivePreviewBlockField.ts`: 通常コードブロックとブロック数式のStateField、可視範囲同期、再構築判定
- `app/src/renderer/editorLivePreviewWidgets.ts`: ライブプレビュー内のインライン表示、コードブロック、数式、脚注Widget
- `app/src/renderer/editorDiagramLivePreview.ts`: ライブプレビュー内の図表Widget
- `app/src/renderer/diagramPreview.ts`: Mermaid / D2 共通のSVG表示、安全化、エラー表示接続
- `app/src/renderer/mermaidRenderer.ts`: Mermaidの遅延読み込み、初期化、SVG生成
- `app/src/renderer/d2Renderer.ts`: D2の遅延読み込み、直列描画キュー、SVG生成
- `app/src/renderer/diagramRenderState.ts`: 図表描画の非同期状態管理
- `app/src/renderer/diagramPanZoom.ts`: 図表のpan / zoom操作
- `app/src/renderer/editorTableWidget.ts`: ライブプレビュー表のDOM操作、フォーカス、CodeMirror書き戻し
- `app/src/renderer/editorTableWidgetModel.ts`: ライブプレビュー表のTSV貼り付け、選択範囲、コピー、削除、矢印移動判定の純粋処理
- `app/src/renderer/editorContentEcho.ts`: タブごとのローカル本文反映識別
- `app/src/renderer/editorFrameUpdates.ts`: 更新種別ごとの実行期限を持つEditorViewフレームキュー
- `app/src/renderer/editorHeadingFolding.ts`: 構文木を使った見出し折りたたみ範囲判定
- `app/src/renderer/store/editorTabChangeEvents.ts`: 変更タブだけを自動保存へ渡す内部通知
- `app/src/renderer/previewMarkdown.ts`: 埋め込みを含むプレビューHTML生成とDOMPurifyによる安全化
- `app/src/renderer/previewMarkdownModel.ts`: 埋め込み・画像パス、見出しID、HTML文字列の純粋な正規化
- `app/src/renderer/previewMarkdownRenderer.ts`: marked / marked-footnoteの拡張、highlight.js、KaTeX、画像・リンクrenderer
- `app/src/main/files/frontmatter.ts`、`app/src/renderer/editorFrontmatterModel.ts`: `js-yaml` によるフロントマター解析・書き戻し

---

## 参考

- [CodeMirror 公式](https://codemirror.net/)
- Markdownを直接編集する同種用途での採用実績
