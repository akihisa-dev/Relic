import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";

import type { AppLanguage } from "../shared/ipc";
import { createTranslator as createSharedTranslator, type TranslationKey, type Translator } from "../shared/i18n";

export type { TranslationKey, Translator };

export function createTranslator(language: AppLanguage): Translator {
  return createSharedTranslator(language, typeof navigator === "undefined" ? undefined : navigator.language);
}

const I18nContext = createContext<Translator>(createTranslator("system"));

export function I18nProvider({
  children,
  language
}: {
  children: ReactNode;
  language: AppLanguage;
}): ReactNode {
  const translator = useMemo(() => createTranslator(language), [language]);

  return <I18nContext.Provider value={translator}>{children}</I18nContext.Provider>;
}

export function useT(): Translator {
  return useContext(I18nContext);
}
