import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { extractChronicleRange, readWorkspaceCharts, updateWorkspaceChartEntry } from "./charts";

describe("extractChronicleRange", () => {
  it("単年と期間を読む", () => {
    expect(extractChronicleRange("---\nchronicle0: [1185]\n---\n# A")).toEqual({
      endYear: 1185,
      startYear: 1185
    });
    expect(extractChronicleRange("---\nchronicle0: [1185, 1333]\n---\n# A")).toEqual({
      endYear: 1333,
      startYear: 1185
    });
  });

  it("0年、マイナス年、逆順、廃止したchronicleは読まない", () => {
    expect(extractChronicleRange("---\nchronicle0: [0]\n---\n# A")).toBeNull();
    expect(extractChronicleRange("---\nchronicle0: [-300]\n---\n# A")).toBeNull();
    expect(extractChronicleRange("---\nchronicle0: [1333, 1185]\n---\n# A")).toBeNull();
    expect(extractChronicleRange("---\nchronicle: [1185]\n---\n# A")).toBeNull();
  });
});

describe("readWorkspaceCharts", () => {
  it("Markdownファイルから年表entryを読む", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-chronicle-chart-"));
    await writeFile(path.join(workspacePath, "main.MD"), "---\nchronicle0: [10]\n---\n# Main\n", "utf8");
    await writeFile(path.join(workspacePath, "sub.md"), "---\nchronicle1: [3]\n---\n# Sub\n", "utf8");

    const result = await readWorkspaceCharts(
      workspacePath,
      [{ filePaths: [], id: "chronicle", name: "chronicle", source: "chronicle" }],
      [
        { id: "chronicle0", name: "主暦" },
        { id: "chronicle1", name: "副暦", startYear: 100 }
      ]
    );

    expect(result).toMatchObject({
      ok: true,
      value: [
        {
          entries: [
            { chronicleCalendarId: "chronicle0", fileName: "main", path: "main.MD" },
            { chronicleCalendarId: "chronicle1", fileName: "sub", path: "sub.md", startValue: 101 }
          ],
          id: "chronicle"
        }
      ]
    });
  });
});

describe("updateWorkspaceChartEntry", () => {
  it("年表entryの範囲をMarkdownフロントマターへ書き戻す", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-chronicle-chart-update-"));
    const filePath = path.join(workspacePath, "main.md");
    await writeFile(filePath, "---\nchronicle0: [10]\n---\n# Main\n", "utf8");

    const result = await updateWorkspaceChartEntry(
      workspacePath,
      [{ filePaths: [], id: "chronicle", name: "chronicle", source: "chronicle" }],
      {
        chronicleCalendarId: "chronicle0",
        endValue: 12,
        kind: "move",
        originalEndValue: 9,
        originalStartValue: 9,
        path: "main.md",
        source: "chronicle",
        startValue: 11
      }
    );

    expect(result.ok).toBe(true);
    expect(await readFile(filePath, "utf8")).toContain("chronicle0: [12, 13]");
  });
});
