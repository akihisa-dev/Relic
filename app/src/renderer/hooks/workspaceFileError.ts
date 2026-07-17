import type { RelicError } from "../../shared/result";
import type { Translator } from "../i18nModel";

export function workspaceFileErrorMessage(error: RelicError, t: Translator): string {
  return error.code === "FILE_NAME_HIDDEN" ? t("files.hiddenNameError") : error.message;
}
