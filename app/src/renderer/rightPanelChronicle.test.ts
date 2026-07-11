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
        content: "---\nchronicle: 1000\n---\n# 本文",
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
        content: "---\nchronicle: 0\n---",
        name: "編集中.md",
        path: "編集中.md"
      }
    );

    expect(result.map((item) => item.path)).toEqual(["後.md"]);
  });

  it("年だけの期間を開始年順に配置する", () => {
    const result = rightPanelChronicleEntries([], {
      content: "---\nchronicle:\n  start: 800\n  end: 950\n---",
      name: "王国.md",
      path: "王国.md"
    });

    expect(result[0]).toMatchObject({ startLabel: "800", endLabel: "950" });
  });
});
