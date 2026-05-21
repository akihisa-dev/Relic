import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  type TimelineChartSettings,
  type TimelineChartSource
} from "../../shared/ipc";

export interface CardbookSettings {
  timelineCharts: TimelineChartSettings[];
  pinnedPaths: string[];
  cardbookPath: string;
}

export const defaultTimelineCharts: TimelineChartSettings[] = [
  { cardPaths: [], id: "timeline", name: "Timeline", source: "timeline" }
];

const defaultCardbookSettings: CardbookSettings = {
  timelineCharts: defaultTimelineCharts,
  pinnedPaths: [],
  cardbookPath: ""
};

export function getCardbookSettingsPath(userDataPath: string, cardbookId: string): string {
  return path.join(userDataPath, "cardbooks", `${cardbookId}.json`);
}

export async function readCardbookSettings(
  userDataPath: string,
  cardbookId: string
): Promise<CardbookSettings> {
  const settingsPath = getCardbookSettingsPath(userDataPath, cardbookId);

  try {
    const raw = await readFile(settingsPath, "utf8");
    const parsed = JSON.parse(raw) as Partial<CardbookSettings>;

    return {
      timelineCharts: parseTimelineCharts(parsed.timelineCharts),
      pinnedPaths: Array.isArray(parsed.pinnedPaths)
        ? parsed.pinnedPaths.filter((p) => typeof p === "string")
        : [],
      cardbookPath: typeof parsed.cardbookPath === "string" ? parsed.cardbookPath : ""
    };
  } catch (error) {
    if (isMissingCardError(error)) {
      return defaultCardbookSettings;
    }

    throw error;
  }
}

export function parseTimelineCharts(raw: unknown): TimelineChartSettings[] {
  if (!Array.isArray(raw)) return defaultTimelineCharts;

  const parsed = raw.flatMap((chart): TimelineChartSettings[] => {
    if (typeof chart !== "object" || chart === null) return [];

    const candidate = chart as Record<string, unknown>;
    const id = typeof candidate.id === "string" ? candidate.id.trim() : "";
    const name = typeof candidate.name === "string" ? candidate.name.trim() : "";
    const source = candidate.source;

    if (!id || !isTimelineChartSource(source)) return [];

    return [{
      cardPaths: parseTimelineChartCardPaths(candidate.cardPaths ?? candidate.filePaths),
      id,
      name: name || defaultTimelineChartName(source),
      source
    }];
  });

  return defaultTimelineCharts.map((defaultChart) => {
    const saved = parsed.find((chart) => chart.id === defaultChart.id || chart.source === defaultChart.source);

    return {
      ...defaultChart,
      cardPaths: saved?.cardPaths ?? defaultChart.cardPaths
    };
  });
}

function parseTimelineChartCardPaths(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;

  return Array.from(new Set(raw.filter((path) => typeof path === "string")));
}

function isTimelineChartSource(value: unknown): value is TimelineChartSource {
  return value === "timeline";
}

function defaultTimelineChartName(source: TimelineChartSource): string {
  void source;
  return "Timeline";
}

export async function writeCardbookSettings(
  userDataPath: string,
  cardbookId: string,
  settings: CardbookSettings
): Promise<void> {
  const settingsPath = getCardbookSettingsPath(userDataPath, cardbookId);

  await mkdir(path.dirname(settingsPath), { recursive: true });
  await writeFile(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
}

function isMissingCardError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "ENOENT"
  );
}
