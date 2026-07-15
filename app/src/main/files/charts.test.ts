import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { extractChronicleRange, readWorkspaceCharts, updateWorkspaceChartEntry } from "./charts";
import { readWorkspaceFileIndex } from "./workspaceFileIndex";

describe("extractChronicleRange", () => {
  it("単年と期間を読む", () => {
    expect(extractChronicleRange("---\nchronicle: 1185\n---\n# A")).toEqual({
      endYear: 1185,
      startYear: 1185
    });
    expect(extractChronicleRange("---\nchronicle: { start: 1185, end: 1333 }\n---\n# A")).toEqual({
      endYear: 1333,
      startYear: 1185
    });
  });

  it("旧chronicleN、0年、逆順、短縮chronicleは読まない", () => {
    expect(extractChronicleRange("---\nchronicle0: [1185]\n---\n# A")).toBeNull();
    expect(extractChronicleRange("---\nchronicle:\n  - [old, [[0, null], [1, null]]]\n---\n# A")).toBeNull();
    expect(extractChronicleRange("---\nchronicle:\n  - [old, [[1333, null], [1185, null]]]\n---\n# A")).toBeNull();
    expect(extractChronicleRange("---\nchronicle: [1185]\n---\n# A")).toBeNull();
  });
});

describe("readWorkspaceCharts", () => {
  it("Markdownファイルから年表entryを読む", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-chronicle-chart-"));
    await writeFile(path.join(workspacePath, "main.MD"), "---\nchronicle: 10\n---\n# Main\n", "utf8");
    await writeFile(path.join(workspacePath, "sub.md"), "---\nchronicle: { start: 100, end: 103 }\n---\n# Sub\n", "utf8");

    const result = await readWorkspaceCharts(
      workspacePath,
      [{ filePaths: [], id: "chronicle", name: "chronicle", source: "chronicle" }]
    );

    expect(result).toMatchObject({
      ok: true,
      value: [
        {
          entries: [
            { fileName: "main", path: "main.MD" },
            { fileName: "sub", path: "sub.md", startPoint: { year: 100 } }
          ],
          id: "chronicle"
        }
      ]
    });
  });

  it("既に読み取ったWorkspaceFileIndexから年表entryを読む", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-chronicle-chart-index-"));
    await writeFile(path.join(workspacePath, "main.md"), "---\nchronicle: 10\n---\n# Main\n", "utf8");
    const fileIndex = await readWorkspaceFileIndex(workspacePath);

    await expect(readWorkspaceCharts(
      workspacePath,
      [{ filePaths: [], id: "chronicle", name: "chronicle", source: "chronicle" }],
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
            { fileName: "main", path: "main.md" }
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
    await writeFile(filePath, "---\nchronicle: 10\n---\n# Main\n", "utf8");

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
    expect(await readFile(filePath, "utf8")).toContain("chronicle:\n  end: 13\n  start: 12");
  });
});
