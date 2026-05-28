import type { AppLanguage } from "./ipcSettings";
import en from "./locales/en.json";
import ja from "./locales/ja.json";

const dictionaries = { en, ja };

export type TranslationKey = keyof typeof en;
export type Translator = (key: TranslationKey, values?: Record<string, string | number>) => string;

function resolveLanguage(language: AppLanguage, systemLanguage?: string): "en" | "ja" {
  if (language === "en" || language === "ja") return language;

  if (systemLanguage?.toLowerCase().startsWith("ja")) {
    return "ja";
  }

  return "en";
}

export function createTranslator(language: AppLanguage, systemLanguage?: string): Translator {
  const resolved = resolveLanguage(language, systemLanguage);
  const dictionary = dictionaries[resolved];

  return (key, values = {}) => {
    const template = dictionary[key] ?? en[key] ?? key;

    return Object.entries(values).reduce(
      (text, [name, value]) => text.replaceAll(`{{${name}}}`, String(value)),
      template
    );
  };
}
