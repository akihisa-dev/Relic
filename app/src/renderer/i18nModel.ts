import type { AppLanguage } from "../shared/ipc";
import { createTranslator as createSharedTranslator, type TranslationKey, type Translator } from "../shared/i18n";

export type { TranslationKey, Translator };

export function createTranslator(language: AppLanguage): Translator {
  return createSharedTranslator(language, typeof navigator === "undefined" ? undefined : navigator.language);
}
