# DESIGN.md - Anodized Instrument

> AIエージェントと実装者が、同じ質感・余白・色使いでUIを生成するためのデザイン仕様書。
> 方向性は `Teenage Engineering x MacBook Aluminum x visionOS Layer`。
> UIではなく道具。テキストエディタではなく、執筆機である。

---
name: Anodized Instrument

colors:
  primary: "#00628c"
  on-primary: "#ffffff"
  primary-container: "#007caf"
  on-primary-container: "#fcfcff"
  primary-fixed: "#c8e6ff"
  on-primary-fixed: "#001e2e"

  caution: "#c46a1a"
  on-caution: "#ffffff"
  caution-container: "#f2b36d"
  on-caution-container: "#3f1a00"

  danger: "#b02f00"
  on-danger: "#ffffff"
  danger-container: "#ff5722"
  on-danger-container: "#541200"

  secondary: "#5e5e5e"
  secondary-container: "#e0e0e0"
  on-secondary-container: "#626262"

  background: "#ffffff"
  on-background: "#1c1c1c"
  surface: "#ffffff"
  surface-dim: "#f4f4f4"
  surface-container-low: "#fafafa"
  surface-container: "#f4f4f4"
  surface-container-high: "#eeeeee"
  surface-container-highest: "#e8e8e8"
  surface-variant: "#eeeeee"

  aluminum-base: "#f4f4f4"
  aluminum-mid: "#e8e8e8"
  aluminum-edge: "#dcdcdc"
  aluminum-shadow: "#cfcfcf"
  aluminum-grain: "rgba(0,0,0,.035)"

  on-surface: "#1c1c1c"
  on-surface-variant: "#5e5e5e"
  outline: "#8a8a8a"
  outline-variant: "#e0e0e0"

dark-colors:
  primary: "#00628c"
  on-primary: "#ffffff"
  primary-container: "#007caf"

  caution: "#f2a14a"
  on-caution: "#1c1c1c"

  danger: "#ff5722"
  on-danger: "#ffffff"

  secondary: "#9e9e9e"
  secondary-container: "#2e2e2e"

  background: "#0e0e0e"
  on-background: "#e6e6e6"
  surface: "#131313"
  surface-dim: "#0e0e0e"
  surface-container-low: "#1f1f1f"
  surface-container: "#252525"
  surface-container-high: "#2c2c2c"
  surface-container-highest: "#333333"

  aluminum-base: "#202020"
  aluminum-mid: "#2a2a2a"
  aluminum-edge: "#3a3a3a"
  aluminum-shadow: "#111111"
  aluminum-grain: "rgba(255,255,255,.04)"

  on-surface: "#e6e6e6"
  on-surface-variant: "#9e9e9e"
  outline: "#6b6b6b"
  outline-variant: "#2e2e2e"

typography:
  display-lg:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Noto Sans JP', sans-serif"
    fontSize: "48px"
    fontWeight: "700"
    lineHeight: "56px"
    letterSpacing: "-0.02em"
  headline-lg:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Noto Sans JP', sans-serif"
    fontSize: "32px"
    fontWeight: "600"
    lineHeight: "40px"
    letterSpacing: "-0.01em"
  body-md:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Noto Sans JP', sans-serif"
    fontSize: "16px"
    fontWeight: "400"
    lineHeight: "28px"
    letterSpacing: "0"
  body-sm:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Noto Sans JP', sans-serif"
    fontSize: "14px"
    fontWeight: "400"
    lineHeight: "22px"
    letterSpacing: "0"
  label-md:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Noto Sans JP', sans-serif"
    fontSize: "12px"
    fontWeight: "600"
    lineHeight: "16px"
    letterSpacing: "0.06em"

radii:
  sm: "4px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  panel: "22px"

spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "48px"
  xxl: "80px"
---

## 1. Core Concept

このデザインシステムは、Teenage Engineering 的な工業製品の静けさ、MacBook の梨地アルマイト加工、visionOS 的な浮遊レイヤーを基準にする。

一般的なSaaS UIではない。装飾された画面ではなく、思考を支える精密な道具である。

