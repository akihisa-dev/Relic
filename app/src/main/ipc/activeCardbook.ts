import { app } from "electron";

import type { CardbookSummary } from "../../shared/ipc";
import { fail, type RelicResult } from "../../shared/result";
import { readAppSettings, type AppSettings } from "../settings/appSettings";
import { toCardbookState } from "../cardbook/cardbookService";

interface IpcFailure {
  code: string;
  message: string;
}

export interface ActiveCardbookContext {
  activeCardbook: CardbookSummary;
  settings: AppSettings;
  userDataPath: string;
}

export function ipcErrorDetails(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function getActiveCardbookContext(): Promise<RelicResult<ActiveCardbookContext>> {
  const userDataPath = app.getPath("userData");
  const settings = await readAppSettings(userDataPath);
  const state = toCardbookState(settings);

  if (!state.activeCardbook) {
    return fail("CARDBOOK_NOT_SELECTED", "先にカードブックを開いてください。");
  }

  return {
    ok: true,
    value: {
      activeCardbook: state.activeCardbook,
      settings,
      userDataPath
    }
  };
}

export async function withActiveCardbook<T>(
  failure: IpcFailure,
  action: (cardbookPath: string) => Promise<RelicResult<T>>
): Promise<RelicResult<T>> {
  try {
    const context = await getActiveCardbookContext();
    if (!context.ok) return context;

    return action(context.value.activeCardbook.path);
  } catch (error) {
    return fail(
      failure.code,
      failure.message,
      ipcErrorDetails(error)
    );
  }
}
