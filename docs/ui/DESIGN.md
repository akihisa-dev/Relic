---
name: Monochrome Blue
colors:
  # アクセントブルー（通常操作・情報）
  primary: '#00628c'
  on-primary: '#ffffff'
  primary-container: '#007caf'
  on-primary-container: '#fcfcff'
  inverse-primary: '#86cfff'
  primary-fixed: '#c8e6ff'
  primary-fixed-dim: '#86cfff'
  on-primary-fixed: '#001e2e'
  on-primary-fixed-variant: '#004c6d'

  # ウォームオレンジ（注意・確定・不可逆）
  tertiary: '#b02f00'
  on-tertiary: '#ffffff'
  tertiary-container: '#ff5722'
  on-tertiary-container: '#541200'
  tertiary-fixed: '#ffdbd1'
  tertiary-fixed-dim: '#ffb5a0'
  on-tertiary-fixed: '#3b0900'
  on-tertiary-fixed-variant: '#862200'

  # セカンダリ（グレースケール）
  secondary: '#5e5e5e'
  on-secondary: '#ffffff'
  secondary-container: '#e0e0e0'
  on-secondary-container: '#626262'
  secondary-fixed: '#e4e4e4'
  secondary-fixed-dim: '#c6c6c6'
  on-secondary-fixed: '#1c1c1c'
  on-secondary-fixed-variant: '#474747'

  # サーフェス
  surface: '#ffffff'
  surface-dim: '#e8e8e8'
  surface-bright: '#ffffff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#fafafa'
  surface-container: '#f4f4f4'
  surface-container-high: '#eeeeee'
  surface-container-highest: '#e8e8e8'
  surface-variant: '#eeeeee'
  on-surface: '#1c1c1c'
  on-surface-variant: '#5e5e5e'
  inverse-surface: '#303030'
  inverse-on-surface: '#f0f0f0'

  # アウトライン
  outline: '#8a8a8a'
  outline-variant: '#e0e0e0'

  # 背景
  background: '#ffffff'
  on-background: '#1c1c1c'

  # エラー
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'

dark-colors:
  # アクセントブルー（通常操作・情報）- ライトモードと同値
  primary: '#00628c'
  on-primary: '#ffffff'
  primary-container: '#007caf'
  on-primary-container: '#fcfcff'
  inverse-primary: '#86cfff'
  primary-fixed: '#c8e6ff'
  primary-fixed-dim: '#86cfff'
  on-primary-fixed: '#001e2e'
  on-primary-fixed-variant: '#004c6d'

  # ウォームオレンジ（注意・確定・不可逆）- ライトモードと同値
  tertiary: '#b02f00'
  on-tertiary: '#ffffff'
  tertiary-container: '#ff5722'
  on-tertiary-container: '#541200'
  tertiary-fixed: '#ffdbd1'
  tertiary-fixed-dim: '#ffb5a0'
  on-tertiary-fixed: '#3b0900'
  on-tertiary-fixed-variant: '#862200'

  # セカンダリ（グレースケール）
  secondary: '#9e9e9e'
  on-secondary: '#131313'
  secondary-container: '#2e2e2e'
  on-secondary-container: '#b8b8b8'
  secondary-fixed: '#282828'
  secondary-fixed-dim: '#404040'
  on-secondary-fixed: '#e6e6e6'
  on-secondary-fixed-variant: '#9e9e9e'

  # サーフェス
  surface: '#131313'
  surface-dim: '#0e0e0e'
  surface-bright: '#252525'
  surface-container-lowest: '#1a1a1a'
  surface-container-low: '#1f1f1f'
  surface-container: '#252525'
  surface-container-high: '#2c2c2c'
  surface-container-highest: '#333333'
  surface-variant: '#333333'
  on-surface: '#e6e6e6'
  on-surface-variant: '#9e9e9e'
  inverse-surface: '#e6e6e6'
  inverse-on-surface: '#2e2e2e'

  # アウトライン
  outline: '#6b6b6b'
  outline-variant: '#2e2e2e'

  # 背景
  background: '#131313'
  on-background: '#e6e6e6'

  # エラー - ライトモードと同値
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'

