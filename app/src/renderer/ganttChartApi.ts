import type { RelicApi } from "../shared/ipc";

export type GanttChartFileReader = Pick<RelicApi, "readMarkdownFile">["readMarkdownFile"];
export type GanttChartEntryFallbackApi = Pick<
  RelicApi,
  "getWorkspaceChronicle" | "readMarkdownFile" | "writeMarkdownFile"
>;