テキストエディタではない。これは執筆機である。

目的は、情報を見せることではなく、思考を前に出すこと。ノイズを減らし、集中を支えること。

キーワード:

- Industrial Calm
- Industrial Minimalism
- Quiet Precision
- Liquid Aluminum
- Floating Metal
- Floating Metal Layers
- Silent Interface
- Writing Machine
- Matte Anodized Aluminum
- Matte Depth
- Layered Monochrome

画面は主張しない。UIは消えるべきである。ただし、消えながら高い工業的品質を持つ。

## 2. Visual Principles

### Monochrome First

画面の90%以上は、白・薄いグレー・無彩色のアルミニウムで構成する。

有彩色は信号であり、装飾ではない。Blue、Orange、Red は、意味のある状態表示のみに使う。

### Liquid Aluminum

中心コンセプトは `Liquid Aluminum`。

これは glassmorphism、透明UI、ネオングラデーション、flat UI、skeuomorphism のいずれでもない。

求めているのは、liquid metal、floating metal、soft machinery である。液体のように柔らかく浮遊しながら、アルマイト加工された金属の硬質さを持つ。

必要な質感:

- MacBook系の梨地アルマイト
- matte anodized aluminum
- エッジだけがわずかに光る
- 中央面は静かでマット
- 光は拡散し、鏡面反射しない
- 酸化皮膜のような静かな表情
- 微細な粒子とヘアラインを持つ
- レイヤー同士が浅く浮いている

禁止:

- ギラつき
- クローム感
- 鏡面反射
- 光沢プラスチック
- 強いガラス表現
- fake metal
- CG metal感

### Anodized Texture

アルマイト加工の微細な梨地粒子、酸化皮膜、わずかな不均一性を表現する。

ただし、テクスチャは「感じる」レベルに留める。写真素材のように見せたり、ノイズを主張させたりしてはならない。

必須:

- 微細grain
- anodized texture
- matte depth
- subtle noise
- soft edge highlight
- diffuse reflection

禁止:

- texture主張
- 写真的ノイズ
- 過剰roughness
- CG metal感

## 3. Color Usage

### Primary Blue

`primary (#00628c)` は、次の用途に限定する。

- 現在地
- リンク
- フォーカス
- アクティブ状態
- 情報表示

広い面積に使わない。青は光る信号であり、背景色や装飾色ではない。

### Caution Orange

`caution (#c46a1a)` は、工業機器の注意灯として扱う。

用途:

- 未保存
- 未確定
- 要確認
- 競合
- 外部変更
- リンク切れ
- インポート結果の警告
- 注意が必要な frontmatter

通常のCTA、選択中、アクティブタブ、リンク、装飾には使わない。

### Danger Red

`danger (#b02f00)` は、破壊的または失敗状態に限定する。

用途:

- 削除
- 不可逆操作
- 保存失敗
- 破壊的操作
- ファイル破損の可能性

通常操作や装飾に使わない。

### Neutral Grayscale

グレーは無彩色を基本にする。ただし、MacBook のアルマイト加工に見える範囲の、ごくわずかな温度差は許容する。

重要なのは、色で階層を作らないこと。階層は色相ではなく、明度、素材、粒子、エッジ、浮遊感で作る。

アルミニウム表現は、色相ではなく次の要素で作る。

- 明度差
- 粒子
- エッジハイライト
- レイヤー
- ごく浅いシャドウ

## 4. Typography

タイポグラフィは感情を演出しない。必要なのは、精密感・可読性・OS統合感・静けさである。

推奨フォント:

- SF Pro
- Inter
- IBM Plex Sans
- Geist
- Noto Sans JP

基本指定:

```css
font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
  "Noto Sans JP", sans-serif;
letter-spacing: 0;
```

日本語本文は `line-height: 1.7` から `1.8` を目安にする。見出しやラベルでは必要に応じて `letter-spacing` をわずかに広げてよい。

禁止:

- 過度に個性的なフォント
- 装飾的なセリフ体
- ビューポート幅に連動したフォントサイズ
- 読ませる本文への強い字間
- 感情的なタイポグラフィ

