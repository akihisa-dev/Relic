import type { RelicApi } from "../shared/ipc";

export type ChronicleFileReader = Pick<RelicApi, "readMarkdownFile">["readMarkdownFile"];
export type ChronicleEntryFallbackApi = Pick<
  RelicApi,
  "getWorkspaceChronicle" | "readMarkdownFile" | "writeMarkdownFile"
>;
