import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { extractTimelineRange, readCardbookTimeline, updateCardbookTimelineChartEntry } from "./timeline";

describe("extractTimelineRange", () => {
  it("単年を1要素配列として読む", () => {
    expect(extractTimelineRange("---\ntimeline: [1185]\n---\n# A")).toEqual({
      endYear: 1185,
      startYear: 1185
    });
  });

  it("期間を2要素配列として読む", () => {
    expect(extractTimelineRange("---\ntimeline: [-300, 250]\n---\n# A")).toEqual({
      endYear: 250,
      startYear: -300
    });
  });

  it("0年や逆順の期間は読まない", () => {
    expect(extractTimelineRange("---\ntimeline: [0]\n---\n# A")).toBeNull();
    expect(extractTimelineRange("---\ntimeline: [1333, 1185]\n---\n# A")).toBeNull();
  });

  it("配列以外や3要素以上の配列は読まない", () => {
    expect(extractTimelineRange("---\ntimeline: 1185\n---\n# A")).toBeNull();
    expect(extractTimelineRange("---\ntimeline: [1185, 1333, 1600]\n---\n# A")).toBeNull();
  });
});

describe("readCardbookTimeline", () => {
  it("timelineプロパティをTimelineとして読む", async () => {
    const cardbookPath = await mkdtemp(path.join(os.tmpdir(), "relic-timeline-chart-"));
    await writeFile(
      path.join(cardbookPath, "entry.md"),
      "---\ntimeline: [1185, 1333]\n---\n# A\n",
      "utf8"
    );

    const result = await readCardbookTimeline(
      cardbookPath,
      [
        { cardPaths: [], id: "timeline", name: "Timeline", source: "timeline" }
      ]
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value[0].entries).toMatchObject([
      {
        endLabel: "1333",
        cardName: "entry",
        path: "entry.md",
        startLabel: "1185"
      }
    ]);
  });
});

describe("updateCardbookTimelineChartEntry", () => {
  it("timelineバー移動時にtimelineだけを更新する", async () => {
    const cardbookPath = await mkdtemp(path.join(os.tmpdir(), "relic-timeline-update-"));
    const cardPath = path.join(cardbookPath, "entry.md");
    await writeFile(cardPath, "---\ntimeline: [1185, 1333]\n---\n# A\n", "utf8");

    const result = await updateCardbookTimelineChartEntry(
      cardbookPath,
      [
        { cardPaths: [], id: "timeline", name: "Timeline", source: "timeline" }
      ],
      {
        endValue: 1333,
        kind: "move",
        originalEndValue: 1332,
        originalStartValue: 1184,
        path: "entry.md",
        source: "timeline",
        startValue: 1185
      }
    );

    expect(result.ok).toBe(true);

    const updated = await readFile(cardPath, "utf8");
    expect(extractTimelineRange(updated)).toEqual({ endYear: 1334, startYear: 1186 });
    expect(updated).toContain("timeline:\n  - 1186\n  - 1334");
  });
});
