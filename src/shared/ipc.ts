import type { RelicResult } from "./result";

export const getAppInfoChannel = "app:getInfo";

export interface AppInfo {
  name: "Relic";
  version: string;
  platform: NodeJS.Platform;
}

export interface RelicApi {
  getAppInfo: () => Promise<RelicResult<AppInfo>>;
}
