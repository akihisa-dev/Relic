import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { extractChronicleRange, extractDateRange, readWorkspaceChronicle, updateWorkspaceGanttChartEntry } from "./chronicle";

describe("extractChronicleRange", () => {
  it("単年を1要素配列として読む", () => {
    expect(extractChronicleRange("---\nchronicle0: [1185]\n---\n# A")).toEqual({
      endYear: 1185,
      startYear: 1185
    });
  });

  it("期間を2要素配列として読む", () => {
    expect(extractChronicleRange("---\nchronicle0: [-300, 250]\n---\n# A")).toEqual({
      endYear: 250,
      startYear: -300
    });
  });

  it("0年や逆順の期間は読まない", () => {
    expect(extractChronicleRange("---\nchronicle0: [0]\n---\n# A")).toBeNull();
    expect(extractChronicleRange("---\nchronicle0: [1333, 1185]\n---\n# A")).toBeNull();
  });

  it("配列以外や3要素以上の配列は読まない", () => {
    expect(extractChronicleRange("---\nchronicle0: 1185\n---\n# A")).toBeNull();
    expect(extractChronicleRange("---\nchronicle0: [1185, 1333, 1600]\n---\n# A")).toBeNull();
  });

  it("廃止したchronicleは読まない", () => {
    expect(extractChronicleRange("---\nchronicle: [1185]\n---\n# A")).toBeNull();
  });
});

describe("extractDateRange", () => {
  it("単日を1要素配列として読む", () => {
    expect(extractDateRange("---\nplannedDate: [2026-05-12]\n---\n# A")).toEqual({
      endDate: "2026-05-12",
      startDate: "2026-05-12"
    });
  });

  it("期間を2要素配列として読む", () => {
    expect(extractDateRange("---\nplannedDate: [2026-05-12, 2026-05-20]\n---\n# A")).toEqual({
      endDate: "2026-05-20",
      startDate: "2026-05-12"
    });
  });

  it("dateだけでは計画日として読まない", () => {
    expect(extractDateRange("---\ndate: [2026-05-12]\n---\n# A")).toBeNull();
  });

  it("日付文字列形式が混ざっていても読む", () => {
    expect(extractDateRange("---\nplannedDate: [\"Tue May 12 2026 09:00:00 GMT+0900 (日本標準時)\"]\n---\n# A")).toEqual({
      endDate: "2026-05-12",
      startDate: "2026-05-12"
    });
  });

  it("不正な日付や逆順の期間は読まない", () => {
    expect(extractDateRange("---\nplannedDate: ['2026-02-31']\n---\n# A")).toBeNull();
    expect(extractDateRange("---\nplannedDate: [2026-05-20, 2026-05-12]\n---\n# A")).toBeNull();
  });
});

describe("readWorkspaceChronicle", () => {
  it("chronicle0と設定済みサブ暦を同じ年表へ換算して読む", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-chronicle-calendar-chart-"));
    await writeFile(
      path.join(workspacePath, "main.md"),
      "---\nchronicle0: [10]\n---\n# Main\n",
      "utf8"
    );
    await writeFile(
      path.join(workspacePath, "sub.md"),
      "---\nchronicle1: [3]\n---\n# Sub\n",
      "utf8"
    );
    await writeFile(
      path.join(workspacePath, "legacy.md"),
      "---\nchronicle: [10]\n---\n# Legacy\n",
      "utf8"
    );

    const result = await readWorkspaceChronicle(
      workspacePath,
      [
        { filePaths: [], id: "chronicle", name: "chronicle", source: "chronicle" },
        { filePaths: [], id: "date", name: "date", source: "date" }
      ],
      [
        { id: "chronicle0", name: "王国暦" },
        { id: "chronicle1", name: "帝国暦", startYear: 100 }
      ]
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.find((chart) => chart.source === "chronicle")?.entries).toMatchObject([
      {
        chronicleCalendarId: "chronicle0",
        endLabel: "王国暦 10",
        endValue: 9,
        fileName: "main",
        path: "main.md",
        startLabel: "王国暦 10",
        startValue: 9
      },
      {
        chronicleCalendarId: "chronicle1",
        endLabel: "帝国暦 3",
        endValue: 101,
        fileName: "sub",
        path: "sub.md",
        startLabel: "帝国暦 3",
        startValue: 101
      }
    ]);
  });

  it("dateチャートにplannedDateとactualDateを1ファイル2行として読む", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-date-chart-"));
    await writeFile(
      path.join(workspacePath, "entry.md"),
      "---\nplannedDate: [2026-05-01, 2026-05-05]\nactualDate: [2026-05-03, 2026-05-06]\n---\n# A\n",
      "utf8"
    );

    const result = await readWorkspaceChronicle(
      workspacePath,
      [
        { filePaths: [], id: "chronicle", name: "chronicle", source: "chronicle" },
        { filePaths: [], id: "date", name: "date", source: "date" }
      ]
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.find((chart) => chart.source === "date")?.entries).toMatchObject([
      {
        dateKind: "planned",
        endLabel: "2026-05-05",
        fileName: "entry",
        path: "entry.md",
        startLabel: "2026-05-01"
      },
      {
        dateKind: "actual",
        endLabel: "2026-05-06",
        fileName: "entry",
        path: "entry.md",
        startLabel: "2026-05-03"
      }
    ]);
  });

  it("dateチャートに片方だけあるplannedDateまたはactualDateを読む", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-date-chart-single-kind-"));
    await writeFile(
      path.join(workspacePath, "planned-only.md"),
      "---\nstatus: [todo]\nplannedDate: [2026-05-01]\n---\n# A\n",
      "utf8"
    );
    await writeFile(
      path.join(workspacePath, "actual-only.md"),
      "---\nstatus: [done]\nactualDate: [2026-05-03]\n---\n# B\n",
      "utf8"
    );

    const result = await readWorkspaceChronicle(
      workspacePath,
      [
        { filePaths: [], id: "chronicle", name: "chronicle", source: "chronicle" },
        { filePaths: [], id: "date", name: "date", source: "date" }
      ]
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.find((chart) => chart.source === "date")?.entries).toMatchObject([
      {
        dateKind: "actual",
        endLabel: "2026-05-03",
        fileName: "actual-only",
        path: "actual-only.md",
        startLabel: "2026-05-03",
        statuses: ["done"]
      },
      {
        dateKind: "planned",
        endLabel: "2026-05-01",
        fileName: "planned-only",
        path: "planned-only.md",
        startLabel: "2026-05-01",
        statuses: ["todo"]
      }
    ]);
  });
});

