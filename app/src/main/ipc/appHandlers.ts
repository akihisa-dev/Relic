import { app } from "electron";

import { getAppInfoChannel, type AppInfo } from "../../shared/ipc";
import { fail, ok, type RelicResult } from "../../shared/result";
import { ipcErrorDetails } from "./activeWorkspace";
import { handleLocalizedIpc } from "./localizedIpcHandler";

export function registerAppHandlers(): void {
  handleLocalizedIpc(getAppInfoChannel, async (): Promise<RelicResult<AppInfo>> => {
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
        ipcErrorDetails(error)
      );
    }
  });
}
