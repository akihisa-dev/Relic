import { describe, expect, it } from "vitest";

import { parseRelicWhyTreeMarkdown } from "./diagramMarkdown";
import { whyTreeToMermaid } from "./whyTreeMermaid";

describe("whyTreeToMermaid", () => {
  it("Why TreeをMermaid flowchartへ変換する", () => {
    const parsed = parseRelicWhyTreeMarkdown([
      "---",
      "type: why-tree",
      "title: 原因分析",
      "---",
      "",
      "phenomenon:",
      "  title: 問題",
      "  facts:",
      "    - 観察事実",
      "  solutions:",
      "    - 対策案",
      "  actions:",
      "    - 実行項目",
      "  whys:",
      "    - title: 原因",
      "      facts: []",
      "      solutions: []",
      "      actions: []",
      ""
    ].join("\n"));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(whyTreeToMermaid(parsed.value)).toBe([
      "flowchart TD",
      "  phenomenon[\"問題\"]",
      "  phenomenon_fact_1[\"Memo: 観察事実\"]",
      "  phenomenon --> phenomenon_fact_1",
      "  phenomenon_solution_1[\"Related item: 対策案\"]",
      "  phenomenon --> phenomenon_solution_1",
      "  phenomenon_action_1[\"Action: 実行項目\"]",
      "  phenomenon --> phenomenon_action_1",
      "  why_1[\"原因\"]",
      "  phenomenon --> why_1",
      ""
    ].join("\n"));
  });

  it("入れ子のWhyと特殊文字を安全に扱う", () => {
    const parsed = parseRelicWhyTreeMarkdown([
      "---",
      "type: why-tree",
      "---",
      "",
      "phenomenon:",
      "  title: \"問題 <A>\"",
      "  facts: []",
      "  solutions: []",
      "  actions: []",
      "  whys:",
      "    - title: \"なぜ & \\\"1\\\"\"",
      "      facts:",
      "        - \"証拠 <script>\"",
      "      solutions: []",
      "      actions: []",
      "      whys:",
      "        - title: 深い原因",
      "          facts: []",
      "          solutions: []",
      "          actions: []",
      ""
    ].join("\n"));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const mermaid = whyTreeToMermaid(parsed.value);

    expect(mermaid).toContain("phenomenon[\"問題 &lt;A&gt;\"]");
    expect(mermaid).toContain("why_1[\"なぜ &amp; &quot;1&quot;\"]");
    expect(mermaid).toContain("why_1_fact_1[\"Memo: 証拠 &lt;script&gt;\"]");
    expect(mermaid).toContain("why_1_1[\"深い原因\"]");
    expect(mermaid).not.toContain("<script>");
  });
});
