# features/diagrams.md

Diagram / 図解機能の詳細仕様書。
Markdownファイルを正本として扱いながら、関係図と構造ツリーを専用画面で編集する振る舞いを定義する。

---

## 基本方針

- Diagramは通常の `.md` ファイルとして保存する
- Diagramの正本はMarkdownファイルの本文であり、画面上だけに存在する図解データは作らない
- Diagramファイルは、ファイル先頭のYAMLフロントマターで種類を判定する
- 図解用の保存形式は、Relic独自のバイナリや外部サービスではなく、Markdown内に書かれたYAMLとする
- DiagramファイルにDiagram以外の自由本文は混ぜない
- 壊れたDiagramファイルは、通常のDiagramキャンバス編集対象にしない
- Diagramの一時的な表示位置、zoom、選択状態はMarkdownファイルへ保存しない

Diagramファイルとして扱うフロントマターの `type` は以下の3種類に限る。

| type | 用途 |
|------|------|
| `relationship` | Markdownファイル同士を自由な関係図として配置・接続する |
| `why-tree` | 1つの起点から複数の下位ノードを掘り下げ、補助項目を整理する構造ツリー |
| `free-drawing` | Markdownファイル参照を持たない図形を自由に配置・接続する |

フロントマターで扱うDiagram共通フィールドは `type` と任意の `title` だけとする。
他のフロントマター項目が混ざっているMarkdownは、Diagramファイルとしては扱わない。

---

## Diagramサイドバー

- 左レールのDiagram入口からDiagramサイドバーを開く
- Diagram入口は機能トグルの対象ではなく、初期状態で表示する
- ワークスペース未選択時は、ファイルサイドバーと同じく既存フォルダを開く操作と新規ワークスペース作成操作を表示する
- ワークスペース選択中は、Diagram作成操作、Diagramファイル一覧、配置可能Markdownファイル一覧、または自由図用の図形一覧を表示する
- Diagramファイル一覧には、ワークスペースファイルインデックスで `diagram` と判定されたMarkdownファイルを表示する
- 配置可能Markdownファイル一覧には、Diagramではない通常Markdownファイルを表示する
- 自由図が開かれている場合は、配置可能Markdownファイル一覧の代わりに自由図用の図形一覧を表示する
- 一覧はワークスペース相対パスの昇順で表示する
- Diagramファイル一覧の項目をクリックすると、そのDiagramファイルを開く
- Diagramファイル一覧の項目は右クリックメニューからゴミ箱へ移動できる
- 配置可能Markdownファイル一覧の項目をクリックすると、開いているRelationshipへNodeとして追加する
- Relationshipが開かれていない場合、配置可能Markdownファイルの追加操作は実行しない
- 自由図用の図形一覧は、フローチャート寄りの開始/終了、処理、判断、入出力、メモを表示する
- 自由図用の図形はクリックで即時追加せず、図形をドラッグしてキャンバスへドロップした位置に追加する

Diagramサイドバーから作成できるDiagramは、Relationship、構造ツリー、自由図の3種類とする。

- Relationshipの既定ファイル名は `関係図.md` 系とする
- 構造ツリーの既定ファイル名は `構造ツリー.md` 系とする
- 自由図の既定ファイル名は `自由図.md` 系とする
- 同名ファイルがある場合は、既存ファイルを上書きせず、番号付きの別名を使う
- 作成したDiagramファイルは初期本文を書き込んだうえで開く

---

## Diagramファイルの表示

- Diagramファイルを通常ファイルタブとして開く
- ソースモードがオフの場合、通常のMarkdownエディタではなくDiagramキャンバスを表示する
- ソースモードをオンにすると、DiagramファイルのMarkdown本文を直接編集できる
- Diagramファイルでもファイルタイトルのリネーム、タブ操作、自動保存は通常Markdownファイルと同じ扱いにする
- Diagramキャンバスでの編集は、Markdown本文を書き換え、既存の自動保存に乗せる
- Diagramキャンバスには、Mermaidソースをコピーする操作を表示しない
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
- 同じNode一対のLineは最大2本まで作れる
- 同じ向きのLineは1本だけ作れる
- 2本目のLineは逆方向のLineとして作れる
- 自分自身へ向かうLineは作らない

### 操作

