import { fail, ok, type RelicResult } from "../../shared/result";

export function buildReplacementRegex(searchQuery: string, isRegex: boolean): RelicResult<RegExp> {
  if (searchQuery.trim() === "") {
    return fail("REPLACE_EMPTY_QUERY", "検索語句を入力してください。");
  }

  try {
    return ok(isRegex
      ? new RegExp(searchQuery, "g")
      : new RegExp(escapeRegExp(searchQuery), "g"));
  } catch {
    return fail("REPLACE_REGEX_INVALID", "正規表現が正しくありません。");
  }
}

export function applyReplacement(text: string, regex: RegExp, replacement: string, isRegex: boolean): string {
  regex.lastIndex = 0;
  return isRegex
    ? text.replaceAll(regex, replacement)
    : text.replaceAll(regex, () => replacement);
}

export function buildReplacementPreviewLine(line: string, regex: RegExp, replacement: string, isRegex: boolean): string {
  regex.lastIndex = 0;
  return applyReplacement(line, regex, replacement, isRegex);
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
