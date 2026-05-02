---
name: Monochrome Alert
colors:
  # ディープオレンジ（アクション系）
  primary: '#b02f00'
  on-primary: '#ffffff'
  primary-container: '#ff5722'
  on-primary-container: '#541200'
  inverse-primary: '#ffb5a0'
  primary-fixed: '#ffdbd1'
  primary-fixed-dim: '#ffb5a0'
  on-primary-fixed: '#3b0900'
  on-primary-fixed-variant: '#862200'

  # アクセントブルー（情報系）
  tertiary: '#00628c'
  on-tertiary: '#ffffff'
  tertiary-container: '#007caf'
  on-tertiary-container: '#fcfcff'
  tertiary-fixed: '#c8e6ff'
  tertiary-fixed-dim: '#86cfff'
  on-tertiary-fixed: '#001e2e'
  on-tertiary-fixed-variant: '#004c6d'

  # セカンダリ（グレースケール）
  secondary: '#5f5e5e'
  on-secondary: '#ffffff'
  secondary-container: '#e2dfde'
  on-secondary-container: '#636262'
  secondary-fixed: '#e5e2e1'
  secondary-fixed-dim: '#c8c6c5'
  on-secondary-fixed: '#1b1c1c'
  on-secondary-fixed-variant: '#474746'

  # サーフェス
  surface: '#fbf9f9'
  surface-dim: '#dbdad9'
  surface-bright: '#fbf9f9'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f5f3f3'
  surface-container: '#efeded'
  surface-container-high: '#e9e8e7'
  surface-container-highest: '#e3e2e2'
  surface-tint: '#b02f00'
  surface-variant: '#e3e2e2'
  on-surface: '#1b1c1c'
  on-surface-variant: '#5b4039'
  inverse-surface: '#303031'
  inverse-on-surface: '#f2f0f0'

  # アウトライン
  outline: '#907067'
  outline-variant: '#e4beb4'

  # 背景
  background: '#fbf9f9'
  on-background: '#1b1c1c'

  # エラー
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'

typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  metric-xl:
    fontFamily: Inter
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.03em

rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px

spacing:
  xs: 4px
  sm: 12px
  base: 8px
  md: 24px
  gutter: 24px
  margin: 32px
  lg: 48px
  xl: 80px
---

## Overview

グレースケールを主体とするミニマルなデザインシステムです。画面の大部分は白・グレー・黒で構成され、有彩色は2色のみ、いずれも**ほんのアクセント**として機能します。

> 画面の90%はモノクロームである。有彩色はそこに意味を与えるために存在する。

オレンジと青は多用しません。どちらの色も、画面上にわずかに登場するからこそ目に入ります。使いすぎた瞬間にモノクロームとしての緊張感が失われます。

**2アクセントの役割：**

> オレンジは「アクション」——ユーザーが操作できる最重要の箇所にだけ使う。  
> 青は「情報」——システムがユーザーに伝える内容にだけ使う。

**デザイン原則：**

1. **モノクロームが主役である。** 有彩色は脇役。背景・カード・セクション区切り・番号・アイコンなど、情報の器にあたる部分はすべてグレースケールで構成する。
2. **オレンジは操作の瞬間にだけ現れる。** プライマリボタン・フォーカス・アクティブナビゲーションラインに限定する。選択状態のカードを塗りつぶすために使ってはならない。
3. **青はテキストと小さなバッジにとどめる。** リンク・情報ラベルなど、面積の小さい要素にだけ使う。
4. **有彩色で面を塗らない。** オレンジ・青ともに、カード背景・セクション背景・大きな囲みへの使用を禁止する。ボーダーやインジケーターラインなど線的な要素にとどめる。

---

## Colors

パレットは**モノクローム基盤**と**2つの機能的アクセント**で構成されます。

### アクションカラー：ディープオレンジ

`primary-container`（`#FF5722`）はこのシステムで最も目立つ色です。使う場所を厳しく絞ることで、登場したときの視覚的インパクトを保ちます。

| 使ってよい場所 | トークン |
|------|---------|
| プライマリボタンの背景 | `primary-container` |
| フォーカスリング・入力フィールドのアクティブボーダー | `primary` |
| ナビゲーションのアクティブインジケーターライン（3px） | `primary-container` |
| クリティカルな数値・ピーク値のテキスト | `primary-container` |

