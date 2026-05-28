import { createContext, use, useMemo } from "react";
import type { ReactNode } from "react";

import type { AppLanguage } from "../shared/ipc";
import { createTranslator } from "./i18nModel";
import type { Translator } from "./i18nModel";

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
  return use(I18nContext);
}
