import { app } from "electron";

import { createTranslator, resolveLanguage, type Translator } from "../shared/i18n";
import { readAppSettings } from "./settings/appSettings";

let cachedTranslator: Translator = createTranslator("en");
let cachedLanguage: "en" | "ja" = "en";

export function getCachedMainLanguage(): "en" | "ja" {
  return cachedLanguage;
}

export function getCachedMainTranslator(): Translator {
  return cachedTranslator;
}

export function setMainTranslator(language: Parameters<typeof createTranslator>[0], systemLanguage?: string): void {
  const resolvedSystemLanguage = systemLanguage
    ?? (typeof app.getLocale === "function" ? app.getLocale() : "en");
  cachedLanguage = resolveLanguage(language, resolvedSystemLanguage);
  cachedTranslator = createTranslator(language, resolvedSystemLanguage);
}

export async function getMainTranslator(): Promise<Translator> {
  const localization = await getMainLocalization();
  cachedLanguage = localization.language;
  cachedTranslator = localization.t;
  return localization.t;
}

async function getMainLocalization(): Promise<{ language: "en" | "ja"; t: Translator }> {
  const settings = await readAppSettings(app.getPath("userData"));
  const systemLanguage = app.getLocale();

  return {
    language: resolveLanguage(settings.editorSettings.language, systemLanguage),
    t: createTranslator(settings.editorSettings.language, systemLanguage)
  };
}