typography:
  display-lg:
    fontFamily: System UI
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: System UI
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: System UI
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: System UI
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: System UI
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: System UI
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: System UI
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  metric-xl:
    fontFamily: System UI
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.03em
  code-md:
    fontFamily: "Menlo, SF Mono, Consolas, monospace"
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px

rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px

spacing:
  xs: 4px
  base: 8px
  sm: 12px
  md-sm: 16px
  md: 24px
  gutter: 24px
  margin: 32px
  lg: 48px
  xl: 80px
---

## Overview

白を主体とするクリーンなモノクロームデザインシステムです。画面の大部分は白と薄いグレーで構成し、黒は本文・見出し・必要な境界に限って使います。有彩色は2色のみ、いずれも**ほんのアクセント**として機能します。

> 画面の90%はモノクロームである。有彩色はそこに意味を与えるために存在する。

ブルーとオレンジは多用しません。画面の通常状態はモノクロームで保ち、ブルーは情報や現在の対象を伝えるために、オレンジはユーザーに一呼吸置かせたい場面にだけ使います。

**2アクセントの役割：**

> ブルーは「案内と情報」——通常操作、リンク、現在の対象、補助的な状態表示に使う。
> オレンジは「注意を伴う決定」——最終確定、不可逆操作、危険、強い注意にだけ使う。

**デザイン原則：**

1. **モノクロームが主役である。** 有彩色は脇役。背景・カード・セクション区切り・番号・アイコンなど、情報の器にあたる部分はすべてグレースケールで構成する。
2. **ライトモードは白が主役である。** 黒い面で締めるのではなく、白い面・薄いグレーの区切り・十分な余白で清潔感を作る。黒は本文、見出し、必要なアイコンに限る。
3. **モノクロ領域のすべての色は彩度ゼロ（R=G=B の完全無彩色）でなければならない。** オレンジ混じりのベージュや青みがかったグレーをモノクロとして使ってはならない。白は白、グレーはグレー、黒は黒である。
4. **アクセントとモノクロの間にグラデーションはない。** 薄いオレンジも濃い青も、それが「アクセント要素として配置された色」である限り許容される。しかし「モノクロの器」に色味を持ち込んではならない。アクセントはモノクロームの中にポツンと存在するからこそ機能する。
5. **ブルーは通常のアクセントである。** リンク・情報ラベル・現在の対象・通常のプライマリ操作・フォーカスに使う。ブルーも装飾ではなく、ユーザーの理解や移動を助ける場所に限る。
6. **オレンジは通常操作に使わない。** ボタン、タブ、ツールバー、リスト選択、フォーカス、通常の現在地表示にオレンジを使ってはならない。オレンジは最終確定・不可逆・危険・強い注意に限る。
7. **アクセントカラーは装飾ではなく信号である。** 「押してほしい」「今ここにいる」「ここに注意してほしい」という意味を持たない場所に、有彩色を置いてはならない。色を使う前に、その色がユーザーへ伝える行動・現在地・情報を説明できなければならない。
8. **有彩色で大きな面を塗らない。** ブルー・オレンジともに、カード背景・セクション背景・大きな囲みへの使用を禁止する。例外は小さなボタンや小型バッジなど、意味を持つ操作・情報要素に限る。

---

## Colors

パレットは**モノクローム基盤**と**2つの機能的アクセント**で構成されます。通常時のアクセントはブルー、例外時の注意色はオレンジです。

### 通常アクセント：ブルー

`primary`（`#00628c`）は、情報・案内・通常の主操作を示す色です。Relicの日常操作はここに寄せ、オレンジを増やさないことを優先します。

