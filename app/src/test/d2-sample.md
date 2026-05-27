# D2 Rendering Sample

This file is for checking D2 code block rendering in Relic.

```d2
direction: right

user: User {
  shape: person
}

relic: Relic {
  shape: rectangle
}

markdown: Markdown file {
  shape: document
}

d2: D2 renderer {
  shape: hexagon
}

svg: SVG preview {
  shape: rectangle
}

user -> relic: open note
relic -> markdown: read code block
markdown -> d2: compile
d2 -> svg: render
svg -> user: show diagram
```

```d2
title: Timeline Example

past: Past
present: Present
future: Future

past -> present -> future
```
