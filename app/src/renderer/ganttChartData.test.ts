import { describe, expect, it, vi } from "vitest";

import type { UpdateGanttChartEntryInput } from "../shared/ipc";
import {
  normalizeWorkspaceGanttCharts,
  normalizeWorkspaceGanttChartsWithFiles,
  updateChartFrontmatter,
  updateGanttChartEntryFallback
} from "./ganttChartData";

function chronicleEditInput(overrides: Partial<UpdateGanttChartEntryInput> = {}): UpdateGanttChartEntryInput {
  return {
    endValue: 2026,
    kind: "move",
    originalEndValue: 2025,
    originalStartValue: 2025,
    path: "tasks/implementation.md",
    source: "chronicle",
    startValue: 2026,
    ...overrides
  };
}

describe("ganttChartData", () => {
  it("旧形式 chronicle 配列を現行Chronicleへ正規化する", () => {
    const charts = normalizeWorkspaceGanttCharts([
      { endYear: 1333, fileName: "鎌倉時代", path: "history/kamakura.md", startYear: 1185 }
    ]);

    expect(charts).toEqual([
      {
        entries: [{
          endLabel: "1333",
          endValue: 1332,
          fileName: "鎌倉時代",
          path: "history/kamakura.md",
          startLabel: "1185",
          startValue: 1184
        }],
        filePaths: ["history/kamakura.md"],
        id: "chronicle",
        name: "Chronicle",
        source: "chronicle"
      }
    ]);
  });

  it("Markdown補完は行わず、mainから返ったChronicleを正規化する", async () => {
    const readMarkdownFile = vi.fn();
    const charts = await normalizeWorkspaceGanttChartsWithFiles(
      [{ entries: [], filePaths: [], id: "chronicle", name: "Chronicle", source: "chronicle" }],
      [],
      readMarkdownFile
    );

    expect(charts).toEqual([{ entries: [], filePaths: [], id: "chronicle", name: "Chronicle", source: "chronicle" }]);
    expect(readMarkdownFile).not.toHaveBeenCalled();
  });

  it("chronicleバー更新ではchronicleだけを更新する", () => {
    expect(updateChartFrontmatter(
      "---\nchronicle: [2026]\nstatus: [未着手]\n---\n# 実装タスク",
      chronicleEditInput()
    )).toBe(
      "---\nchronicle: [2027]\nstatus: [未着手]\n---\n# 実装タスク"
    );
  });

  it("frontmatter がないカードにもChronicle用プロパティを追加する", () => {
    expect(updateChartFrontmatter("# 実装タスク", chronicleEditInput())).toBe(
      "---\nchronicle: [2027]\n---\n# 実装タスク"
    );
  });

  it("Chronicle更新IPCがない場合のfallbackは読み書き後に最新Chronicleを返す", async () => {
    const charts = [{
      entries: [],
      filePaths: [],
      id: "chronicle",
      name: "Chronicle",
      source: "chronicle" as const
    }];
    const readMarkdownFile = vi.fn(async ({ path }: { path: string }) => ({
      ok: true as const,
      value: {
        content: "---\nchronicle: [2026]\n---\n# 実装タスク",
        name: "実装タスク",
        path
      }
    }));
    const writeMarkdownFile = vi.fn(async () => ({ ok: true as const, value: undefined }));
    const getWorkspaceChronicle = vi.fn(async () => ({ ok: true as const, value: charts }));

    await expect(updateGanttChartEntryFallback(chronicleEditInput(), {
      getWorkspaceChronicle,
      readMarkdownFile,
      writeMarkdownFile
    })).resolves.toEqual({ ok: true, value: charts });
    expect(writeMarkdownFile).toHaveBeenCalledWith({
      content: "---\nchronicle: [2027]\n---\n# 実装タスク",
      path: "tasks/implementation.md"
    });
  });
});