## 5. Layout

レイアウトは完全中央配置を避ける。

重要なのは、偏心・非対称・重心のわずかなズレ・静かな緊張感である。

原則:

- アプリ全体は一つのアルミ筐体として扱う
- sidebar は筐体に溶けた操作領域として扱う
- editor / main panel は筐体の上に乗る執筆レイヤーとして扱う
- 余白は広めに取る
- 情報を詰め込みすぎない
- ページ全体をカードの集合にしない
- セクションをカードで包みすぎない

### Sidebar

サイドバーはかなり重要である。

サイドバーはレイアウトの一部ではない。ただし、執筆機では独立プレートとして浮かせるより、背景と一体化した base chassis として扱う方を優先する。

サイドバーはアルミ筐体そのものであり、メイン執筆パネルがその上に層として乗る。

必須:

- app body と連続したtexture
- 弱い刻印感
- 控えめなhighlight
- 外周余白
- メインパネルとの層差

禁止:

- サイドバーをカード化する
- サイドバーに強いshadowを与える
- サイドバーをメインと同格の浮遊レイヤーにする

visionOS 的なレイヤー感は、メイン執筆パネルに集中させる。ただし、透明なガラスUIにしてはならない。透明感ではなく、金属筐体の上に浮く執筆面として扱う。

## 6. Shape

角丸は工業製品的でなければならない。

推奨値:

| 用途 | Radius |
|---|---:|
| 小さな制御部品 | 4px |
| ボタン・入力欄 | 8px |
| 小パネル | 12px |
| 大パネル | 16px |
| 浮遊プレート | 22px |

極端な pill shape は使わない。必要なのは、加工された金属の角である。

## 7. Elevation

奥行きは、重い影ではなく、レイヤー・明度差・微細なshadow・エッジハイライトで表現する。

推奨:

```css
--shadow-panel:
  inset 0 1px 0 rgba(255,255,255,.75),
  inset 0 -1px 0 rgba(0,0,0,.05),
  0 18px 48px rgba(0,0,0,.08);

--shadow-control:
  inset 0 1px 0 rgba(255,255,255,.55),
  inset 0 -1px 0 rgba(0,0,0,.04);
```

禁止:

- 黒く重いshadow
- 深すぎるdrop shadow
- 浮遊感ではなく紙のカードに見える影

## 8. Components

### Buttons

ボタンは小さく、静かで、工業的で、精密に見える必要がある。

原則:

- 高さは `32px` から `40px`
- radius は `8px` 前後
- border と inset highlight で形を出す
- hover は最小限の明度変化
- primary action でも青い大面積は避ける

禁止:

- 派手なgradient
- 大きなCTA風ボタン
- 強い色面
- 過剰なhover animation

### Navigation

navigation は道具感を持つ。

現在地は Primary Blue の小さな信号、細いライン、または最小限の背景差で示す。青いタブや大きな塗り面で示してはならない。

### Panels / Cards

カードは「紙のカード」ではなく、金属パネルとして扱う。

必要な要素:

- edge highlight
- matte surface
- subtle grain
- shallow elevation
- restrained border

### Inputs

入力欄は彫り込みではなく、薄い金属面の上に置かれた制御部品として扱う。

推奨:

- background: `surface-container-low`
- border: `1px solid outline-variant`
- focus: Primary Blue の細い ring
- height: `36px` から `44px`

### Interface Reduction

このUIは説明しない。

減らすもの:

- ツールバー
- アイコン
- ラベル
- 説明
- 装飾

増やすもの:

- 余白
- 精密感
- 静けさ
- 素材感

情報を多く見せるほど良い、という発想を採用しない。思考の邪魔になるものを消し、必要な操作だけを道具として残す。

## 9. Motion

motion は装飾ではない。深度理解、状態変化、レイヤー移動、フォーカス補助のために使う。

推奨:

- duration: `160ms` から `260ms`
- easing: `cubic-bezier(.2, .8, .2, 1)`
- 移動量は小さくする
- opacity と transform を中心にする
- inertia
- fluidity
- soft damping
- subtle depth

