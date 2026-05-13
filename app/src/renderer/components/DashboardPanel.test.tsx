import { describe, expect, it } from "vitest";

import type { WorkspaceTreeNode } from "../../shared/ipc";
import { buildDashboardStats } from "./DashboardPanel";

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
});
