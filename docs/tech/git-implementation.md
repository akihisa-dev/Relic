# tech/git-implementation.md

Git機能の実装方法に関する調査・決定を記録するドキュメント。

---

## 決定

**isomorphic-git** を採用する。

---

## 選定理由

- JavaScript のみで書かれており、ユーザーの Mac に Git がインストールされていなくても動作する
- Relic はアプリ自体に Git 機能を内蔵するため、環境依存をゼロにできる
- Electron との相性が良く、追加のネイティブコンパイルが不要
- コミット・プッシュ・プル・ブランチ管理・差分取得など、Relic に必要な操作をすべてサポート
- GitHub OAuth との組み合わせも公式ドキュメントに例示があり、実装しやすい

---

## 比較検討した選択肢

| ライブラリ | 概要 | 見送り理由 |
|-----------|------|-----------|
| isomorphic-git | **採用** | — |
| simple-git | ユーザーの Mac にある Git コマンドを借りて動く | 一般ユーザーの Mac には Git が入っていないことがある。「Git が見つかりません」エラーのリスク |
| nodegit (libgit2) | 高機能だがインストール時にソースコードのビルドが走る | 環境によってビルドが失敗する。配布・サポートが複雑になる |

---

## GitHub 認証との連携

- GitHub OAuth で取得したトークンを isomorphic-git の `http` オプションに渡す
- OAuthで取得した認証情報はmacOS Keychainに保存し、設定JSONには保存しない
- `@isomorphic-git/http` パッケージ（Node.js 対応）を使用

---

## 主要パッケージ

```
isomorphic-git           # Git操作本体
@isomorphic-git/http     # HTTP通信（push/pull用）
```

---

## 参考

- [isomorphic-git 公式](https://isomorphic-git.org/)
