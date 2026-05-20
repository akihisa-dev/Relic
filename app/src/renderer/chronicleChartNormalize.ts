import type { GanttChartEntry, MarkdownFileContent, WorkspaceGanttChart, WorkspaceTreeNode } from "../shared/ipc";

export function normalizeWorkspaceChronicle(value: unknown): WorkspaceGanttChart[] {
  if (!Array.isArray(value)) return [];

  if (value.every(isWorkspaceChronicle)) return fixedWorkspaceChronicle(value);

  const legacyEntries = value.flatMap((entry): GanttChartEntry[] => {
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
    ? fixedWorkspaceChronicle([{ entries: legacyEntries, filePaths: legacyEntries.map((entry) => entry.path), id: "chronicle", name: "chronicle", source: "chronicle" }])
    : fixedWorkspaceChronicle([]);
}

export async function normalizeWorkspaceChronicleWithFiles(
  value: unknown,
  fileTree: WorkspaceTreeNode[],
  readMarkdownFile: (input: { path: string }) => Promise<{ ok: true; value: MarkdownFileContent } | { ok: false }>
): Promise<WorkspaceGanttChart[]> {
  void fileTree;
  void readMarkdownFile;
  return normalizeWorkspaceChronicle(value);
}

function fixedWorkspaceChronicle(charts: WorkspaceGanttChart[]): WorkspaceGanttChart[] {
  const chronicle = charts.find((chart) => chart.source === "chronicle" || chart.id === "chronicle");

  return [
    {
      entries: chronicle?.entries ?? [],
      filePaths: chronicle?.filePaths ?? [],
      id: "chronicle",
      name: "Chronicle",
      source: "chronicle"
    }
  ];
}

function isWorkspaceChronicle(value: unknown): value is WorkspaceGanttChart {
  if (typeof value !== "object" || value === null) return false;

  const chart = value as Record<string, unknown>;
  return (
    typeof chart.id === "string" &&
    typeof chart.name === "string" &&
    chart.source === "chronicle" &&
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
