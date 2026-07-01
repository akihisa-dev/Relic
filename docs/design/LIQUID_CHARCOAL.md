# LIQUID_CHARCOAL.md

Liquid Charcoalは、Canvas、Liquid、Charcoalの関係によって、Relicの作業画面を読み書きに集中できる状態へ整えるデザイン原則である。

Canvasは情報を置くための基盤である。

Liquidは透明・半透明の層であり、炭色が溶けた水のように濃度を持つ。

Charcoalは炭色を基準とする黒であり、画面に構造、焦点、メリハリを与える。

Liquid Charcoalは、特定の文化、様式、装飾表現を参照しない。

色や質感は主役ではなく、Markdown本文、ファイル構造、タブ、アウトライン、プロパティを見分けるための支えとして扱う。

---

## 基本方針

- Canvasを情報を書くための基盤として扱う
- Liquidを透明・半透明のレイヤーとして扱う
- Charcoalを本文、見出し、アクティブ状態、主要操作の基準として扱う
- 炭色は画面全体を塗る色ではなく、構造とメリハリを与える色として使う
- 大部分の面はCanvas、透明、半透明、または低濃度のLiquidで構成する
- Light ThemeとDark Themeを同等に扱う
- 有彩色のアクセントトークンは持たない
- エラー、警告、成功、情報などの機能色は、状態を伝える目的に限って使う
- 境界は細い線、明度差、透明度差によって明確に分ける
- 角丸を基本とする
- 影、グロー、強い質感、装飾的な背景を避ける
- 要素や機能ではなく、既存UIの読みやすさと静けさを整える

---

## Theme Principle

Liquid CharcoalはLight ThemeとDark Themeを同等に扱う。

Light Themeは白いCanvasを基準にし、Charcoalで構造を与える。

Dark Themeは暗いCanvasを基準にし、明るい前景と低濃度のLiquidで構造を与える。

Dark ThemeはLight Themeの反転ではない。

どちらのテーマでも、情報の可読性、現在位置、操作対象、選択状態を明確に示す。

---

## Relicパレットとの対応

Liquid Charcoalでは、トークン名は実務上の役割で定義する。

素材名は、色を選ぶための判断基準として扱う。

### Light Theme

| DESIGN.mdの色 | 値 | Liquid Charcoal上の意味 |
| --- | --- | --- |
| `--color-primary` | `#1C1C1A` | Primary Charcoal / 主要操作・アクティブ状態 |
| `--color-bg` | `#FFFFFF` | Canvas White / 作業面の基盤 |
| `--color-liquid` | `rgba(255, 255, 255, 0.72)` | Clear Liquid / 半透明レイヤー |
| `--color-liquid-charcoal` | `rgba(28, 28, 26, 0.06)` | Charcoal Liquid / 炭色が溶けた低濃度レイヤー |
| `--color-surface` | `#FAFAF8` | Quiet Surface / パネルの淡い面 |
| `--color-surface-alt` | `#F2F2EE` | Selected Surface / 選択やカードの薄い面 |
| `--color-border` | `#DADAD4` | Hairline Border / 通常の細い境界 |
| `--color-border-strong` | `#BDBDB4` | Strong Hairline / 少し強い境界 |
| `--color-text` | `#1C1C1A` | Primary Text / 本文と見出し |
| `--color-text-secondary` | `#5F5F59` | Secondary Text / 補助情報 |
| `--color-text-muted` | `#74746D` | Muted Text / 弱い補助情報 |

### Dark Theme

| DESIGN.mdの色 | 値 | Liquid Charcoal上の意味 |
| --- | --- | --- |
| `--color-primary` | `#F2F2EE` | Primary Foreground / 主要操作・アクティブ状態 |
| `--color-bg` | `#121210` | Dark Canvas / 作業面の基盤 |
| `--color-liquid` | `rgba(18, 18, 16, 0.72)` | Dark Liquid / 半透明レイヤー |
| `--color-liquid-charcoal` | `rgba(242, 242, 238, 0.08)` | Light Liquid / 暗い面に重なる低濃度レイヤー |
| `--color-surface` | `#1A1A17` | Quiet Surface / パネルの面 |
| `--color-surface-alt` | `#24241F` | Selected Surface / 選択やカードの面 |
| `--color-border` | `#363630` | Hairline Border / 通常の細い境界 |
| `--color-border-strong` | `#56564E` | Strong Hairline / 少し強い境界 |
| `--color-text` | `#F2F2EE` | Primary Text / 本文と見出し |
| `--color-text-secondary` | `#B9B9B0` | Secondary Text / 補助情報 |
| `--color-text-muted` | `#8A8A82` | Muted Text / 弱い補助情報 |

