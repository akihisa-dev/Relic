# features/diagrams.md

Diagram / 図解機能の詳細仕様書。
Markdownファイルを正本として扱いながら、関係図と原因分析を専用画面で編集する振る舞いを定義する。

---

## 基本方針

- Diagramは通常の `.md` ファイルとして保存する
- Diagramの正本はMarkdownファイルの本文であり、画面上だけに存在する図解データは作らない
- Diagramファイルは、ファイル先頭のYAMLフロントマターで種類を判定する
- 図解用の保存形式は、Relic独自のバイナリや外部サービスではなく、Markdown内に書かれたYAMLとする
- DiagramファイルにDiagram以外の自由本文は混ぜない
- 壊れたDiagramファイルは、通常のDiagramキャンバス編集対象にしない
- Diagramの一時的な表示位置、zoom、選択状態はMarkdownファイルへ保存しない

Diagramファイルとして扱うフロントマターの `type` は以下の2種類に限る。

| type | 用途 |
|------|------|
| `relationship` | Markdownファイル同士を自由な関係図として配置・接続する |
| `why-tree` | 問題・現象から複数の「なぜ」を掘り下げ、根拠・解決策・実行項目を整理する |

フロントマターで扱うDiagram共通フィールドは `type` と任意の `title` だけとする。
他のフロントマター項目が混ざっているMarkdownは、Diagramファイルとしては扱わない。

---

## Diagramサイドバー

- 左レールのDiagram入口からDiagramサイドバーを開く
- Diagram入口は機能トグルの対象ではなく、初期状態で表示する
- ワークスペース未選択時は、ファイルサイドバーと同じく既存フォルダを開く操作と新規ワークスペース作成操作を表示する
- ワークスペース選択中は、Diagram作成操作、Diagramファイル一覧、配置可能Markdownファイル一覧を表示する
- Diagramファイル一覧には、ワークスペースファイルインデックスで `diagram` と判定されたMarkdownファイルを表示する
- 配置可能Markdownファイル一覧には、Diagramではない通常Markdownファイルを表示する
- 一覧はワークスペース相対パスの昇順で表示する
- Diagramファイル一覧の項目をクリックすると、そのDiagramファイルを開く
- Diagramファイル一覧の項目は右クリックメニューからゴミ箱へ移動できる
- 配置可能Markdownファイル一覧の項目をクリックすると、開いているRelationshipへNodeとして追加する
- Relationshipが開かれていない場合、配置可能Markdownファイルの追加操作は実行しない

Diagramサイドバーから作成できるDiagramは、RelationshipとWhy Treeの2種類とする。

- Relationshipの既定ファイル名は `関係図.md` 系とする
- Why Treeの既定ファイル名は `原因分析.md` 系とする
- 同名ファイルがある場合は、既存ファイルを上書きせず、番号付きの別名を使う
- 作成したDiagramファイルは初期本文を書き込んだうえで開く

---

## Diagramファイルの表示

- Diagramファイルを通常ファイルタブとして開く
- ソースモードがオフの場合、通常のMarkdownエディタではなくDiagramキャンバスを表示する
- ソースモードをオンにすると、DiagramファイルのMarkdown本文を直接編集できる
- Diagramファイルでもファイルタイトルのリネーム、タブ操作、自動保存は通常Markdownファイルと同じ扱いにする
- Diagramキャンバスでの編集は、Markdown本文を書き換え、既存の自動保存に乗せる
- Diagramファイルのステータスバーには、通常の文字数・単語数ではなくDiagram内容の件数を表示する
- Diagramとして読めない形式の場合は、Diagramキャンバスに無効なファイルであることを表示する

---

## Relationship

Relationshipは、通常MarkdownファイルをNodeとして配置し、Node同士をLineでつなぐ自由な関係図である。

### 保存形式

RelationshipのMarkdownは以下の構造で保存する。

```yaml
---
type: relationship
title: 関係図
---

nodes: []
lines: []
```

| フィールド | 内容 |
|-----------|------|
| `nodes` | Diagram上のNode一覧 |
| `nodes[].id` | Diagramファイル内で一意のNode ID |
| `nodes[].file` | Nodeが指す通常Markdownファイルのワークスペース相対パス |
| `nodes[].x` / `nodes[].y` | Node位置 |
| `nodes[].width` / `nodes[].height` | Nodeの固定サイズ |
| `lines` | Node同士をつなぐLine一覧 |
| `lines[].id` | Diagramファイル内で一意のLine ID |
| `lines[].from` / `lines[].to` | 接続するNode ID |
| `lines[].label` | Line中央に表示する文字 |

- `nodes` と `lines` は未指定の場合、空配列として扱う
- Nodeの表示名は、`nodes[].file` の拡張子を除いたファイル名とする
- Nodeのツールチップには、参照先ファイルパスを表示する
- Relationshipは循環、多対多、横断関係を許可する
- 同じNode同士を複数回つなぐLineは作らない
- 自分自身へ向かうLineは作らない

### 操作

