# Design System

## Overview

このデザインシステムは、情報の構造化・可読性・集中体験を重視したナレッジワーク向けインターフェースである。

装飾的な要素を最小限に抑えながら、強いタイポグラフィ、明確な境界線、幾何学的な構成を用いて情報階層を視覚化する。

デザインの目的は「美しく見せること」ではなく、「情報構造を理解しやすくすること」にある。

---

# Design Principles

## Structure First

すべてのUI要素は視覚的な装飾よりも構造の表現を優先する。

情報の階層、関係性、状態を明確に伝えることを最重要視する。

---

## Strong Typography

タイポグラフィはUIの主要な表現手段である。

サイズ、ウェイト、余白によって情報の優先順位を示す。

色や装飾への依存を避ける。

---

## Geometric Consistency

直線、矩形、境界線を基本要素とする。

過度な曲線や有機的表現は避ける。

---

## Calm Technology

未来的でありながら過剰に派手ではない。

知的で落ち着いた作業環境を提供する。

---

# Visual Language

## Shapes

### Primary

- Rectangle
- Line
- Grid
- Section Block

### Secondary

- Triangle Accent
- Circular Technical Motif

装飾要素は情報の邪魔にならない範囲で使用する。

---

## Border System

境界線は重要な情報構造の一部として扱う。

```css
border-width: 1px;
border-color: var(--border-primary);
```

影による階層表現は最小限に抑える。

---

## Corner Radius

```css
radius-sm: 4px;
radius-md: 6px;
radius-lg: 8px;
```

大きなラウンド形状は使用しない。

---

# Color Palette

## Core Colors

### Warm Blue

主要アクセントカラー。

```css
--color-primary: #4E78B8;
```

用途:

- Active State
- Selection
- Links
- Primary Actions

---

### Deep Blue

強調表示や見出し。

```css
--color-primary-dark: #355C9A;
```

用途:

- Headers
- Navigation Indicators
- Important Labels

---

### Ice Blue

補助アクセント。

```css
--color-accent: #8FD6FF;
```

用途:

- Hover States
- Informational Highlights
- Charts

---

## Neutral Palette

### Background

```css
--color-bg: #F4F5F3;
```

アプリ全体の背景色。

---

### Surface

```css
--color-surface: #ECEFF2;
```

サイドバーやパネル。

---

### Elevated Surface

```css
--color-surface-elevated: #FFFFFF;
```

エディタ領域やモーダル。

---

### Border

```css
--color-border: #C9D1D9;
```

区切り線。

---

### Border Strong

```css
--color-border-strong: #9FA9B5;
```

重要な境界。

---

## Typography Colors

### Primary Text

```css
--color-text: #17202A;
```

---

### Secondary Text

```css
--color-text-secondary: #64707A;
```

---

### Muted Text

```css
--color-text-muted: #8B96A3;
```

---

# Typography

## Heading

推奨:

- Inter
- Geist
- IBM Plex Sans

スタイル:

```css
font-weight: 800;
letter-spacing: -0.03em;
```

---

## Section Labels

```css
font-size: 12px;
font-weight: 700;
letter-spacing: 0.08em;
text-transform: uppercase;
```

---

## Body

```css
font-size: 14px;
line-height: 1.7;
font-weight: 400;
```

---

# Layout

## Three Panel Structure

```text
Explorer
Editor
Outline
```

情報構造を常時可視化する。

---

## Grid Alignment

主要なUI要素はグリッドに沿って配置する。

任意の位置調整は避ける。

---

## Editor Width

最適な可読性を維持するため、以下を推奨する。

```css
max-width: 820px;
```

---

# Navigation

## Active Item

選択状態は背景色ではなく左側インジケーターで表現する。

```css
width: 4px;
background: var(--color-primary);
```

---

## Outline Navigation

アウトラインは番号付きセクションで表示する。

例:

```text
01 Overview
02 Goals
03 References
04 Notes
```

---

# Components

## Tabs

- 明確な境界線
- 過剰な影を使用しない
- アクティブ状態は青色ラインで表現

---

## Tables

- グリッドを強調
- 行間を広く確保
- 情報密度を保ちながら読みやすさを優先

---

## Buttons

Primary:

```css
background: var(--color-primary);
color: white;
```

Secondary:

```css
background: transparent;
border: 1px solid var(--color-border);
```

---

# Decorative Elements

装飾要素は機能的なレイアウトを補助する目的でのみ使用する。

許可される要素:

- 斜線
- 三角形アクセント
- 円形ガイドモチーフ
- グリッドライン

装飾が情報を上回ってはならない。

---

# Desired Impression

このデザインシステムが目指す印象:

- Structured
- Intelligent
- Calm
- Technical
- Focused
- Durable
- Architectural

避けるべき印象:

- Playful
- Organic
- Decorative
- Skeuomorphic
- Overly Minimal
- Consumer Social App
