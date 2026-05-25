import type { ChartEntry, WorkspaceChart } from "../shared/ipc";

export function normalizeWorkspaceCharts(value: unknown): WorkspaceChart[] {
  if (!Array.isArray(value)) return [];

  if (value.every(isWorkspaceChart)) return fixedWorkspaceCharts(value);

  const legacyEntries = value.flatMap((entry): ChartEntry[] => {
    if (typeof entry !== "object" || entry === null) return [];

    const candidate = entry as Record<string, unknown>;
    if (
      typeof candidate.path !== "string" ||
      typeof candidate.fileName !== "string" ||
      typeof candidate.startYear !== "number" ||
      typeof candidate.endYear !== "number"
    ) return [];

    return [{
      endLabel: formatLegacyChronicleYear(candidate.endYear),
      endValue: legacyChronicleYearToAxis(candidate.endYear),
      fileName: candidate.fileName,
      path: candidate.path,
      startLabel: formatLegacyChronicleYear(candidate.startYear),
      startValue: legacyChronicleYearToAxis(candidate.startYear)
    }];
  });

  return legacyEntries.length > 0
    ? fixedWorkspaceCharts([{ entries: legacyEntries, filePaths: legacyEntries.map((entry) => entry.path), id: "chronicle", name: "chronicle", source: "chronicle" }])
    : fixedWorkspaceCharts([]);
}

function fixedWorkspaceCharts(charts: WorkspaceChart[]): WorkspaceChart[] {
  const chronicle = charts.find((chart) => chart.source === "chronicle" || chart.id === "chronicle");
  const date = charts.find((chart) => chart.source === "date" || chart.id === "date");

  return [
    {
      entries: chronicle?.entries ?? [],
      filePaths: chronicle?.filePaths ?? [],
      id: "chronicle",
      name: "chronicle",
      source: "chronicle"
    },
    {
      entries: date?.entries ?? [],
      filePaths: date?.filePaths ?? [],
      id: "date",
      name: "date",
      source: "date"
    }
  ];
}

function isWorkspaceChart(value: unknown): value is WorkspaceChart {
  if (typeof value !== "object" || value === null) return false;

  const chart = value as Record<string, unknown>;
  return (
    typeof chart.id === "string" &&
    typeof chart.name === "string" &&
    (chart.source === "chronicle" || chart.source === "date") &&
    Array.isArray(chart.entries) &&
    (!("filePaths" in chart) || Array.isArray(chart.filePaths))
  );
}

function legacyChronicleYearToAxis(year: number): number {
  return year < 0 ? year : year - 1;
}

function formatLegacyChronicleYear(year: number): string {
  return year < 0 ? `−${Math.abs(year)}` : String(year);
}
