import { describe, expect, it } from "vitest";

import { parseRelicRelationshipMarkdown } from "./diagramMarkdown";
import { relationshipToMermaid } from "./relationshipMermaid";

describe("relationshipToMermaid", () => {
  it("RelationshipをMermaid flowchartへ変換する", () => {
    const parsed = parseRelicRelationshipMarkdown([
      "---",
      "type: relationship",
      "title: 関係図",
      "---",
      "",
      "nodes:",
      "  - id: start-node",
      "    file: docs/start.md",
      "    x: 0",
      "    y: 0",
      "    width: 180",
      "    height: 80",
      "  - id: next/node",
      "    file: docs/next-screen.md",
      "    x: 240",
      "    y: 0",
      "    width: 180",
      "    height: 80",
      "lines:",
      "  - id: line-1",
      "    from: start-node",
      "    to: next/node",
      "    label: 開く",
      ""
    ].join("\n"));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(relationshipToMermaid(parsed.value)).toBe([
      "flowchart TD",
      "  start_node[\"start\"]",
      "  next_node[\"next-screen\"]",
      "  start_node -->|\"開く\"| next_node",
      ""
    ].join("\n"));
  });

  it("Mermaid IDと表示文字列を安全に扱う", () => {
    const parsed = parseRelicRelationshipMarkdown([
      "---",
      "type: relationship",
      "---",
      "",
      "nodes:",
      "  - id: ../../a",
      "    file: docs/a.md",
      "    x: 0",
      "    y: 0",
      "    width: 180",
      "    height: 80",
      "  - id: ../../a!",
      "    file: docs/b.md",
      "    x: 240",
      "    y: 0",
      "    width: 180",
      "    height: 80",
      "lines:",
      "  - id: line-1",
      "    from: ../../a",
      "    to: ../../a!",
      "    label: \"<危険&\\\"文字>\"",
      ""
    ].join("\n"));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const mermaid = relationshipToMermaid(parsed.value);

    expect(mermaid).toContain("a[\"a\"]");
    expect(mermaid).toContain("a_2[\"b\"]");
    expect(mermaid).toContain("\"&lt;危険&amp;&quot;文字&gt;\"");
    expect(mermaid).not.toContain("<危険");
  });
});
