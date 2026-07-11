import { describe, expect, it } from "vitest";

import type { ChartEntry } from "../shared/ipc";
import { rightPanelChronicleEntries } from "./rightPanelChronicle";

function entry(path: string, year: number): ChartEntry {
  return {
    chronicleCalendarName: "メイン暦",
    chronicleEntryIndex: 0,
    endLabel: `メイン暦 ${year}`,
    endPoint: { month: null, year },
    endValue: year * 12,
    fileName: path.replace(".md", ""),
    path,
    startLabel: `メイン暦 ${year}`,
    startPoint: { month: null, year },
    startValue: year * 12
  };
}

describe("rightPanelChronicleEntries", () => {
  it("編集中ファイルのchronicleを保存済み一覧へ即時反映して並べ直す", () => {
    const result = rightPanelChronicleEntries(
      [entry("前.md", 900), entry("編集中.md", 950), entry("後.md", 1100)],
      {
        content: "---\nchronicle:\n  - [メイン暦, [[1000, null], [1000, null]]]\n---\n# 本文",
        name: "編集中.md",
        path: "編集中.md"
      }
    );

    expect(result.map((item) => [item.fileName, item.startLabel])).toEqual([
      ["前", "900"],
      ["編集中", "1000"],
      ["後", "1100"]
    ]);
  });

  it("編集中のchronicleが不正な間はそのファイルを時系列へ表示しない", () => {
    const result = rightPanelChronicleEntries(
      [entry("編集中.md", 950), entry("後.md", 1100)],
      {
        content: "---\nchronicle:\n  - [メイン暦, [[0, null], [0, null]]]\n---",
        name: "編集中.md",
        path: "編集中.md"
      }
    );

    expect(result.map((item) => item.path)).toEqual(["後.md"]);
  });
});
