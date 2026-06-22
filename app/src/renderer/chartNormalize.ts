import type { WorkspaceChart } from "../shared/ipc";

export function normalizeWorkspaceCharts(value: unknown): WorkspaceChart[] {
  if (!Array.isArray(value)) return [];

  if (value.every(isWorkspaceChart)) return fixedWorkspaceCharts(value);

  return fixedWorkspaceCharts([]);
}

function fixedWorkspaceCharts(charts: WorkspaceChart[]): WorkspaceChart[] {
  const chronicle = charts.find((chart) => chart.source === "chronicle" || chart.id === "chronicle");

  return [
    {
      entries: chronicle?.entries ?? [],
      filePaths: chronicle?.filePaths ?? [],
      id: "chronicle",
      name: "chronicle",
      source: "chronicle"
    }
  ];
}

function isWorkspaceChart(value: unknown): value is WorkspaceChart {
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
