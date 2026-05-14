import { describe, expect, it } from "vitest";

import type { WorkspaceTreeNode } from "../../shared/ipc";
import { buildDashboardStats, buildPropertyDistribution, buildTreemapRects } from "./DashboardPanel";

describe("buildDashboardStats", () => {
  it("summarizes markdown files for the dashboard", () => {
    const fileTree: WorkspaceTreeNode[] = [
      {
        children: [
          { name: "Scene.md", path: "Story/Scene.md", type: "file" }
        ],
        name: "Story",
        path: "Story",
        type: "folder"
      },
      { name: "Idea.md", path: "Idea.md", type: "file" }
    ];

    const stats = buildDashboardStats([
      {
        content: "---\ntags: [draft, scene]\n---\n# Opening\n[[Idea]]\nBody text",
        name: "Scene.md",
        path: "Story/Scene.md"
      },
      {
        content: "# Idea\nSmall note",
        name: "Idea.md",
        path: "Idea.md"
      }
    ], fileTree);

    expect(stats.totalFiles).toBe(2);
    expect(stats.folderCount).toBe(1);
    expect(stats.totalHeadings).toBe(2);
    expect(stats.totalLinks).toBe(1);
    expect(stats.frontmatterFiles).toBe(1);
    expect(stats.tagDistribution).toContainEqual({ count: 1, label: "draft" });
    expect(stats.folderDistribution).toContainEqual({ count: 1, label: "Story" });
    expect(stats.folderDistribution).toContainEqual({ count: 1, label: "Root" });
    expect(stats.files[0].path).toBe("Story/Scene.md");
  });

  it("counts select and multi-select property values", () => {
    const stats = buildDashboardStats([
      {
        content: "---\nstatus: draft\nroles: [hero, pilot]\n---\n# A",
        name: "A.md",
        path: "A.md"
      },
      {
        content: "---\nstatus: done\nroles: [hero]\n---\n# B",
        name: "B.md",
        path: "B.md"
      },
      {
        content: "# C",
        name: "C.md",
        path: "C.md"
      }
    ], []);

    expect(buildPropertyDistribution(
      stats.files,
      { choices: ["draft", "done"], name: "status", type: "select" },
      { other: "Other", unset: "Unset" }
    ).map(({ count, label }) => ({ count, label }))).toEqual([
      { count: 1, label: "done" },
      { count: 1, label: "draft" },
      { count: 1, label: "Unset" }
    ]);

    expect(buildPropertyDistribution(
      stats.files,
      { choices: ["hero", "pilot"], name: "roles", type: "multi-select" },
      { other: "Other", unset: "Unset" }
    ).map(({ count, label }) => ({ count, label }))).toEqual([
      { count: 2, label: "hero" },
      { count: 1, label: "pilot" },
      { count: 1, label: "Unset" }
    ]);
  });

  it("lays out tag treemaps for a wide dashboard card without thin horizontal bands", () => {
    const rects = buildTreemapRects([
      { count: 7, label: "chart" },
      { count: 4, label: "history" },
      { count: 3, label: "japan" },
      { count: 3, label: "merge" },
      { count: 3, label: "search" },
      { count: 1, label: "tools" },
      { count: 1, label: "alpha" },
      { count: 1, label: "frontmatter" },
      { count: 1, label: "markdown" },
      { count: 1, label: "schedule" },
      { count: 1, label: "memo" },
      { count: 1, label: "beta" }
    ]);

    expect(rects).toHaveLength(12);
    expect(rects[0]).toMatchObject({ label: "chart" });
    expect(Math.min(...rects.map((rect) => rect.height))).toBeGreaterThan(20);
    expect(rects.every((rect) => rect.width > 0 && rect.height > 0)).toBe(true);
  });

  it("uses one hue with stronger tone for larger tag counts", () => {
    const rects = buildTreemapRects([
      { count: 10, label: "large" },
      { count: 1, label: "small" }
    ]);

    expect(rects.map((rect) => rect.fill)).toEqual([
      "color-mix(in srgb, var(--accent) 78%, var(--bg))",
      "color-mix(in srgb, var(--accent) 24%, var(--bg))"
    ]);
    expect(rects.map((rect) => rect.textLight)).toEqual([true, false]);
  });
});
