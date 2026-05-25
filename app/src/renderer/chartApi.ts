import type { RelicApi } from "../shared/ipc";

export type ChartFileReader = Pick<RelicApi, "readMarkdownFile">["readMarkdownFile"];
export type ChartEntryFallbackApi = Pick<
  RelicApi,
  "getWorkspaceCharts" | "readMarkdownFile" | "writeMarkdownFile"
> & Partial<Pick<RelicApi, "getWorkspaceChronicleCalendars">>;
