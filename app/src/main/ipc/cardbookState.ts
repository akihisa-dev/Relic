import { app } from "electron";

import type { CardbookState } from "../../shared/ipc";
import { readCardbookCardTree } from "../cards/cardTree";
import { type AppSettings } from "../settings/appSettings";
import { readCardbookSettings } from "../settings/cardbookSettings";
import { toCardbookState } from "../cardbook/cardbookService";

export async function buildCardbookState(settings: AppSettings): Promise<CardbookState> {
  const activeCardbook =
    settings.cardbooks.find((ws) => ws.id === settings.lastCardbookId) ?? null;

  if (!activeCardbook) {
    return toCardbookState(settings);
  }

  const [cardTree, wsSettings] = await Promise.all([
    readCardbookCardTree(activeCardbook.path),
    readCardbookSettings(app.getPath("userData"), activeCardbook.id)
  ]);

  return toCardbookState(settings, cardTree, wsSettings.pinnedPaths);
}
