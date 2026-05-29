import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";

import {
  chronicleCalendarIds,
  defaultChronicleCalendars,
  type ChronicleCalendarId,
  type ChronicleCalendarSettings,
  type ChartSettings,
  type ChartSource
} from "../../shared/ipc";
import { atomicWriteTextFile } from "../files/atomicWrite";
import { normalizeWorkspaceRelativeInputPath } from "../files/paths";

export interface WorkspaceSettings {
  chronicleCalendars: ChronicleCalendarSettings[];
  charts: ChartSettings[];
  pinnedPaths: string[];
  workspacePath: string;
}

type PersistedWorkspaceSettings = Partial<WorkspaceSettings> & {
  ganttCharts?: unknown;
};

export const defaultCharts: ChartSettings[] = [
  { filePaths: [], id: "chronicle", name: "chronicle", source: "chronicle" },
  { filePaths: [], id: "date", name: "date", source: "date" }
];

const defaultWorkspaceSettings: WorkspaceSettings = {
  chronicleCalendars: defaultChronicleCalendars,
  charts: defaultCharts,
  pinnedPaths: [],
  workspacePath: ""
};

const WORKSPACE_SETTINGS_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

export function getWorkspaceSettingsPath(userDataPath: string, workspaceId: string): string {
  assertSafeWorkspaceSettingsId(workspaceId);

  return path.join(userDataPath, "workspaces", `${workspaceId}.json`);
}

export async function readWorkspaceSettings(
  userDataPath: string,
  workspaceId: string
): Promise<WorkspaceSettings> {
  try {
    const settingsPath = getWorkspaceSettingsPath(userDataPath, workspaceId);
    const raw = await readFile(settingsPath, "utf8");
    const parsed = parseSettingsObject(raw);

    if (!parsed) {
      return defaultWorkspaceSettings;
    }

    return {
      chronicleCalendars: parseChronicleCalendars(parsed.chronicleCalendars),
      charts: parseCharts(parsed.charts ?? parsed.ganttCharts),
      pinnedPaths: parsePinnedPaths(parsed.pinnedPaths),
      workspacePath: typeof parsed.workspacePath === "string" ? parsed.workspacePath : ""
    };
  } catch (error) {
    if (isMissingFileError(error) || isInvalidWorkspaceSettingsIdError(error)) {
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

    if (!id || used.has(id) || typeof candidate.name !== "string") return [];
    used.add(id);

    if (id === "chronicle0") return [{ id, name }];

    if (!("startYear" in candidate)) return [{ id, name }];

    return Number.isInteger(candidate.startYear) && Number(candidate.startYear) >= 1
      ? [{ id, name, startYear: Number(candidate.startYear) }]
      : [{ id, name }];
  });

  const main = parsed.find((calendar) => calendar.id === "chronicle0") ?? defaultChronicleCalendars[0];
  const subs = parsed
    .filter((calendar) => calendar.id !== "chronicle0")
    .sort((a, b) => chronicleCalendarIds.indexOf(a.id) - chronicleCalendarIds.indexOf(b.id));

  return [main, ...subs];
}

export function parseCharts(raw: unknown): ChartSettings[] {
  if (!Array.isArray(raw)) return defaultCharts;

  const parsed = raw.flatMap((chart): ChartSettings[] => {
    if (typeof chart !== "object" || chart === null) return [];

    const candidate = chart as Record<string, unknown>;
    const id = typeof candidate.id === "string" ? candidate.id.trim() : "";
    const name = typeof candidate.name === "string" ? candidate.name.trim() : "";
    const source = candidate.source;

    if (!id || !isChartSource(source)) return [];

    return [{
      filePaths: parseChartFilePaths(candidate.filePaths),
      id,
      name: name || defaultChartName(source),
      source
    }];
  });

  return defaultCharts.map((defaultChart) => {
    const saved = parsed.find((chart) => chart.id === defaultChart.id || chart.source === defaultChart.source);

    return {
      ...defaultChart,
      filePaths: saved?.filePaths ?? defaultChart.filePaths
    };
  });
}

export function parsePinnedPaths(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];

  const paths = raw.flatMap((item): string[] => {
    if (typeof item !== "string") return [];

    const normalized = normalizePinnedPath(item);
    return normalized ? [normalized] : [];
  });

  return Array.from(new Set(paths));
}

function normalizePinnedPath(raw: string): string | null {
  return normalizeWorkspaceRelativeSettingPath(raw);
}

export function normalizeWorkspaceRelativeSettingPath(raw: string): string | null {
  return normalizeWorkspaceRelativeInputPath(raw);
}

function parseChartFilePaths(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;

  const paths = raw.flatMap((item): string[] => {
    if (typeof item !== "string") return [];

    const normalized = normalizeWorkspaceRelativeSettingPath(item);
    return normalized ? [normalized] : [];
  });

  return Array.from(new Set(paths));
}

function isChartSource(value: unknown): value is ChartSource {
  return value === "chronicle" || value === "date";
}

function isChronicleCalendarId(value: string): value is ChronicleCalendarId {
  return chronicleCalendarIds.includes(value as ChronicleCalendarId);
}

function defaultChartName(source: ChartSource): string {
  return source === "date" ? "日付チャート" : "年表";
}

function assertSafeWorkspaceSettingsId(workspaceId: string): void {
  if (workspaceId.trim() !== workspaceId || !WORKSPACE_SETTINGS_ID_PATTERN.test(workspaceId)) {
    throw new Error("Invalid workspace settings id.");
  }
}

function isInvalidWorkspaceSettingsIdError(error: unknown): boolean {
  return error instanceof Error && error.message === "Invalid workspace settings id.";
}

export async function writeWorkspaceSettings(
  userDataPath: string,
  workspaceId: string,
  settings: WorkspaceSettings
): Promise<void> {
  const settingsPath = getWorkspaceSettingsPath(userDataPath, workspaceId);

  await mkdir(path.dirname(settingsPath), { recursive: true });
  await atomicWriteTextFile(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
}

function parseSettingsObject(raw: string): PersistedWorkspaceSettings | null {
  try {
    const parsed: unknown = JSON.parse(raw);

    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return null;
    }

    return parsed as PersistedWorkspaceSettings;
  } catch {
    return null;
  }
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "ENOENT"
  );
}
