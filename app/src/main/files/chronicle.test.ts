import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { extractChronicleRange, extractDateRange, updateWorkspaceGanttChartEntry } from "./chronicle";

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

describe("extractDateRange", () => {
  it("単日を1要素配列として読む", () => {
    expect(extractDateRange("---\ndate: [2026-05-12]\n---\n# A")).toEqual({
      endDate: "2026-05-12",
      startDate: "2026-05-12"
    });
  });

  it("期間を2要素配列として読む", () => {
    expect(extractDateRange("---\ndate: [2026-05-12, 2026-05-20]\n---\n# A")).toEqual({
      endDate: "2026-05-20",
      startDate: "2026-05-12"
    });
  });

  it("不正な日付や逆順の期間は読まない", () => {
    expect(extractDateRange("---\ndate: ['2026-02-31']\n---\n# A")).toBeNull();
    expect(extractDateRange("---\ndate: [2026-05-20, 2026-05-12]\n---\n# A")).toBeNull();
  });
});

describe("updateWorkspaceGanttChartEntry", () => {
  it("chronicleバー移動時にchronicleとdateを連動して更新する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-chronicle-update-"));
    const filePath = path.join(workspacePath, "entry.md");
    await writeFile(filePath, "---\nchronicle: [1185, 1333]\ndate: [2026-05-01, 2026-05-05]\n---\n# A\n", "utf8");

    const result = await updateWorkspaceGanttChartEntry(
      workspacePath,
      [
        { filePaths: [], id: "chronicle", name: "chronicle", source: "chronicle" },
        { filePaths: [], id: "date", name: "date", source: "date" }
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
    expect(extractDateRange(updated)).toEqual({ endDate: "2027-05-05", startDate: "2027-05-01" });
  });

  it("dateバーの長さ変更時にdateとchronicleを連動して更新する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-date-update-"));
    const filePath = path.join(workspacePath, "entry.md");
    await writeFile(filePath, "---\nchronicle: [2026]\ndate: [2026-12-30]\n---\n# A\n", "utf8");

    const result = await updateWorkspaceGanttChartEntry(
      workspacePath,
      [
        { filePaths: [], id: "chronicle", name: "chronicle", source: "chronicle" },
        { filePaths: [], id: "date", name: "date", source: "date" }
      ],
      {
        endValue: 20820,
        kind: "resize-end",
        originalEndValue: 20817,
        originalStartValue: 20817,
        path: "entry.md",
        source: "date",
        startValue: 20817
      }
    );

    expect(result.ok).toBe(true);

    const updated = await readFile(filePath, "utf8");
    expect(extractDateRange(updated)).toEqual({ endDate: "2027-01-02", startDate: "2026-12-30" });
    expect(extractChronicleRange(updated)).toEqual({ endYear: 2027, startYear: 2026 });
  });
});
