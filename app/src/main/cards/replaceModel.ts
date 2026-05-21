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

export function buildReplacementPreviewLine(line: string, regex: RegExp, replacement: string): string {
  regex.lastIndex = 0;
  return line.replaceAll(regex, replacement);
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