| 使ってはいけない場所 |
|------|
| カード・パネル・セクションの背景塗り |
| 選択状態のカード全体の囲み・背景 |
| セクション番号・アイコンなど情報の器 |
| 装飾目的のボーダーや区切り線 |
| 情報表示・ステータス・バッジ |

### 情報カラー：アクセントブルー

`tertiary`（`#00628c`）はオレンジの補完色です。テキストや小さなバッジなど**面積の小さい要素**にのみ使います。

| 使ってよい場所 | トークン |
|------|---------|
| テキストリンク | `tertiary` |
| 情報バッジ・ステータスラベルのテキスト | `tertiary` |
| 小型の情報バッジ背景 | `tertiary-fixed` |
| 外部リンクアイコン | `tertiary` |

| 使ってはいけない場所 |
|------|
| カード・パネル・セクションの背景塗り |
| ボタンやフォーカスなどアクション要素 |
| オレンジの代替・補助 |

### グレースケール基盤

画面の大部分を占める要素——背景・カード・セクション区切り・番号・アイコン・ボーダー——はすべてグレースケールで構成します。有彩色が少量であるほど、登場したときの意味が強くなります。

---

## Typography

すべてのスタイルで **Inter** を使用します。階層はウェイトの変化によって確立し、色による区別は最小限に抑えます。

| スタイル      | サイズ | ウェイト | 行間  | レタースペーシング | 用途                 |
|---------------|--------|----------|-------|--------------------|----------------------|
| `display-lg`  | 48px   | 700      | 56px  | −0.02em            | 最大見出し           |
| `headline-lg` | 32px   | 600      | 40px  | −0.01em            | セクション見出し     |
| `headline-md` | 24px   | 600      | 32px  | —                  | サブセクション見出し |
| `body-lg`     | 18px   | 400      | 28px  | —                  | 主要本文             |
| `body-md`     | 16px   | 400      | 24px  | —                  | 標準本文             |
| `body-sm`     | 14px   | 400      | 20px  | —                  | 補足・キャプション   |
| `label-md`    | 12px   | 600      | 16px  | +0.05em            | ラベル・メタデータ   |
| `metric-xl`   | 40px   | 700      | 48px  | −0.03em            | 数値・状態指標       |

**運用ルール：**

- **ディスプレイ & ヘッドライン** はセミボールド以上 + タイトなレタースペーシングで権威あるプレゼンスを演出します。
- **`metric-xl`** は数値・状態の強調に使用します。クリティカルな状態のみ `primary-container`（オレンジ）を適用します。
- **`label-md`** は大文字 + レタースペーシング拡大でメタデータを本文から色なしで分離します。
- テキストリンクには `body-md` または `body-sm` に `tertiary`（青）を適用します。アンダーラインはホバー時のみ表示します。

---

## Layout & Spacing

**8px リズム**に基づいたフルードグリッドシステムです。

| トークン  | 値    | 用途                           |
|-----------|-------|--------------------------------|
| `xs`      | 4px   | コンポーネント内の極小余白     |
| `base`    | 8px   | グリッドの基準単位             |
| `sm`      | 12px  | コンポーネント内パディング     |
| `md`      | 24px  | 要素間の標準余白               |
| `gutter`  | 24px  | グリッドのガター幅             |
| `margin`  | 32px  | レイアウトマージン             |
| `lg`      | 48px  | セクション間の余白             |
| `xl`      | 80px  | 大ブロック間の余白             |

デスクトップは12カラム、モバイルは4カラムを基本とします。マージンとガターは余裕を持たせ、アクセントカラーの要素が十分な空間を持つことで即座に識別できるようにします。

- 独立したコンテンツブロックの区切りには `lg` / `xl` を使用します。
- コンポーネント内部のパディングには `xs` / `sm` を使用します。

---

## Elevation

奥行きは**色の濃淡による階層**と微細な拡散シャドウで表現します。エレベーションは状態変化の手段として使いません。

| レイヤー | 背景色 | ボーダー | 用途 |
|---------|--------|---------|------|
| ベース | `surface`（`#fbf9f9`） | なし | ページ背景 |
| コンテナ | `surface-container-lowest`（`#ffffff`） | 1px `outline-variant` | カード・パネル |
| 浮上要素 | `surface-container-lowest`（`#ffffff`） | なし + 拡散シャドウ | モーダル・ドロップダウン |

