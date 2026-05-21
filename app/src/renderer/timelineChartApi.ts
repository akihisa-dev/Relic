import type { RelicApi } from "../shared/ipc";

export type TimelineCardReader = Pick<RelicApi, "readMarkdownCard">["readMarkdownCard"];
export type TimelineEntryFallbackApi = Pick<
  RelicApi,
  "getCardbookTimeline" | "readMarkdownCard" | "writeMarkdownCard"
>;
