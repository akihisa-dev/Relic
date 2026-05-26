# engineering/editor-engine.md

エディタエンジンの選定調査・決定を記録するドキュメント。

---

## 決定

**CodeMirror 6** を採用する。

ライブプレビューはCodeMirror 6を中心に実装する。ただし、Markdown解析・HTML安全化・KaTeX連携などは専用ライブラリを組み合わせ、CodeMirrorだけで無理に完結させない。

Markdownプレビューでは `marked` でHTMLを生成し、`marked-footnote` で脚注を追加し、`DOMPurify` で安全化する。コードブロックのハイライトには `highlight.js`、数式表示には `KaTeX` を使う。`mermaid` コードブロックの図表示には `Mermaid` を遅延読み込みで使い、生成SVGは表示前に再度 `DOMPurify` で安全化する。フロントマターのYAML読み書きには `js-yaml` を使う。

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
js-yaml                   # フロントマターYAML処理
```

主な実装位置:

- `app/src/renderer/editorExtensions.ts`: CodeMirror拡張、Markdown言語サポート、内部リンク補完、リンククリック処理
- `app/src/renderer/editorLivePreview.ts`: ライブプレビュー装飾
- `app/src/renderer/mermaidPreview.ts`: Mermaidの遅延読み込み、SVG生成、安全化、表示
- `app/src/renderer/editorTableWidget.ts`: ライブプレビュー表のDOM操作、フォーカス、CodeMirror書き戻し
- `app/src/renderer/editorTableWidgetModel.ts`: ライブプレビュー表のTSV貼り付け、選択範囲、コピー、削除、矢印移動判定の純粋処理
- `app/src/renderer/previewMarkdown.ts`: marked / marked-footnote / DOMPurify / highlight.js / KaTeX によるプレビューHTML生成
- `app/src/main/files/frontmatter.ts`、`app/src/renderer/editorFrontmatterModel.ts`: `js-yaml` によるフロントマター解析・書き戻し

---

## 参考

- [CodeMirror 公式](https://codemirror.net/)
- Obsidian の採用事例（同様のユースケース）
