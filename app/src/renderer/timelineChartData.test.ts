import { describe, expect, it, vi } from "vitest";

import type { UpdateTimelineChartEntryInput } from "../shared/ipc";
import {
  normalizeCardbookTimeline,
  normalizeCardbookTimelineWithCards,
  updateTimelineFrontmatter,
  updateTimelineEntryFallback
} from "./timelineChartData";

function timelineEditInput(overrides: Partial<UpdateTimelineChartEntryInput> = {}): UpdateTimelineChartEntryInput {
  return {
    endValue: 2026,
    kind: "move",
    originalEndValue: 2025,
    originalStartValue: 2025,
    path: "tasks/implementation.md",
    source: "timeline",
    startValue: 2026,
    ...overrides
  };
}

describe("timelineChartData", () => {
  it("旧形式 timeline 配列を現行Timelineへ正規化する", () => {
    const charts = normalizeCardbookTimeline([
      { endYear: 1333, cardName: "鎌倉時代", path: "history/kamakura.md", startYear: 1185 }
    ]);

    expect(charts).toEqual([
      {
        entries: [{
          endLabel: "1333",
          endValue: 1332,
          cardName: "鎌倉時代",
          path: "history/kamakura.md",
          startLabel: "1185",
          startValue: 1184
        }],
        cardPaths: ["history/kamakura.md"],
        id: "timeline",
        name: "Timeline",
        source: "timeline"
      }
    ]);
  });

  it("Markdown補完は行わず、mainから返ったTimelineを正規化する", async () => {
    const readMarkdownCard = vi.fn();
    const charts = await normalizeCardbookTimelineWithCards(
      [{ entries: [], cardPaths: [], id: "timeline", name: "Timeline", source: "timeline" }],
      [],
      readMarkdownCard
    );

    expect(charts).toEqual([{ entries: [], cardPaths: [], id: "timeline", name: "Timeline", source: "timeline" }]);
    expect(readMarkdownCard).not.toHaveBeenCalled();
  });

  it("timelineバー更新ではtimelineだけを更新する", () => {
    expect(updateTimelineFrontmatter(
      "---\ntimeline: [2026]\nstatus: [未着手]\n---\n# 実装タスク",
      timelineEditInput()
    )).toBe(
      "---\ntimeline: [2027]\nstatus: [未着手]\n---\n# 実装タスク"
    );
  });

  it("frontmatter がないカードにもTimeline用プロパティを追加する", () => {
    expect(updateTimelineFrontmatter("# 実装タスク", timelineEditInput())).toBe(
      "---\ntimeline: [2027]\n---\n# 実装タスク"
    );
  });

  it("Timeline更新IPCがない場合のfallbackは読み書き後に最新Timelineを返す", async () => {
    const charts = [{
      entries: [],
      cardPaths: [],
      id: "timeline",
      name: "Timeline",
      source: "timeline" as const
    }];
    const readMarkdownCard = vi.fn(async ({ path }: { path: string }) => ({
      ok: true as const,
      value: {
        content: "---\ntimeline: [2026]\n---\n# 実装タスク",
        name: "実装タスク",
        path
      }
    }));
    const writeMarkdownCard = vi.fn(async () => ({ ok: true as const, value: undefined }));
    const getCardbookTimeline = vi.fn(async () => ({ ok: true as const, value: charts }));

    await expect(updateTimelineEntryFallback(timelineEditInput(), {
      getCardbookTimeline,
      readMarkdownCard,
      writeMarkdownCard
    })).resolves.toEqual({ ok: true, value: charts });
    expect(writeMarkdownCard).toHaveBeenCalledWith({
      content: "---\ntimeline: [2027]\n---\n# 実装タスク",
      path: "tasks/implementation.md"
    });
  });
});
