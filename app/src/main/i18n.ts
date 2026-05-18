import { app } from "electron";

import { createTranslator, type Translator } from "../shared/i18n";
import { readAppSettings } from "./settings/appSettings";

export async function getMainTranslator(): Promise<Translator> {
  const settings = await readAppSettings(app.getPath("userData"));

  return createTranslator(settings.editorSettings.language, app.getLocale());
}
