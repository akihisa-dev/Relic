# engineering/editor-engine.md

エディタエンジンの選定調査・決定を記録するドキュメント。

---

## 決定

**CodeMirror 6** を採用する。

ライブプレビューはCodeMirror 6を中心に実装する。ただし、Markdown解析・HTML安全化・KaTeX連携・図表レンダリングなどは専用ライブラリを組み合わせ、CodeMirrorだけで無理に完結させない。

Markdownプレビューでは `marked` でHTMLを生成し、`marked-footnote` で脚注を追加し、`DOMPurify` で安全化する。コードブロックのハイライトには `highlight.js`、数式表示には `KaTeX` を使う。`mermaid` / `d2` コードブロックの図表示には `Mermaid` と `@terrastruct/d2` を遅延読み込みで使い、生成SVGは表示前に再度 `DOMPurify` で安全化する。フロントマターのYAML読み書きには `js-yaml` を使う。

エディタ設定や表示モードの切り替えには CodeMirror 6 の `Compartment` を使う。フォント、行番号、スペルチェック、ソース/ライブプレビュー、タイプライターモード、補完候補、イベントハンドラは `reconfigure` で差し替え、`EditorView` は破棄しない。これにより本文、選択範囲、Undo/Redo履歴、フォーカス、スクロール位置を維持する。

ライブプレビュー装飾は、可視範囲と `@codemirror/lang-markdown` の構文木を優先して使う。インライン装飾、コードフェンス、表、`mermaid` / `d2` 図の検出は、全文を毎回走査する実装へ戻さない。CodeMirrorの制約上、表や通常コードブロックのようなブロック置換DecorationはStateFieldから提供し、document変更がないtransactionでは再構築しない。コードブロック・表の既存装飾外で、構造に影響しない通常入力だけが入った場合は、DecorationSetを再構築せず `map` で移動する。装飾範囲に触れた変更、改行、フェンス、表区切りなど構造に影響する可能性がある変更では再構築する。

Wikiリンク補完は、候補生成時に正規化済み検索語を持たせ、補完実行時に毎回全候補を再正規化しない。候補表示数は上位候補に制限し、完全一致、前方一致、部分一致、日本語numericソートの順に並べる。

---

## 選定理由

- Obsidian（Relicと同様のMarkdownノートアプリ）が採用しており、同用途での実績が最も豊富
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
| ProseMirror | Notion等のリッチテキストエディタで採用 | Markdown専用ではなくリッチテキスト向け。ソースモードとの切り替えが複雑になる |
| Monaco Editor | VS Codeのエディタエンジン | 開発者向けコードエディタ。ノートアプリには機能過多でバンドルサイズも大きい |

---

## 主要パッケージ

```
@codemirror/view          # エディタ本体
@codemirror/state         # 状態管理
@codemirror/lang-markdown # Markdownサポート
@codemirror/language      # 言語サポート基盤
@codemirror/autocomplete  # [[...]] などの補完
@codemirror/commands      # 履歴・標準キー操作
@codemirror/theme-one-dark # ダークテーマ補助
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

- `app/src/renderer/editorExtensions.ts`: CodeMirror拡張、Markdown言語サポート、内部リンク補完、リンククリック処理
- `app/src/renderer/editorLivePreview.ts`: ライブプレビュー装飾、数式・脚注・図表ブロック検出
- `app/src/renderer/editorLivePreviewWidgets.ts`: ライブプレビュー内のインライン表示、コードブロック、数式、脚注Widget
- `app/src/renderer/editorDiagramLivePreview.ts`: ライブプレビュー内の図表Widget
- `app/src/renderer/diagramPreview.ts`: Mermaid / D2 共通のSVG表示、安全化、エラー表示接続
- `app/src/renderer/mermaidRenderer.ts`: Mermaidの遅延読み込み、初期化、SVG生成
- `app/src/renderer/d2Renderer.ts`: D2の遅延読み込み、直列描画キュー、SVG生成
- `app/src/renderer/diagramRenderState.ts`: 図表描画の非同期状態管理
- `app/src/renderer/diagramPanZoom.ts`: 図表のpan / zoom操作
- `app/src/renderer/editorTableWidget.ts`: ライブプレビュー表のDOM操作、フォーカス、CodeMirror書き戻し
- `app/src/renderer/editorTableWidgetModel.ts`: ライブプレビュー表のTSV貼り付け、選択範囲、コピー、削除、矢印移動判定の純粋処理
- `app/src/renderer/previewMarkdown.ts`: marked / marked-footnote / DOMPurify / highlight.js / KaTeX によるプレビューHTML生成
- `app/src/main/files/frontmatter.ts`、`app/src/renderer/editorFrontmatterModel.ts`: `js-yaml` によるフロントマター解析・書き戻し

---

## 参考

- [CodeMirror 公式](https://codemirror.net/)
- Obsidian の採用事例（同様のユースケース）
