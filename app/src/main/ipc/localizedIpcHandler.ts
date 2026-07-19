import { ipcMain, type IpcMainInvokeEvent } from "electron";

import { createTranslator, type TranslationKey } from "../../shared/i18n";
import { fail, type RelicResult } from "../../shared/result";
import { getCachedMainLanguage, getCachedMainTranslator } from "../i18n";

type IpcHandler<Args extends unknown[], Result> = (
  event: IpcMainInvokeEvent,
  ...args: Args
) => Promise<Result> | Result;
type FailedResult = Extract<RelicResult<never>, { ok: false }>;

const japaneseTextPattern = /[ぁ-んァ-ヶ一-龠]/;

function needsLocalization(result: unknown): result is FailedResult {
  return Boolean(
    result
    && typeof result === "object"
    && "ok" in result
    && result.ok === false
    && "error" in result
    && result.error
    && typeof result.error === "object"
    && "message" in result.error
    && typeof result.error.message === "string"
    && japaneseTextPattern.test(result.error.message)
  );
}

function errorTranslationKey(code: string): TranslationKey {
  if (/(?:INVALID|EMPTY_QUERY|INVALID_INPUT)/.test(code)) return "errors.invalidInput";
  if (/(?:NOT_FOUND|MISSING)/.test(code)) return "errors.notFound";
  if (/(?:ALREADY_EXISTS)/.test(code)) return "errors.alreadyExists";
  if (/(?:OUTSIDE)/.test(code)) return "errors.outsideWorkspace";
  if (/(?:TOO_LARGE|EXHAUSTED)/.test(code)) return "errors.tooLarge";
  if (/(?:CONFLICT|STALE)/.test(code)) return "errors.conflict";
  if (/(?:UNSUPPORTED|NOT_MARKDOWN|NOT_FILE|NOT_FOLDER|NOT_DIRECTORY)/.test(code)) {
    return "errors.unsupported";
  }
  if (/(?:NO_WORKSPACE|NOT_SELECTED)/.test(code)) return "errors.workspaceRequired";
  return "errors.operationFailed";
}

function isAlreadyLocalized(code: string): boolean {
  return code.startsWith("OUTPUT_") || code.startsWith("WORKSPACE_REFRESH_");
}

export function localizeIpcResult<Result>(
  result: Result,
  language: "en" | "ja",
  t: (key: TranslationKey) => string
): Result {
  if (!needsLocalization(result)) return result;

  const failedResult = result;

  if (language === "ja") return result;
  if (isAlreadyLocalized(failedResult.error.code)) return result;

  return fail(
    failedResult.error.code,
    t(errorTranslationKey(failedResult.error.code)),
    failedResult.error.details
  ) as Result;
}

export function handleLocalizedIpc<Args extends unknown[], Result>(
  channel: string,
  handler: IpcHandler<Args, Result>
): void {
  ipcMain.handle(channel, async (event, ...args: Args) => {
    const result = await handler(event, ...args);
    if (!needsLocalization(result)) return result;
    const language = typeof getCachedMainLanguage === "function"
      ? getCachedMainLanguage()
      : "ja";
    const t = typeof getCachedMainTranslator === "function"
      ? getCachedMainTranslator()
      : createTranslator("ja");
    return localizeIpcResult(result, language, t);
  });
}