describe("updateWorkspaceGanttChartEntry", () => {
  it("chronicle0バー移動時にchronicle0とplannedDateを連動して更新する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-chronicle-update-"));
    const filePath = path.join(workspacePath, "entry.md");
    await writeFile(filePath, "---\nchronicle0: [1185, 1333]\nplannedDate: [2026-05-01, 2026-05-05]\n---\n# A\n", "utf8");

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

  it("サブ暦バー移動時は元のchronicleNへサブ暦年で書き戻す", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-sub-chronicle-update-"));
    const filePath = path.join(workspacePath, "entry.md");
    await writeFile(filePath, "---\nchronicle1: [3]\nplannedDate: [2026-05-01]\n---\n# A\n", "utf8");

    const result = await updateWorkspaceGanttChartEntry(
      workspacePath,
      [
        { filePaths: [], id: "chronicle", name: "chronicle", source: "chronicle" },
        { filePaths: [], id: "date", name: "date", source: "date" }
      ],
      {
        chronicleCalendarId: "chronicle1",
        endValue: 102,
        kind: "move",
        originalEndValue: 101,
        originalStartValue: 101,
        path: "entry.md",
        source: "chronicle",
        startValue: 102
      },
      [
        { id: "chronicle0", name: "王国暦" },
        { id: "chronicle1", name: "帝国暦", startYear: 100 }
      ]
    );

    expect(result.ok).toBe(true);

    const updated = await readFile(filePath, "utf8");
    expect(updated).toContain("chronicle1: [4]");
    expect(updated).not.toContain("chronicle0:");
    expect(extractDateRange(updated)).toEqual({ endDate: "2027-05-01", startDate: "2027-05-01" });
  });

  it("dateバーの長さ変更時にplannedDateとchronicle0を連動して更新する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-date-update-"));
    const filePath = path.join(workspacePath, "entry.md");
    await writeFile(filePath, "---\nchronicle0: [2026]\nplannedDate: [2026-12-30]\n---\n# A\n", "utf8");

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
    expect(updated).toContain("plannedDate:");
    expect(updated).not.toContain("\ndate:");
    expect(updated).not.toContain("&ref");
  });

  it("actualDateバーの長さ変更時にactualDateとchronicleを連動して更新する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-actual-date-update-"));
    const filePath = path.join(workspacePath, "entry.md");
    await writeFile(filePath, "---\nchronicle0: [2026]\nplannedDate: [2026-05-01]\nactualDate: [2026-05-02]\n---\n# A\n", "utf8");

    const result = await updateWorkspaceGanttChartEntry(
      workspacePath,
      [
        { filePaths: [], id: "chronicle", name: "chronicle", source: "chronicle" },
        { filePaths: [], id: "date", name: "date", source: "date" }
      ],
      {
        dateKind: "actual",
        endValue: 20580,
        kind: "resize-end",
        originalEndValue: 20575,
        originalStartValue: 20575,
        path: "entry.md",
        source: "date",
        startValue: 20575
      }
    );

    expect(result.ok).toBe(true);

    const updated = await readFile(filePath, "utf8");
    expect(updated).toContain("plannedDate:");
    expect(updated).toContain("actualDate:");
    expect(updated).toContain("2026-05-01");
    expect(updated).toContain("2026-05-02");
    expect(updated).toContain("2026-05-07");
    expect(updated).not.toContain("T00:00:00.000Z");
    expect(extractChronicleRange(updated)).toEqual({ endYear: 2026, startYear: 2026 });
  });
});