**シャドウ：** 不透明度 5〜8%、色味なし、超拡散。重厚さより「軽い浮き上がり」を表現します。

**アクティブ状態：** エレベーション上昇ではなく、`primary-container`（オレンジ）の 2px ボーダーまたは左側インジケータータブで状態変化を示します。

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
| プライマリ | `primary-container`（`#FF5722`） | `on-primary`（白） | なし | `DEFAULT` | 若干暗化 |
| セカンダリ | `secondary-container` | `on-secondary-container` | なし | `DEFAULT` | 若干暗化 |
| アウトライン | 透明 | `on-surface` | 1px `outline` | `DEFAULT` | `surface-container` 背景 |

### ナビゲーション

アクティブ項目はテキストを太字 `on-surface`（`#1b1c1c`）にし、3px の `primary-container`（オレンジ）インジケーターラインを添えます。サイドナビは縦ライン、トップナビは横ラインです。

### 入力フィールド

ボーダー `outline-variant`・8px 角丸。フォーカス時にボーダーが `primary-container`（オレンジ）へトランジションします。エラー時は `error` へトランジションします。

### チップ

| 種類 | 背景 | テキスト | ボーダー |
|------|------|---------|---------|
| デフォルト | `surface-container` | `on-surface-variant` | なし |
| アクティブ（操作系） | `surface-container-highest` | `on-surface` | 1px `outline` |
| 情報系バッジ | `tertiary-fixed`（薄青） | `on-tertiary-fixed` | なし |
| 情報系アウトライン | 透明 | `tertiary` | 1px `tertiary` |

### 選択ハイライト

`outline`（グレー）の 1px ボーダー + `surface-container-high` の背景。選択状態に有彩色は使わない。識別はボーダーの太さ（2px）と背景の濃淡で行う。`sm`（0.25rem）角丸。

### カード

背景 `surface-container-lowest`（`#ffffff`）・1px `outline-variant` ボーダー・`DEFAULT`（8px）角丸。

カードのボーダーと背景は常にグレースケールで表現します。強調・推奨・グルーピングの差異は、ボーダーの太さ（1px → 2px）と背景の濃淡（`surface-container-lowest` → `surface-container-low`）の組み合わせで表現します。

**カードに有彩色を使う場面は存在しない。** オレンジや青のボーダー・背景はいかなる理由があっても禁止します。

### ステップ番号・連番インジケーター

手順の番号やステップを示す丸・バッジは `on-surface`（黒）または `surface-container-highest`（濃いグレー）で塗ります。オレンジの丸はボタンやアクション要素と混同を招くため禁止します。

### ラベル・バッジ（推奨・ステータス・カウント）

「推奨」「おすすめ」「新着」などのラベルはグレー系（`surface-container-highest` 背景・`on-surface-variant` テキスト）で表示します。重要度の強調にオレンジを使ってはなりません。重要なのはアクションを起こす場所だけです。

情報系のステータス（件数・進捗・分類）は `tertiary-fixed` 背景・`on-tertiary-fixed` テキストの小型バッジで表示します。

エラー・警告系は `error-container` 背景・`on-error-container` テキストを使います。

### メトリクス表示

`metric-xl` スタイルを基本は `on-surface` で表示します。クリティカルな状態・ピーク値のみ `primary-container`（オレンジ）を適用します。情報的なステータス値には `tertiary` を適用します。

---

## AIデザインの典型表現を避けること

AI生成UIに頻出する以下のパターンは、このシステムでは明示的に禁止します。

| 禁止パターン | 理由 | 代替表現 |
|------------|------|---------|
| カード枠をオレンジ・青で囲む | 有彩色を装飾に使うことになる | グレーのボーダー太さで強調 |
| 選択状態のカードを有彩色で塗る | 面積が大きく色が主役になる | 背景濃淡とボーダー太さで区別 |
| ステップ番号の丸をオレンジにする | アクション要素と混同する | 黒・濃いグレーで塗る |
| 「推奨」バッジをオレンジにする | 重要度の表現に有彩色を使うことになる | グレー系バッジで表示 |
| グラデーションを使う | モノクロームの原則に反する | フラットな単色のみ |
| 複数のカードに異なる有彩色を割り当てる | パレットの一貫性が崩れる | すべてグレースケールで統一 |