| 使ってよい場所 | トークン |
|------|---------|
| 通常のプライマリボタンの背景 | `primary-container` |
| フォーカスリング・入力フィールドのアクティブボーダー | `primary` |
| リンク・内部リンク・外部リンクアイコン | `primary` |
| 現在の対象・補助的な状態表示 | `primary` |
| 小型の情報バッジ背景 | `primary-fixed` |

| 使ってはいけない場所 |
|------|
| カード・パネル・セクションの背景塗り |
| 装飾目的のボーダーや区切り線 |
| 色がなくても分かる通常テキストの強調 |
| 注意・危険・不可逆操作 |

### 注意カラー：ウォームオレンジ

`tertiary-container`（`#ff5722`）は、最も強い注意色です。通常操作に使うと画面全体が急かして見えるため、使う場所を厳しく制限します。

| 使ってよい場所 | トークン |
|------|---------|
| 削除・破棄・上書きなど不可逆操作の確定ボタン | `tertiary-container` |
| 危険・強い注意のステータス | `tertiary` |
| クリティカルな数値・ピーク値のテキスト | `tertiary-container` |
| 警告バッジ背景 | `tertiary-fixed` |

| 使ってはいけない場所 |
|------|
| 通常のプライマリボタン |
| 通常のフォーカスリング |
| 通常のナビゲーション現在地 |
| タブ・ツールバー・リストの選択状態 |
| カード・パネル・セクションの背景塗り |

### グレースケール基盤

画面の大部分を占める要素——背景・カード・セクション区切り・番号・アイコン・ボーダー——はすべてグレースケールで構成します。ライトモードでは白を最も広い面に使い、薄いグレーは区切りと階層にだけ使います。有彩色が少量であるほど、登場したときの意味が強くなります。

**すべての surface・secondary・outline トークンは彩度ゼロの完全無彩色です。** 実装時にこれらのトークンを色味のある値で上書きしてはなりません。

---

## Typography

現行実装では、UI全体に macOS / OS 標準のシステムフォント（`-apple-system`, `SF Pro Text`, `Hiragino Sans`, `Yu Gothic`, `system-ui` 相当）を使用します。コードブロックやカードパスなどの等幅表示には Menlo / SF Mono / Consolas 系を使用します。階層はウェイトの変化によって確立し、色による区別は最小限に抑えます。

| スタイル      | フォント | サイズ | ウェイト | 行間  | レタースペーシング | 用途                 |
|---------------|----------|--------|----------|-------|--------------------|----------------------|
| `display-lg`  | System UI | 48px   | 700      | 56px  | −0.02em            | 最大見出し           |
| `headline-lg` | System UI | 32px   | 600      | 40px  | −0.01em            | セクション見出し     |
| `headline-md` | System UI | 24px   | 600      | 32px  | —                  | サブセクション見出し |
| `body-lg`     | System UI | 18px   | 400      | 28px  | —                  | 主要本文             |
| `body-md`     | System UI | 16px   | 400      | 24px  | —                  | 標準本文             |
| `body-sm`     | System UI | 14px   | 400      | 20px  | —                  | 補足・キャプション   |
| `label-md`    | System UI | 12px   | 600      | 16px  | +0.05em            | ラベル・メタデータ   |
| `metric-xl`   | System UI | 40px   | 700      | 48px  | −0.03em            | 数値・状態指標       |
| `code-md`     | Mono     | 14px   | 400      | 22px  | —                  | コードブロック・インラインコード |

**運用ルール：**

- **ディスプレイ & ヘッドライン** はセミボールド以上 + タイトなレタースペーシングで権威あるプレゼンスを演出します。
- **`metric-xl`** は数値・状態の強調に使用します。通常の情報値は `primary`（ブルー）、クリティカルな状態のみ `tertiary-container`（オレンジ）を適用します。
- **`label-md`** は大文字 + レタースペーシング拡大でメタデータを本文から色なしで分離します。
- テキストリンクには `body-md` または `body-sm` に `primary`（ブルー）を適用します。アンダーラインはホバー時のみ表示します。
- **`code-md`** はインラインコード・コードブロック・カードパスなどすべての等幅表示に使用します。背景には `surface-container`（グレー）を当てます。

