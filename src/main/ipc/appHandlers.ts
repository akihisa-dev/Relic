import { app, ipcMain } from "electron";

import { getAppInfoChannel, type AppInfo } from "../../shared/ipc";
import { fail, ok, type RelicResult } from "../../shared/result";

export function registerAppHandlers(): void {
  ipcMain.handle(getAppInfoChannel, async (): Promise<RelicResult<AppInfo>> => {
    try {
      return ok({
        name: "Relic",
        version: app.getVersion(),
        platform: process.platform
      });
    } catch (error) {
      return fail(
        "APP_INFO_FAILED",
        "アプリ情報を取得できませんでした。",
        error instanceof Error ? error.message : String(error)
      );
    }
  });
}
