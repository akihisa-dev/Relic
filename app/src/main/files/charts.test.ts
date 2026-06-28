import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { extractChronicleRange, readWorkspaceCharts, updateWorkspaceChartEntry } from "./charts";
import { readWorkspaceFileIndex } from "./workspaceFileIndex";

describe("extractChronicleRange", () => {
  it("単年と期間を読む", () => {
    expect(extractChronicleRange("---\nchronicle:\n  - [メイン暦, [[1185, null], [1185, null]]]\n---\n# A")).toEqual({
      endYear: 1185,
      startYear: 1185
    });
    expect(extractChronicleRange("---\nchronicle:\n  - [メイン暦, [[1185, 5], [1333, 8]]]\n---\n# A")).toEqual({
      endYear: 1333,
      startYear: 1185
    });
  });

  it("旧chronicleN、0年、逆順、短縮chronicleは読まない", () => {
    expect(extractChronicleRange("---\nchronicle0: [1185]\n---\n# A")).toBeNull();
    expect(extractChronicleRange("---\nchronicle:\n  - [メイン暦, [[0, null], [1, null]]]\n---\n# A")).toBeNull();
    expect(extractChronicleRange("---\nchronicle:\n  - [メイン暦, [[1333, null], [1185, null]]]\n---\n# A")).toBeNull();
    expect(extractChronicleRange("---\nchronicle: [1185]\n---\n# A")).toBeNull();
  });
});

describe("readWorkspaceCharts", () => {
  it("Markdownファイルから年表entryを読む", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-chronicle-chart-"));
    await writeFile(path.join(workspacePath, "main.MD"), "---\nchronicle:\n  - [主暦, [[10, null], [10, null]]]\n---\n# Main\n", "utf8");
    await writeFile(path.join(workspacePath, "sub.md"), "---\nchronicle:\n  - [副暦, [[3, 5], [3, 8]]]\n---\n# Sub\n", "utf8");

    const result = await readWorkspaceCharts(
      workspacePath,
      [{ filePaths: [], id: "chronicle", name: "chronicle", source: "chronicle" }],
      [
        { name: "主暦" },
        { name: "副暦", startYear: 100 }
      ]
    );

    expect(result).toMatchObject({
      ok: true,
      value: [
        {
          entries: [
            { chronicleCalendarName: "主暦", fileName: "main", path: "main.MD" },
            { chronicleCalendarName: "副暦", fileName: "sub", path: "sub.md", startValue: 1216 }
          ],
          id: "chronicle"
        }
      ]
    });
  });

  it("既に読み取ったWorkspaceFileIndexから年表entryを読む", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-chronicle-chart-index-"));
    await writeFile(path.join(workspacePath, "main.md"), "---\nchronicle:\n  - [メイン暦, [[10, null], [10, null]]]\n---\n# Main\n", "utf8");
    const fileIndex = await readWorkspaceFileIndex(workspacePath);

    await expect(readWorkspaceCharts(
      workspacePath,
      [{ filePaths: [], id: "chronicle", name: "chronicle", source: "chronicle" }],
      [{ name: "メイン暦" }],
      {
        fileIndex,
        operations: {
          async readFile() {
            throw new Error("file should not be reread");
          }
        }
      }
    )).resolves.toMatchObject({
      ok: true,
      value: [
        {
          entries: [
            { chronicleCalendarName: "メイン暦", fileName: "main", path: "main.md" }
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
    await writeFile(filePath, "---\nchronicle:\n  - [メイン暦, [[10, null], [10, null]]]\n---\n# Main\n", "utf8");

    const result = await updateWorkspaceChartEntry(
      workspacePath,
      [{ filePaths: [], id: "chronicle", name: "chronicle", source: "chronicle" }],
      {
        chronicleEntryIndex: 0,
        endValue: 145,
        kind: "move",
        originalEndValue: 108,
        originalStartValue: 108,
        path: "main.md",
        source: "chronicle",
        startValue: 132
      }
    );

    expect(result.ok).toBe(true);
    expect(await readFile(filePath, "utf8")).toContain("[メイン暦, [[12, 1], [13, 2]]]");
  });
});