---

## Layout & Spacing

**8px リズム**に基づいたフルードグリッドシステムです。

| トークン  | 値    | 用途                           |
|-----------|-------|--------------------------------|
| `xs`      | 4px   | コンポーネント内の極小余白     |
| `base`    | 8px   | グリッドの基準単位             |
| `sm`      | 12px  | コンポーネント内パディング     |
| `md-sm`   | 16px  | ボタンパディング・リスト行高   |
| `md`      | 24px  | 要素間の標準余白               |
| `gutter`  | 24px  | グリッドのガター幅             |
| `margin`  | 32px  | レイアウトマージン             |
| `lg`      | 48px  | セクション間の余白             |
| `xl`      | 80px  | 大ブロック間の余白             |

現行アプリはデスクトップ向けの固定シェルを前提とし、左レール、カードサイドバー、メインエリア、右パネルの幅で情報密度を調整します。マージンとガターは余裕を持たせ、アクセントカラーの要素が十分な空間を持つことで即座に識別できるようにします。

- 独立したコンテンツブロックの区切りには `lg` / `xl` を使用します。
- コンポーネント内部のパディングには `xs` / `sm` / `md-sm` を使用します。

---

## Elevation

奥行きは**色の濃淡による階層**と微細な拡散シャドウで表現します。エレベーションは状態変化の手段として使いません。

| レイヤー | 背景色 | ボーダー | 用途 |
|---------|--------|---------|------|
| ベース | `surface`（`#ffffff`） | なし | ページ背景 |
| コンテナ | `surface-container-lowest`（`#ffffff`） | 1px `outline-variant` | カード・パネル |
| 浮上要素 | `surface-container-lowest`（`#ffffff`） | なし + 拡散シャドウ | モーダル・ドロップダウン |

**シャドウ：** 不透明度 5〜8%、色味なし、超拡散。重厚さより「軽い浮き上がり」を表現します。

**アクティブ状態：** 一般的な選択中・オン状態は、背景の濃淡・ボーダーの太さ・文字ウェイトで表現します。オレンジのボーダーやラインを、単なる選択状態の装飾として使ってはなりません。ブルーを使う場合も、現在の対象やリンクなど、案内として意味がある場合に限ります。

**現在地の表示：** グローバルナビゲーションやサイドナビゲーションなど、ユーザーが「今どこにいるか」を把握するための主要な現在地表示には、`primary`（ブルー）の細いインジケーターラインを使用できます。通常のリスト選択はグレーで表現します。

---

## Shapes

基本の角丸は **`DEFAULT`（0.5rem / 8px）** です。

| トークン  | 値      | 用途                                   |
|-----------|---------|----------------------------------------|
| `sm`      | 0.25rem | チェックボックス・小型インジケーター   |
| `DEFAULT` | 0.5rem  | ボタン・入力フィールド・カード（標準） |
| `md`      | 0.75rem | モーダル・大型パネル                   |
| `lg`      | 1rem    | ボトムシート・サイドパネル             |
| `xl`      | 1.5rem  | フルスクリーンオーバーレイ             |
| `full`    | 9999px  | アバター・ラジオボタン・ピル型チップ   |

チェックボックスは `sm`（0.25rem）を維持し、`full` のラジオボタンと視覚的に区別します。

---

## Components

### ボタン

| 種類 | 背景 | テキスト | ボーダー | 角丸 | ホバー |
|------|------|---------|---------|------|--------|
| プライマリ | `primary-container`（`#007caf`） | `on-primary`（白） | なし | `DEFAULT` | 若干暗化 |
| セカンダリ | `secondary-container` | `on-secondary-container` | なし | `DEFAULT` | 若干暗化 |
| アウトライン | 透明 | `on-surface` | 1px `outline` | `DEFAULT` | `surface-container` 背景 |
| 注意・危険 | `tertiary-container`（`#ff5722`） | `on-tertiary`（白） | なし | `DEFAULT` | 若干暗化 |

