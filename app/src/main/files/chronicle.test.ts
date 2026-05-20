import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { extractChronicleRange, readWorkspaceChronicle, updateWorkspaceGanttChartEntry } from "./chronicle";

describe("extractChronicleRange", () => {
  it("単年を1要素配列として読む", () => {
    expect(extractChronicleRange("---\nchronicle: [1185]\n---\n# A")).toEqual({
      endYear: 1185,
      startYear: 1185
    });
  });

  it("期間を2要素配列として読む", () => {
    expect(extractChronicleRange("---\nchronicle: [-300, 250]\n---\n# A")).toEqual({
      endYear: 250,
      startYear: -300
    });
  });

  it("0年や逆順の期間は読まない", () => {
    expect(extractChronicleRange("---\nchronicle: [0]\n---\n# A")).toBeNull();
    expect(extractChronicleRange("---\nchronicle: [1333, 1185]\n---\n# A")).toBeNull();
  });

  it("配列以外や3要素以上の配列は読まない", () => {
    expect(extractChronicleRange("---\nchronicle: 1185\n---\n# A")).toBeNull();
    expect(extractChronicleRange("---\nchronicle: [1185, 1333, 1600]\n---\n# A")).toBeNull();
  });
});

describe("readWorkspaceChronicle", () => {
  it("chronicleプロパティをChronicleとして読む", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-chronicle-chart-"));
    await writeFile(
      path.join(workspacePath, "entry.md"),
      "---\nchronicle: [1185, 1333]\n---\n# A\n",
      "utf8"
    );

    const result = await readWorkspaceChronicle(
      workspacePath,
      [
        { filePaths: [], id: "chronicle", name: "Chronicle", source: "chronicle" }
      ]
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value[0].entries).toMatchObject([
      {
        endLabel: "1333",
        fileName: "entry",
        path: "entry.md",
        startLabel: "1185"
      }
    ]);
  });
});

describe("updateWorkspaceGanttChartEntry", () => {
  it("chronicleバー移動時にchronicleだけを更新する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-chronicle-update-"));
    const filePath = path.join(workspacePath, "entry.md");
    await writeFile(filePath, "---\nchronicle: [1185, 1333]\n---\n# A\n", "utf8");

    const result = await updateWorkspaceGanttChartEntry(
      workspacePath,
      [
        { filePaths: [], id: "chronicle", name: "Chronicle", source: "chronicle" }
      ],
      {
        endValue: 1333,
        kind: "move",
        originalEndValue: 1332,
        originalStartValue: 1184,
        path: "entry.md",
        source: "chronicle",
        startValue: 1185
      }
    );

    expect(result.ok).toBe(true);

    const updated = await readFile(filePath, "utf8");
    expect(extractChronicleRange(updated)).toEqual({ endYear: 1334, startYear: 1186 });
    expect(updated).toContain("chronicle:\n  - 1186\n  - 1334");
  });
});
