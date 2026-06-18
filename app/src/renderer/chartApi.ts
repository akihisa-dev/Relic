import type { RelicApi } from "../shared/ipc";

export type ChartFileReader = Pick<RelicApi, "readMarkdownFile">["readMarkdownFile"];