禁止:

- 速すぎるanimation
- 強いbounce
- 装飾的な連続animation
- attentionを奪うmotion
- 派手なspring
- flashy animation
- 過剰motion

## 10. Dark Mode

ダークモードでも思想は同じ。黒いUIではなく、暗所用の工業機材として設計する。

原則:

- 純黒を使わない
- matte aluminum を維持する
- matte dark aluminum として扱う
- 粒子感を残す
- Primary Blue は信号としてのみ使う
- コントラストを確保しつつ、発光感を強めすぎない

禁止:

- pure black
- neon
- glowing UI

## 11. Forbidden Patterns

以下は禁止。

- AIっぽいgradient
- 過剰なglassmorphism
- neon accent
- glossy plastic
- chrome metal
- pure flat UI
- 強い彩度
- 重すぎるblur
- card乱立
- 過剰shadow
- 装飾的animation
- one-note palette
- 巨大なhero風UI
- マーケティングサイト的な演出
- SaaS感
- 色で階層を作る
- flatすぎるUI

## 12. Implementation Snippet

```css
:root {
  --background: #ffffff;
  --surface: #ffffff;
  --surface-container-low: #fafafa;
  --surface-container: #f4f4f4;
  --surface-container-high: #eeeeee;
  --on-surface: #1c1c1c;
  --on-surface-variant: #5e5e5e;
  --outline: #8a8a8a;
  --outline-variant: #e0e0e0;
  --primary: #00628c;
  --caution: #c46a1a;
  --danger: #b02f00;

  --radius-control: 8px;
  --radius-panel: 22px;

  --shadow-panel:
    inset 0 1px 0 rgba(255,255,255,.75),
    inset 0 -1px 0 rgba(0,0,0,.05),
    0 18px 48px rgba(0,0,0,.08);

  --grain:
    repeating-linear-gradient(
      90deg,
      rgba(255,255,255,.035) 0 1px,
      rgba(0,0,0,.012) 1px 2px
    );
}
```

## 13. Agent Prompt Guide

このデザインシステムに従う場合、AIには次のように指示する。

```text
Anodized Instrument のデザインシステムに従ってUIを作成してください。

方向性は Teenage Engineering x MacBook Aluminum x visionOS Layer。
UIではなく道具、テキストエディタではなく執筆機として設計します。

画面の90%以上は白、薄いグレー、無彩色のアルミニウムで構成します。
Blue (#00628c) は現在地、選択、リンク、フォーカス、情報信号に限定します。
Orange (#c46a1a) は注意、未保存、未確定、要確認、競合、外部変更、リンク切れに限定します。
Red (#b02f00) は削除、不可逆操作、保存失敗、破壊的操作に限定します。

質感は matte anodized aluminum。
エッジだけをわずかに光らせ、中央面は静かに保ちます。
微細な粒子、酸化皮膜のような質感、浅いshadow、明度差、レイヤーで奥行きを作ります。
クローム、鏡面反射、派手なgradient、過剰glassmorphism、透明UI、fake metalは禁止です。

アプリ全体は一つのアルミ筐体として扱います。
sidebar は背景と一体化した base chassis として扱い、editor / main panel だけをその上に乗る執筆レイヤーとして扱います。
角丸は8px、12px、16px、22pxの範囲で工業製品的に使います。
ボタンは小さく静かにし、hoverやmotionは最小限にします。

フォントは Inter / system-ui / Noto Sans JP。
ツールバー、アイコン、ラベル、説明、装飾は減らします。
余白、精密感、静けさ、素材感を増やします。
UIは装飾ではなく、思考のための精密な道具として設計してください。
```

## 14. Final Principle

このUIは派手さで魅せない。

重要なのは、素材、静けさ、粒子感、精密感、集中、工業的品質である。

最終的な方向性は `Teenage Engineering x MacBook Aluminum x visionOS Layer`。

UIは消えるべきである。しかし、消えながら圧倒的な品質を持たなければならない。
