import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  type GanttChartSettings,
  type GanttChartSource
} from "../../shared/ipc";

export interface WorkspaceSettings {
  ganttCharts: GanttChartSettings[];
  pinnedPaths: string[];
  workspacePath: string;
}

export const defaultGanttCharts: GanttChartSettings[] = [
  { filePaths: [], id: "chronicle", name: "Chronicle", source: "chronicle" }
];

const defaultWorkspaceSettings: WorkspaceSettings = {
  ganttCharts: defaultGanttCharts,
  pinnedPaths: [],
  workspacePath: ""
};

export function getWorkspaceSettingsPath(userDataPath: string, workspaceId: string): string {
  return path.join(userDataPath, "workspaces", `${workspaceId}.json`);
}

export async function readWorkspaceSettings(
  userDataPath: string,
  workspaceId: string
): Promise<WorkspaceSettings> {
  const settingsPath = getWorkspaceSettingsPath(userDataPath, workspaceId);

  try {
    const raw = await readFile(settingsPath, "utf8");
    const parsed = JSON.parse(raw) as Partial<WorkspaceSettings>;

    return {
      ganttCharts: parseGanttCharts(parsed.ganttCharts),
      pinnedPaths: Array.isArray(parsed.pinnedPaths)
        ? parsed.pinnedPaths.filter((p) => typeof p === "string")
        : [],
      workspacePath: typeof parsed.workspacePath === "string" ? parsed.workspacePath : ""
    };
  } catch (error) {
    if (isMissingFileError(error)) {
      return defaultWorkspaceSettings;
    }

    throw error;
  }
}

export function parseGanttCharts(raw: unknown): GanttChartSettings[] {
  if (!Array.isArray(raw)) return defaultGanttCharts;

  const parsed = raw.flatMap((chart): GanttChartSettings[] => {
    if (typeof chart !== "object" || chart === null) return [];

    const candidate = chart as Record<string, unknown>;
    const id = typeof candidate.id === "string" ? candidate.id.trim() : "";
    const name = typeof candidate.name === "string" ? candidate.name.trim() : "";
    const source = candidate.source;

    if (!id || !isGanttChartSource(source)) return [];

    return [{
      filePaths: parseGanttChartFilePaths(candidate.filePaths),
      id,
      name: name || defaultGanttChartName(source),
      source
    }];
  });

  return defaultGanttCharts.map((defaultChart) => {
    const saved = parsed.find((chart) => chart.id === defaultChart.id || chart.source === defaultChart.source);

    return {
      ...defaultChart,
      filePaths: saved?.filePaths ?? defaultChart.filePaths
    };
  });
}

function parseGanttChartFilePaths(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;

  return Array.from(new Set(raw.filter((path) => typeof path === "string")));
}

function isGanttChartSource(value: unknown): value is GanttChartSource {
  return value === "chronicle";
}

function defaultGanttChartName(source: GanttChartSource): string {
  void source;
  return "Chronicle";
}

export async function writeWorkspaceSettings(
  userDataPath: string,
  workspaceId: string,
  settings: WorkspaceSettings
): Promise<void> {
  const settingsPath = getWorkspaceSettingsPath(userDataPath, workspaceId);

  await mkdir(path.dirname(settingsPath), { recursive: true });
  await writeFile(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "ENOENT"
  );
}
