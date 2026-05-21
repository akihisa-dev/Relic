import type { TimelineChartEntry, MarkdownCardContent, CardbookTimelineChart, CardbookTreeNode } from "../shared/ipc";

export function normalizeCardbookTimeline(value: unknown): CardbookTimelineChart[] {
  if (!Array.isArray(value)) return [];

  if (value.every(isCardbookTimeline)) return fixedCardbookTimeline(value);

  const legacyEntries = value.flatMap((entry): TimelineChartEntry[] => {
    if (typeof entry !== "object" || entry === null) return [];

    const candidate = entry as Record<string, unknown>;
    if (
      typeof candidate.path !== "string" ||
      typeof candidate.cardName !== "string" ||
      typeof candidate.startYear !== "number" ||
      typeof candidate.endYear !== "number"
    ) return [];

    return [{
      endLabel: formatLegacyTimelineYear(candidate.endYear),
      endValue: legacyTimelineYearToAxis(candidate.endYear),
      cardName: candidate.cardName,
      path: candidate.path,
      startLabel: formatLegacyTimelineYear(candidate.startYear),
      startValue: legacyTimelineYearToAxis(candidate.startYear)
    }];
  });

  return legacyEntries.length > 0
    ? fixedCardbookTimeline([{ entries: legacyEntries, cardPaths: legacyEntries.map((entry) => entry.path), id: "timeline", name: "timeline", source: "timeline" }])
    : fixedCardbookTimeline([]);
}

export async function normalizeCardbookTimelineWithCards(
  value: unknown,
  cardTree: CardbookTreeNode[],
  readMarkdownCard: (input: { path: string }) => Promise<{ ok: true; value: MarkdownCardContent } | { ok: false }>
): Promise<CardbookTimelineChart[]> {
  void cardTree;
  void readMarkdownCard;
  return normalizeCardbookTimeline(value);
}

function fixedCardbookTimeline(charts: CardbookTimelineChart[]): CardbookTimelineChart[] {
  const timeline = charts.find((chart) => chart.source === "timeline" || chart.id === "timeline");

  return [
    {
      entries: timeline?.entries ?? [],
      cardPaths: timeline?.cardPaths ?? [],
      id: "timeline",
      name: "Timeline",
      source: "timeline"
    }
  ];
}

function isCardbookTimeline(value: unknown): value is CardbookTimelineChart {
  if (typeof value !== "object" || value === null) return false;

  const chart = value as Record<string, unknown>;
  return (
    typeof chart.id === "string" &&
    typeof chart.name === "string" &&
    chart.source === "timeline" &&
    Array.isArray(chart.entries) &&
    (!("cardPaths" in chart) || Array.isArray(chart.cardPaths))
  );
}

function legacyTimelineYearToAxis(year: number): number {
  return year < 0 ? year : year - 1;
}

function formatLegacyTimelineYear(year: number): string {
  return year < 0 ? `−${Math.abs(year)}` : String(year);
}