- Diagramサイドバーの配置可能Markdownファイルをクリックすると、開いているRelationshipへNodeを追加する
- Nodeはキャンバス上の固定サイズカードとして表示する
- 背景グリッドはNodeとLineと同じキャンバス空間に属し、視点移動と拡大縮小に追従する
- 新規Nodeの初期サイズ、リサイズ中の表示サイズ、リサイズ確定後の保存サイズは、背景グリッドに合う32px単位に揃える
- Nodeリサイズ中は、確定予定のサイズ領域を薄いハイライトで表示する
- LineはNodeを障害物として避ける経路探索により、短さを優先した折れ線として表示し、Nodeの辺へ直交する向きで接続する
- Lineは同じ行き先のものだけ接続点や経路の合流を許可し、行き先が違うものは同じNode辺でも接続点と経路を分ける
- Node内側をドラッグするとNodeを移動し、移動確定時はNode左上角の表示位置を背景グリッドの交点に揃える
- 選択済みNodeの外周を別NodeへドラッグするとLineを追加する
- Nodeを選択してDeleteまたはBackspaceを押すと、そのNodeと接続しているLineを削除する
- Lineを選択してDeleteまたはBackspaceを押すと、そのLineを削除する
- Lineを選択すると、矢印方向を反転できる
- Lineをダブルクリック、または選択中の空Labelに出る追加操作からLabelを編集できる
- Line作成直後はLabel入力へ入る
- 空白部分をドラッグすると表示位置を動かせる
- ホイール操作でカーソル位置を基準に拡大縮小できる
- NodeをクリックしただけではMarkdown本文を書き換えない
- Nodeをダブルクリックしても参照先ファイルへ移動しない

pan、zoom、選択状態、ドラッグ中の一時位置は画面だけの状態とし、Markdownファイルへ保存しない。
Node位置、Line追加、Line削除、Line方向変更、Node削除、Label編集はMarkdown本文へ書き戻す。

---

## FreeDrawing

FreeDrawingは、自由テキストを持つ図形を配置し、図形同士をLineでつなぐ自由な図解である。
Relationshipと同じキャンバス操作を使うが、Nodeは通常Markdownファイルを参照せず、Node内の `text` を正本として扱う。
Diagram種別の `type` は `free-drawing` を使う。

### 保存形式

FreeDrawingのMarkdownは以下の構造で保存する。

```yaml
---
type: free-drawing
title: 自由図
---

nodes: []
lines: []
```

| フィールド | 内容 |
|-----------|------|
| `nodes` | Diagram上のNode一覧 |
| `nodes[].id` | Diagramファイル内で一意のNode ID |
| `nodes[].shape` | 図形の種類。`terminator`、`process`、`decision`、`input-output`、`note` のいずれか |
| `nodes[].text` | Node内に表示・保存する自由テキスト |
| `nodes[].x` / `nodes[].y` | Node位置 |
| `nodes[].width` / `nodes[].height` | Nodeの固定サイズ |
| `lines` | Node同士をつなぐLine一覧 |
| `lines[].id` | Diagramファイル内で一意のLine ID |
| `lines[].from` / `lines[].to` | 接続するNode ID |
| `lines[].label` | Line中央に表示する文字 |

- `nodes` と `lines` は未指定の場合、空配列として扱う
- 既存ファイルなどで `nodes[].shape` が未指定の場合は、`process` として扱う
- `nodes[].text` は文字列として扱い、空文字を許可する
- FreeDrawingは循環、多対多、横断関係を許可する
- 同じNode一対のLineは最大2本まで作れる
- 同じ向きのLineは1本だけ作れる
- 自分自身へ向かうLineは作らない

### 操作

- 自由図を開いているとき、Diagramサイドバーには配置可能Markdownファイル一覧の代わりに図形一覧を表示する
- 図形一覧から図形をドラッグし、キャンバスへドロップすると、その位置へ図形を追加できる
- 追加できる図形は、開始/終了、処理、判断、入出力、メモとする
- 新規図形には、図形種類に応じた初期テキストを入れる
- 通常時のNodeはRelationshipと同じくNode内側をドラッグして移動できる
- Nodeをダブルクリックするとテキスト編集に入り、編集確定時にMarkdown本文へ書き戻す
- Node移動、Nodeリサイズ、Line作成、Line削除、Line方向変更、Node削除、Label編集はRelationshipと同じ操作で扱う
- 空白部分をドラッグすると表示位置を動かせる
- ホイール操作でカーソル位置を基準に拡大縮小できる

pan、zoom、選択状態、ドラッグ中の一時位置は画面だけの状態とし、Markdownファイルへ保存しない。
Nodeの図形種類、Node内テキスト、Node位置、Line追加、Line削除、Line方向変更、Node削除、Label編集はMarkdown本文へ書き戻す。

---

## 構造ツリー

構造ツリーは、1つの起点から下位ノードを掘り下げる構造エディタである。
Relationshipのような自由なNode配置、Line、Label、Node位置は持たない。
Diagram種別の `type` は `why-tree` を使う。