### ナビゲーション

主要ナビゲーションの現在地は、テキストを太字 `on-surface`（`#1c1c1c`）にし、必要に応じて3px の `primary`（ブルー）インジケーターラインを添えます。サイドナビは縦ライン、トップナビは横ラインです。

ただし、このインジケーターは現在地を示すためのものです。ボタンのオン状態、ツールバーの選択状態、カードやリスト項目の強調に転用してはなりません。

### 入力フィールド

ボーダー `outline-variant`・8px 角丸。フォーカス時にボーダーが `primary`（ブルー）へトランジションします。エラー時は `error` へトランジションします。

### チップ

| 種類 | 背景 | テキスト | ボーダー |
|------|------|---------|---------|
| デフォルト | `surface-container` | `on-surface-variant` | なし |
| アクティブ（操作系） | `surface-container-highest` | `on-surface` | 1px `outline` |
| 情報系バッジ | `primary-fixed`（薄青） | `on-primary-fixed` | なし |
| 情報系アウトライン | 透明 | `primary` | 1px `primary` |
| 注意系バッジ | `tertiary-fixed`（薄オレンジ） | `on-tertiary-fixed` | なし |

### 選択ハイライト

`outline`（グレー）の 1px ボーダー + `surface-container-high` の背景。選択状態に有彩色は使わない。識別はボーダーの太さ（2px）と背景の濃淡で行う。`sm`（0.25rem）角丸。

### カード

背景 `surface-container-lowest`（`#ffffff`）・1px `outline-variant` ボーダー・`DEFAULT`（8px）角丸。

カードのボーダーと背景は常にグレースケールで表現します。強調・推奨・グルーピングの差異は、ボーダーの太さ（1px → 2px）と背景の濃淡（`surface-container-lowest` → `surface-container-low`）の組み合わせで表現します。

**カードに有彩色を使う場面は存在しない。** オレンジや青のボーダー・背景はいかなる理由があっても禁止します。

### ステップ番号・連番インジケーター

手順の番号やステップを示す丸・バッジは `on-surface`（黒）または `surface-container-highest`（濃いグレー）で塗ります。オレンジの丸は警告や不可逆操作と混同を招くため禁止します。

### ラベル・バッジ（推奨・ステータス・カウント）

「推奨」「おすすめ」「新着」などのラベルはグレー系（`surface-container-highest` 背景・`on-surface-variant` テキスト）で表示します。重要度の強調にオレンジを使ってはなりません。オレンジは注意・危険・不可逆の意味を持つ場所だけです。

情報系のステータス（件数・進捗・分類）は `primary-fixed` 背景・`on-primary-fixed` テキストの小型バッジで表示します。

エラー・警告系は `error-container` 背景・`on-error-container` テキストを使います。

### メトリクス表示

`metric-xl` スタイルを基本は `on-surface` で表示します。情報的なステータス値には `primary`（ブルー）を適用します。クリティカルな状態・ピーク値のみ `tertiary-container`（オレンジ）を適用します。

---

## Motion

アニメーションは**滑らかで落ち着いた**印象を目指します。UIの操作感を損なわない範囲で、状態変化を柔らかく伝えます。装飾的なアニメーションは使いません。

### Duration（時間）

| トークン           | 値     | 用途                                     |
|--------------------|--------|------------------------------------------|
| `duration-fast`    | 120ms  | チェックボックス・トグル・小型インタラクション |
| `duration-normal`  | 200ms  | ホバー・フォーカス・ボタン状態変化         |
| `duration-slow`    | 300ms  | パネル開閉・モーダル表示                  |
| `duration-slower`  | 400ms  | 画面遷移・大きな要素の登場                |

### Easing（イージング）

