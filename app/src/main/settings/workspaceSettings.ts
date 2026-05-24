import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  chronicleCalendarIds,
  defaultChronicleCalendars,
  type ChronicleCalendarId,
  type ChronicleCalendarSettings,
  type GanttChartSettings,
  type GanttChartSource
} from "../../shared/ipc";

export interface WorkspaceSettings {
  chronicleCalendars: ChronicleCalendarSettings[];
  ganttCharts: GanttChartSettings[];
  pinnedPaths: string[];
  workspacePath: string;
}

export const defaultGanttCharts: GanttChartSettings[] = [
  { filePaths: [], id: "chronicle", name: "chronicle", source: "chronicle" },
  { filePaths: [], id: "date", name: "date", source: "date" }
];

const defaultWorkspaceSettings: WorkspaceSettings = {
  chronicleCalendars: defaultChronicleCalendars,
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
      chronicleCalendars: parseChronicleCalendars(parsed.chronicleCalendars),
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

export function parseChronicleCalendars(raw: unknown): ChronicleCalendarSettings[] {
  if (!Array.isArray(raw)) return defaultChronicleCalendars;

  const used = new Set<ChronicleCalendarId>();
  const parsed = raw.flatMap((item): ChronicleCalendarSettings[] => {
    if (typeof item !== "object" || item === null) return [];

    const candidate = item as Record<string, unknown>;
    const id = typeof candidate.id === "string" && isChronicleCalendarId(candidate.id)
      ? candidate.id
      : null;
    const name = typeof candidate.name === "string" ? candidate.name.trim() : "";

    if (!id || used.has(id) || !name) return [];
    used.add(id);

    if (id === "chronicle0") return [{ id, name }];

    return Number.isInteger(candidate.startYear) && Number(candidate.startYear) >= 1
      ? [{ id, name, startYear: Number(candidate.startYear) }]
      : [];
  });

  const main = parsed.find((calendar) => calendar.id === "chronicle0") ?? defaultChronicleCalendars[0];
  const subs = parsed
    .filter((calendar) => calendar.id !== "chronicle0")
    .sort((a, b) => chronicleCalendarIds.indexOf(a.id) - chronicleCalendarIds.indexOf(b.id));

  return [main, ...subs];
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
  return value === "chronicle" || value === "date";
}

function isChronicleCalendarId(value: string): value is ChronicleCalendarId {
  return chronicleCalendarIds.includes(value as ChronicleCalendarId);
}

function defaultGanttChartName(source: GanttChartSource): string {
  return source === "date" ? "日付ガント" : "年表";
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