- Diagramサイドバーの配置可能Markdownファイルをクリックすると、開いているRelationshipへNodeを追加する
- Nodeはキャンバス上の固定サイズカードとして表示する
- Node内側をドラッグするとNodeを移動する
- 選択済みNodeの外周を別NodeへドラッグするとLineを追加する
- Nodeを選択してDeleteまたはBackspaceを押すと、そのNodeと接続しているLineを削除する
- Lineを選択してDeleteまたはBackspaceを押すと、そのLineを削除する
- Lineをダブルクリック、または選択中の空Labelに出る追加操作からLabelを編集できる
- Line作成直後はLabel入力へ入る
- 空白部分をドラッグすると表示位置を動かせる
- ホイール操作でカーソル位置を基準に拡大縮小できる
- NodeをクリックしただけではMarkdown本文を書き換えない
- Nodeをダブルクリックしても参照先ファイルへ移動しない

pan、zoom、選択状態、ドラッグ中の一時位置は画面だけの状態とし、Markdownファイルへ保存しない。
Node位置、Line追加、Line削除、Node削除、Label編集はMarkdown本文へ書き戻す。

---

## Why Tree

Why Treeは、問題・現象から「なぜ」を掘り下げる原因分析用の構造エディタである。
Relationshipのような自由なNode配置、Line、Label、Node位置は持たない。

### 保存形式

Why TreeのMarkdownは以下の構造で保存する。

```yaml
---
type: why-tree
title: 原因分析
---

phenomenon:
  title: 問題・現象
  facts: []
  solutions: []
  actions: []
  whys: []
```

| フィールド | 内容 |
|-----------|------|
| `phenomenon` | 問題・現象。必ず1つ持つ |
| `phenomenon.title` / `why.title` | 表示する問題・原因の本文 |
| `phenomenon.whys` / `why.whys` | 子Whyの一覧 |
| `facts` | 対象のPhenomenonまたはWhyを支える根拠一覧 |
| `solutions` | 対象のPhenomenonまたはWhyに対する解決策一覧 |
| `actions` | 対象のPhenomenonまたはWhyに対する実行項目一覧 |

- `phenomenon` は必須とする
- `whys` は未指定の場合、空配列として扱う
- 旧形式の単数 `why` が書かれている場合は、読み込み時に `whys` の先頭要素として扱い、保存時は `whys` へ正規化する
- `facts`、`solutions`、`actions` は未指定の場合、空配列として扱う
- 各テキストは空白を除いた文字列として扱う
- Why Treeは循環、複数親、横断リンク、Fact / Solution / Action配下の子要素を表現しない

### 操作

- PhenomenonまたはWhyを選択すると、選択ノード直下に追加メニューを表示する
- 追加メニューからWhy、Fact、Solution、Actionを追加できる
- Fact、Solution、Actionを選択している場合、追加メニューは表示しない
- Phenomenonの削除はできない
- Whyを削除すると、そのWhy以下の子Whyも削除する
- Fact、Solution、Actionは個別に削除できる
- Phenomenon、Why、Fact、Solution、Actionの入力変更はMarkdown本文へ書き戻す
- 入力欄をクリックした場合も、その対象を選択状態にする
- 入力欄にフォーカスがある間のBackspaceは通常の文字削除として扱い、項目削除には使わない

---

## ファイル操作との連動

- Relationshipの `nodes[].file` は、参照先Markdownファイルのワークスペース相対パスとして扱う
- ファイル名変更、ファイル移動、フォルダ名変更、フォルダ移動では、内部リンク更新と同じ処理単位でRelationshipの `nodes[].file` も更新する
- 更新対象のRelationshipが壊れたDiagram Markdownの場合、安全に書き換えられないため更新を失敗させる
- 更新対象ファイルが外部変更されている場合は、安全側で処理を止める
- Why Treeはファイル参照を持たないため、ファイル名変更や移動によるDiagram内参照更新の対象にならない

---

## 検索・リンク・タグとの関係

- Diagramファイルも `.md` ファイルであるため、全文検索の対象に含める
- Diagramファイル内のYAML本文は、Diagramの保存形式として検索対象になる
- DiagramサイドバーのDiagram一覧と配置可能Markdown一覧は、ワークスペースファイルインデックスを使う
- Relationshipの `nodes[].file` は内部リンク記法ではないため、右パネルのアウトゴーイングリンクやバックリンク一覧には表示しない
- Relationshipの `nodes[].file` はファイル名変更・移動時の参照更新対象には含める
- Diagramファイルは通常Markdownファイルと同じ `.md` ファイルだが、ファイルツリーでは通常Markdownと同じファイルとして表示する

---

## 図表コードブロックとの違い

Diagram / 図解ファイルは、`mermaid` / `d2` の図表コードブロックとは別の機能である。

| 項目 | Diagram / 図解ファイル | 図表コードブロック |
|------|------------------------|--------------------|
| 保存場所 | `.md` ファイル全体 | Markdown本文中のコードブロック |
| 判定 | フロントマター `type` | コードブロック言語名 |
| 編集画面 | DiagramキャンバスまたはWhy Tree編集画面 | Markdownエディタ内のライブプレビュー |
| 保存内容 | YAML構造 | コードブロックのソース文字列 |

どちらもMarkdownに書ける情報を正本にするが、保存形式と編集画面は別物として扱う。