| トークン          | 値                          | 用途                     |
|-------------------|-----------------------------|--------------------------|
| `ease-standard`   | `cubic-bezier(0.2, 0, 0, 1)` | 標準的な状態変化          |
| `ease-enter`      | `cubic-bezier(0, 0, 0.2, 1)` | 要素が現れるとき          |
| `ease-exit`       | `cubic-bezier(0.4, 0, 1, 1)` | 要素が消えるとき          |

### 用途別の組み合わせ

| 場面                     | duration              | easing          |
|--------------------------|-----------------------|-----------------|
| ホバー状態               | `duration-normal`（200ms） | `ease-standard` |
| フォーカスリング          | `duration-fast`（120ms）   | `ease-enter`    |
| モーダル・パネル 開く    | `duration-slow`（300ms）   | `ease-enter`    |
| モーダル・パネル 閉じる  | `duration-normal`（200ms） | `ease-exit`     |
| トグル・チェックボックス | `duration-fast`（120ms）   | `ease-standard` |

**原則：**

- 状態変化の伝達にのみアニメーションを使う。装飾目的のアニメーションは禁止
- 消えるアニメーションは現れるアニメーションより短くする（`ease-exit` は `ease-enter` より速い）
- `prefers-reduced-motion` が有効な場合はすべてのトランジションを無効化する

---

## Dark Mode

OSの設定に自動追従し、アプリ設定で手動固定も可能です。

**基本方針：**

- モノクローム原則はダークモードでも同一。すべてのサーフェストークンは彩度ゼロ（R=G=B）
- アクセントカラー（ブルー・オレンジ）はライトモードと同値。暗い背景でも十分な視認性を持つ
- 背景は純粋な黒（`#000000`）を避け、目への負担を軽減するため `#131313` を基準とする
- テキストも純粋な白（`#ffffff`）を避け、`#e6e6e6` を基準とする
- コンポーネント定義・使用ルールはライトモードと共通

### サーフェス階層（ダークモード）

暗い背景の上にコンテナが浮かび上がる構造。数値が大きいほど明るく、より手前に位置する。

| トークン | 値 | 用途 |
|---|---|---|
| `surface-dim` | `#0e0e0e` | 最も暗いサーフェス（オーバーレイ背景など） |
| `surface` | `#131313` | ページ背景 |
| `surface-container-lowest` | `#1a1a1a` | カード・パネル |
| `surface-container-low` | `#1f1f1f` | 入れ子のコンテナ |
| `surface-container` | `#252525` | 標準コンテナ |
| `surface-container-high` | `#2c2c2c` | 強調コンテナ |
| `surface-container-highest` | `#333333` | 最も手前のコンテナ |

---

## AIデザインの典型表現を避けること

AI生成UIに頻出する以下のパターンは、このシステムでは明示的に禁止します。

| 禁止パターン | 理由 | 代替表現 |
|------------|------|---------|
| カード枠をオレンジ・青で囲む | 有彩色を装飾に使うことになる | グレーのボーダー太さで強調 |
| ボタンやリスト項目の片側だけに有彩色ラインを入れる | 現在地表示ではなく、装飾的な強調に見える | 背景濃淡・境界線・文字ウェイトで状態を示す |
| 選択状態のカードを有彩色で塗る | 面積が大きく色が主役になる | 背景濃淡とボーダー太さで区別 |
| ステップ番号の丸をオレンジにする | 警告や不可逆操作と混同する | 黒・濃いグレーで塗る |
| 「推奨」バッジをオレンジにする | 重要度の表現に有彩色を使うことになる | グレー系バッジで表示 |
| グラデーションを使う | モノクロームの原則に反する | フラットな単色のみ |
| 複数のカードに異なる有彩色を割り当てる | パレットの一貫性が崩れる | すべてグレースケールで統一 |
| サーフェス・背景に色味を持ち込む | モノクロ領域を汚染する | 彩度ゼロのグレーのみ使用 |
| ナビゲーションの選択背景をベージュ・暖色にする | 無彩色に見えてオレンジが混入している | 純粋なグレー（`surface-container-high`等）を使う |
