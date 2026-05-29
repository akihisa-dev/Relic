import type { EditorSettings } from "../../shared/ipc";

export function isEditorSettingsInput(input: unknown): input is EditorSettings {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return false;

  const settings = input as Record<string, unknown>;

  return (
    (settings.font === "system" ||
      settings.font === "gothic" ||
      settings.font === "mincho" ||
      settings.font === "mono") &&
    isPositiveFiniteNumber(settings.fontSize) &&
    (settings.frontmatterDateFormat === "ymd" ||
      settings.frontmatterDateFormat === "system" ||
      settings.frontmatterDateFormat === "mdy" ||
      settings.frontmatterDateFormat === "dmy") &&
    (settings.language === "system" || settings.language === "en" || settings.language === "ja") &&
    isPositiveFiniteNumber(settings.lineHeight) &&
    (settings.maxWidth === "550px" ||
      settings.maxWidth === "660px" ||
      settings.maxWidth === "800px" ||
      settings.maxWidth === "none") &&
    typeof settings.showLineNumbers === "boolean" &&
    typeof settings.spellCheck === "boolean" &&
    (settings.theme === "light" || settings.theme === "dark" || settings.theme === "system")
  );
}

function isPositiveFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}