`--color-accent` はLiquid Charcoalの基礎トークンとして扱わない。

アクセントは有彩色ではなく、Charcoalの濃度、境界、余白、状態差によって作る。

---

## Functional Colors

有彩色は、状態を伝える必要がある場合に限って使う。

機能色はLiquid Charcoalの印象を作るための色ではなく、エラー、警告、成功、情報を誤認させないための補助である。

| 用途 | Light Theme | Dark Theme | 使い方 |
| --- | --- | --- | --- |
| Danger | `#B42318` | `#FFB4A9` | エラー、削除、破壊的操作 |
| Warning | `#8A5A00` | `#E7C16C` | 警告、注意、未解決状態 |
| Success | `#2E6B3F` | `#88D49D` | 成功、完了、正常状態 |
| Info | `#2F5E8C` | `#A8C7FA` | 補足情報、通知、案内 |

機能色は必要な要素に限定して使い、通常のナビゲーション、装飾、ブランド表現には使わない。

---

## Material Inspiration

Liquid Charcoalの素材参照は、Canvas、Liquid、Charcoalの三つに分けて扱う。

### Canvas

Canvasは情報を置くための基盤である。

Light Themeでは、画用紙のような白く落ち着いた面を基準にする。

ただし、紙の繊維、凹凸、汚れを視覚的に再現しない。

Canvasの質感は、情報の読みやすさを損なわない範囲でのみ扱う。

### Liquid

Liquidは透明・半透明の層である。

透明な水だけでなく、炭色が溶けた低濃度の水もLiquidとして扱う。

Liquidは面同士の距離、重なり、選択状態、補助的なまとまりを示すために使う。

Liquidはガラス表現ではない。

反射、ブラー、ハイライトは、素材の認識を助ける範囲に留める。

### Charcoal

Charcoalは炭色を基準にする。

完全な黒ではなく、炭色・墨色に近い深い黒を基準にする。

ここでいう墨色は色の参考語であり、書道、墨絵、和風表現を意味しない。

Charcoalは本文、見出し、アクティブ状態、主要操作、現在位置に使う。

Charcoalを面として多用すると画面が重くなるため、画面全体を支配する色として扱わない。

---

## 色・素材・質感

`#1C1C1A` は、Light ThemeにおけるPrimary Charcoalとして扱う。

`#FFFFFF` は、Light ThemeにおけるCanvasとして扱う。

`rgba(255, 255, 255, 0.72)` は、Light Themeにおける透明なLiquidレイヤーとして扱う。

`rgba(28, 28, 26, 0.06)` は、Light Themeにおける炭色が溶けた低濃度のLiquidとして扱う。

`#FAFAF8` は、白いCanvasより一段低いサイドバーやツールバーの面として扱う。

`#F2F2EE` は、選択状態やカードを示す淡い背景として扱う。

`#DADAD4` は、パネル、タブ、表を分ける細い境界として扱う。

`#BDBDB4` は、通常より少し強い境界や入力欄に使う。

`#5F5F59` は、本文より弱い補助情報と非アクティブ状態に使う。

`#74746D` は、弱い補助情報に使う。

Dark Themeでは、同じ役割をDark Theme用のトークンに置き換える。

---

## Color Principle

色は、画面上でただ目立たせるためではなく、情報の役割と状態を分けるために使う。

### Canvas

Canvasは作業面の基盤である。

Light Themeでは白を基準にする。

Dark Themeでは暗いCanvasを基準にする。

Canvasは装飾ではなく、情報が置かれる場所である。

### Liquid

Liquidは透明・半透明の層である。

Liquidは情報のまとまり、重なり、選択状態、操作対象を示すために使う。

透明度は実際の半透明として扱ってよい。

ただし、透明性によって文字や操作対象の判別が弱くなる場合は、可読性を優先する。

### Charcoal

Charcoalは本文、見出し、リンク、アクティブ線、主要ボタン、現在位置に使う。

Charcoalは少なく使うことで意味を持つ。

Charcoalを多用しすぎると情報密度が重くなるため、面の塗りつぶしには限定的に使う。

### Gray