### 保存形式

構造ツリーのMarkdownは以下の構造で保存する。

```yaml
---
type: why-tree
title: 構造ツリー
---

labels:
  root: ルート
  node: ノード
  fact: メモ
  solution: 関連項目
  action: アクション
phenomenon:
  title: ルート
  facts: []
  solutions: []
  actions: []
  whys: []
```

| フィールド | 内容 |
|-----------|------|
| `labels.root` | ルートの表示名。未指定の場合は `ルート` |
| `labels.node` | ノードの表示名。未指定の場合は `ノード` |
| `labels.fact` | 左側補助項目の表示名。未指定の場合は `メモ` |
| `labels.solution` | 右側補助項目の表示名。未指定の場合は `関連項目` |
| `labels.action` | アクション項目の表示名。未指定の場合は `アクション` |
| `phenomenon` | 起点となるルート。必ず1つ持つ |
| `phenomenon.title` / `why.title` | 表示するルートまたはノードの本文 |
| `phenomenon.whys` / `why.whys` | 子ノードの一覧 |
| `facts` | 対象のルートまたはノードに付ける左側の補助項目 |
| `solutions` | 対象のルートまたはノードに付ける右側の補助項目 |
| `actions` | 対象のルートまたはノードに付ける右側のアクション項目 |

- `labels` は必須とする
- `labels` の各項目はユーザーが任意の表示名へ変更できる
- `labels` 内の未指定項目は `ルート` / `ノード` / `メモ` / `関連項目` / `アクション` の既定値で補う
- `phenomenon` は必須とする
- `whys` は未指定の場合、空配列として扱う
- `facts`、`solutions`、`actions` は未指定の場合、空配列として扱う
- 各テキストは文字列として扱い、空文字と改行を許可する
- 構造ツリーは循環、複数親、横断リンク、補助項目配下の子要素を表現しない

### 操作

- ルートまたはノードを選択すると、選択ノード直下に追加メニューを表示する
- 追加メニューから子ノード、左側補助項目、右側補助項目、アクション項目を追加できる
- 未選択時は追加メニューを表示しない
- 空白部分をクリックすると選択状態を解除し、追加メニューを閉じる
- 補助項目を選択している場合、追加メニューは表示しない
- 親子ノードをつなぐライン上には `labels.node` の表示名を出す
- キャンバス左側に表示名変更UIを浮かせて表示する
- 表示名変更UIは閉じることができ、閉じた後は小さな表示名ボタンから再表示できる
- 表示名変更UIで入力した `labels` はMarkdown本文へ書き戻す
- ルートの削除はできない
- ノードを削除すると、そのノード以下の子ノードも削除する
- 補助項目は個別に削除できる
- 補助項目は対象ノードの補助列として横方向に並べ、アクション項目は右側補助項目の右横に表示する
- ノードと補助項目はドラッグで同じ親・同じ種類の中の順序を変更できる
- ルート、ノード、補助項目の入力変更はMarkdown本文へ書き戻す
- ルート、ノード、補助項目の入力欄は折り返しと改行を表示できる
- 入力欄をクリックした場合も、その対象を選択状態にする
- 入力欄にフォーカスがある間のBackspaceは通常の文字削除として扱い、項目削除には使わない
- 空白部分をドラッグすると表示位置を動かせる
- ホイール操作でカーソル位置を基準に拡大縮小できる
- 表示位置、zoom、選択状態はMarkdown本文へ保存しない

---

## ファイル操作との連動

- Relationshipの `nodes[].file` は、参照先Markdownファイルのワークスペース相対パスとして扱う
- ファイル名変更、ファイル移動、フォルダ名変更、フォルダ移動では、内部リンク更新と同じ処理単位でRelationshipの `nodes[].file` も更新する
- 更新対象のRelationshipが壊れたDiagram Markdownの場合、安全に書き換えられないため更新を失敗させる
- 更新対象ファイルが外部変更されている場合は、安全側で処理を止める
- 構造ツリーはファイル参照を持たないため、ファイル名変更や移動によるDiagram内参照更新の対象にならない
- FreeDrawingはファイル参照を持たないため、ファイル名変更や移動によるDiagram内参照更新の対象にならない

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
| 編集画面 | Diagramキャンバスまたは構造ツリー編集画面 | Markdownエディタ内のライブプレビュー |
| 保存内容 | YAML構造 | コードブロックのソース文字列 |

どちらもMarkdownに書ける情報を正本にするが、保存形式と編集画面は別物として扱う。
