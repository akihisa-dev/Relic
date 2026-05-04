# tech/editor-engine.md

エディタエンジンの選定調査・決定を記録するドキュメント。

---

## 決定

**CodeMirror 6** を採用する。

ライブプレビューはCodeMirror 6を中心に実装する。ただし、Markdown解析・HTML安全化・KaTeX連携などは専用ライブラリを組み合わせ、CodeMirrorだけで無理に完結させない。

---

## 選定理由

- Obsidian（Relicと同様のMarkdownノートアプリ）が採用しており、同用途での実績が最も豊富
- ソースモード編集とライブプレビューの両立が設計の根幹に組み込まれている
- `@codemirror/lang-markdown` による Markdown シンタックスハイライトが公式サポート
- TypeScript ネイティブで書かれており、型安全な開発が可能
- 拡張システムが強力で、内部リンク `[[...]]` やタグ `#tag` のカスタム構文も実装しやすい
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
```

---

## 参考

- [CodeMirror 公式](https://codemirror.net/)
- Obsidian の採用事例（同様のユースケース）