灰色は、非アクティブなタブ、選択背景、補助情報、境界線に使う。

灰色の役割は情報の階層を支えることであり、装飾的な塗り分けではない。

---

## Surface and Layers

Liquid Charcoalでは、画面を単一の平面として扱わない。

Canvasの上にSurfaceとLiquidが重なり、必要な場所にCharcoalが現れる。

Surfaceは情報を整理するための面であり、装飾用のカードではない。

Liquidレイヤーは透明または半透明で構成する。

Surface同士の区別は、濃い塗り分けではなく、明度差、透明度差、境界線によって示す。

---

## Borders

境界は情報を整理するために存在する。

境界は細く、静かで、明確である。

通常の境界は1pxのHairline Borderを基準にする。

境界が情報より強く見えてはならない。

境界だけで判別しづらい場合は、Surfaceの明度差やLiquidの透明度差を併用する。

---

## Shape

Liquid Charcoalは角丸を基本とする。

角丸は装飾ではなく、画面全体の連続性と静けさを保つために使う。

過度に丸い形状や、強くキャラクター化された形状は避ける。

角丸の具体的な値は、コンポーネントとプラットフォームに応じて決める。

---

## Typography

タイポグラフィはプラットフォームの標準を基本とする。

Liquid Charcoalは文字そのものを装飾しない。

可読性は、文字色、余白、階層、Surface、境界によって支える。

本文、見出し、補助情報の差は、フォントの装飾ではなく、サイズ、ウェイト、濃度、配置で示す。

---

## Motion

Liquid Charcoalの動きは、操作を補助するために存在する。

動きは情報を強調するためではなく、状態の変化を自然に伝えるために使う。

Liquidは炭色を含む流体として、わずかな粘性を持つ。

そのため、動きは急激に跳ねたり、強く反発したりしない。

過度な弾性、大きな移動、長いアニメーションは避ける。

動きは滑らかで、静かで、短くあるべきである。

---

## 光

光は演出ではなく、素材を認識するために存在する。

Liquidは自然な透過と弱い反射を持つ。

Charcoalは光を強く跳ね返さず、沈んだ見え方を持つ。

ハイライト、反射、影は、要素の分離や状態の理解を助ける範囲に留める。

グロー、ネオン、強い反射、ガラス的な光沢は使わない。

---

## 質感ルール

質感は色そのものを変えず、軽い階調、透明度、明度差として扱う。

推奨する質感:

- Clean
- Matte
- Smooth
- Quiet
- Monochrome
- Transparent
- Lightly layered
- Slightly viscous

避ける質感:

- Glossy
- Metallic
- Plastic
- Glassy
- Neon
- Wet-looking
- Noisy
- Dirty
- Strongly textured

---

## 避ける表現

- ネオン化
- グロー
- ガラス反射
- 金属光沢
- 強いノイズ
- 汚れ加工
- 有彩色の強いアクセント
- 装飾のためのグラデーション
- 角丸や影による過度なカード化
- 和風化
- 書道、墨絵、筆致の表現
- 紙の繊維や凹凸の再現
- 液体を過剰に演出するアニメーション

---

## Atmosphere

Liquid Charcoalが目指す空気感:

- 静か
- 知的
- 機能的
- 観測的
- 構造的
- 清潔
- 透明感がある
- 炭色による重心がある
- 集中できる

この空気感は、派手な演出ではなく、情報の配置、余白、細い境界、透明・半透明の層、炭色のコントラストによって作る。

---

## Application Example

Liquid Charcoalは、Relicの現在の画面構造を変えずに適用するデザイン原則として扱う。

適用例:

- アプリUI
- ドキュメント
- カード
- 表
- 入力欄
- タブ
- サイドバー
- アウトライン
- プロパティ
- モーダル
- オーバーレイ

どの制作物でも、素材感は主役ではなく、情報と構造を支える背景として扱う。

---

## 適用時の注意

Liquid Charcoalは、画面をただ白く薄くするためのミニマリズムではない。

透明性は装飾ではなく、レイヤーと状態を伝えるために使う。

Charcoalはアクセントとして働くが、有彩色のアクセントカラーは持たない。

境界、選択状態、操作対象、現在位置は十分に分かる濃度で示す。

可読性と操作性が弱くなる場合は、透明感や質感よりも情報の判別を優先する。

要素や機能は現状のまま保ち、視覚表現だけを調整する。
