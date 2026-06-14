import { describe, expect, it } from "vitest";

import { parseRelicDiagramMarkdown } from "./diagramMarkdown";
import {
  relicDiagramTemplateById,
  relicDiagramTemplates,
  relicDiagramTemplatesForType
} from "./diagramTemplates";

describe("relicDiagramTemplates", () => {
  it("すべてのテンプレートが既存Diagram Markdownとして読み込める", () => {
    const ids = new Set<string>();

    relicDiagramTemplates.forEach((template) => {
      expect(ids.has(template.id)).toBe(false);
      ids.add(template.id);

      const parsed = parseRelicDiagramMarkdown(template.content);
      expect(parsed.ok).toBe(true);
      expect(parsed.ok ? parsed.value.type : null).toBe(template.type);
    });
  });

  it("Relationshipは保存形式を増やさない空テンプレートだけを持つ", () => {
    const templates = relicDiagramTemplatesForType("relationship");

    expect(templates.map((template) => template.id)).toEqual(["relationship-empty"]);
    const parsed = parseRelicDiagramMarkdown(templates[0]?.content ?? "");
    expect(parsed).toMatchObject({
      ok: true,
      value: {
        lines: [],
        nodes: [],
        type: "relationship"
      }
    });
  });

  it("Why Treeは既存の原因分析構造だけでテンプレートを表現する", () => {
    const templates = relicDiagramTemplatesForType("why-tree");

    expect(templates.map((template) => template.id)).toEqual([
      "why-tree-empty",
      "why-tree-basic-cause",
      "why-tree-incident-review"
    ]);
    expect(relicDiagramTemplateById("why-tree-basic-cause")?.defaultNameKey).toBe("diagram.template.basicCauseName");

    const parsed = parseRelicDiagramMarkdown(templates[1]?.content ?? "");
    expect(parsed).toMatchObject({
      ok: true,
      value: {
        phenomenon: {
          facts: ["確認できている事実"],
          title: "起きている問題",
          whys: [
            {
              title: "直接の原因",
              whys: [
                {
                  title: "さらに深い原因"
                }
              ]
            }
          ]
        },
        type: "why-tree"
      }
    });
  });
});
