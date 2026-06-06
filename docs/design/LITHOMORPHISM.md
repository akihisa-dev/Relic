# LITHOMORPHISM.md

LITHOMORPHISMは、石、鉱物、石粉、乾いた顔料を連想させる、低光沢で硬質な視覚思想である。

この思想はRelicに限らず、今後の制作物における色、素材、質感、表面処理の基本方針として扱う。

色そのものを装飾的に変えるのではなく、色に与える意味、面の扱い、光沢の避け方、境界の作り方によって、静かで長く使える視覚体験を作る。

---

## 基本方針

- 色は派手に発光させず、鉱物顔料や石材のように沈んだ色として扱う
- 面は光沢ではなく、乾いた低反射の素材として扱う
- 境界は曖昧に溶かさず、薄いセメント線や鉱物境界のように明確に扱う
- 質感は強いノイズや汚れ加工ではなく、控えめな表面処理として扱う
- 読みやすさ、構造、耐久性を装飾より優先する

---

## Relicパレットとの対応

| DESIGN.mdの色 | 値 | LITHOMORPHISM上の意味 |
|---|---:|---|
| `--color-primary` | `#3261A1` | Mineral Blue / 鉱物顔料の青 |
| `--color-accent` | `#6C8BB7` | Weathered Blue / 経年した青 |
| `--color-bg` | `#F2F1EE` | Limestone White / 石灰白 |
| `--color-surface` | `#E7E7E7` | Stone Dust Surface / 石粉面 |
| `--color-surface-alt` | `#DDDEDF` | Concrete Surface / コンクリート面 |
| `--color-border` | `#C3C8CE` | Pale Cement Line / 薄いセメント線 |
| `--color-border-strong` | `#A4AEBD` | Mineral Boundary / 鉱物系の強い境界 |
| `--color-text` | `#232B36` | Ink Stone / 石に沈んだ濃色インク |
| `--color-text-secondary` | `#89909A` | Dust Gray Text / 石粉グレー |
| `--color-text-muted` | `#89909A` | Dust Gray Text / 石粉グレー |

---

## 色・素材・質感

`#3261A1` は「Webの青」ではなく、鉱物顔料としての青として扱う。

`#6C8BB7` は、経年により少し沈んだ補助的な青として扱う。

`#F2F1EE` は、純白ではなく石灰石に近い白として扱う。

`#E7E7E7` は、石粉を含んだ乾いた面色として扱う。

`#DDDEDF` は、コンクリートに近い低彩度の面色として扱う。

`#C3C8CE` は、薄いセメント線のような境界色として扱う。

`#A4AEBD` は、鉱物質の強い境界色として扱う。

`#232B36` は、石や紙に沈んだ濃色インクとして扱う。

`#89909A` は、石粉を含んだグレーとして扱う。

---

## 質感ルール

質感は色そのものを変えず、表面処理として扱う。

推奨する質感:

- Matte
- Powdery
- Mineral
- Dry
- Fine-grained
- Slightly uneven
- Pigmented

避ける質感:

- Glossy
- Metallic
- Plastic
- Glassy
- Neon
- Wet
- Overly clean

---

## 避ける表現

- ネオン化
- グロー
- ガラス反射
- 金属光沢
- プラスチック的な均一さ
- 強いノイズ
- 汚れ加工
- ヴィンテージ加工

---

## 適用時の注意

LITHOMORPHISMは、見た目を古くするためのヴィンテージ加工ではない。

素材感は、情報の読みやすさと構造の理解を助ける範囲に留める。

表面にゆらぎを入れる場合も、文字、境界、操作対象の視認性を下げてはならない。
