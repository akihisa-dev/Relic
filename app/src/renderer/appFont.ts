import type { AppLanguage, EditorSettings } from "../shared/ipc";
import { resolveLanguage } from "../shared/i18n";

export const appFontFamilyMap: Record<"en" | "ja", Record<EditorSettings["font"], string>> = {
  en: {
    gothic: 'Arial, Helvetica, sans-serif',
    mincho: 'Georgia, "Times New Roman", serif',
    mono: 'Menlo, Consolas, "Courier New", monospace',
    system: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif'
  },
  ja: {
    gothic: '"Hiragino Sans", "Yu Gothic", Meiryo, sans-serif',
    mincho: '"Hiragino Mincho ProN", "Yu Mincho", "MS Mincho", serif',
    mono: 'Menlo, Consolas, "Hiragino Sans", "Yu Gothic", Meiryo, monospace',
    system: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif'
  }
};

export function resolveAppFontFamily(
  font: EditorSettings["font"],
  language: AppLanguage,
  systemLanguage = globalThis.navigator?.language
): string {
  return appFontFamilyMap[resolveLanguage(language, systemLanguage)][font];
}
