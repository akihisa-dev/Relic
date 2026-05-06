import { createContext, useContext } from "react";
import type { ReactNode } from "react";

import type { AppLanguage } from "../shared/ipc";
import en from "./locales/en.json";
import ja from "./locales/ja.json";

const dictionaries = { en, ja };

export type TranslationKey = keyof typeof en;
export type Translator = (key: TranslationKey, values?: Record<string, string | number>) => string;

function resolveLanguage(language: AppLanguage): "en" | "ja" {
  if (language === "en" || language === "ja") return language;

  if (typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("ja")) {
    return "ja";
  }

  return "en";
}

export function createTranslator(language: AppLanguage): Translator {
  const resolved = resolveLanguage(language);
  const dictionary = dictionaries[resolved];

  return (key, values = {}) => {
    const template = dictionary[key] ?? en[key] ?? key;

    return Object.entries(values).reduce(
      (text, [name, value]) => text.replaceAll(`{{${name}}}`, String(value)),
      template
    );
  };
}

const I18nContext = createContext<Translator>(createTranslator("system"));

export function I18nProvider({
  children,
  language
}: {
  children: ReactNode;
  language: AppLanguage;
}): ReactNode {
  return <I18nContext.Provider value={createTranslator(language)}>{children}</I18nContext.Provider>;
}

export function useT(): Translator {
  return useContext(I18nContext);
}
