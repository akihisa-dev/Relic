import { fail, ok, type RelicResult } from "../../shared/result";

export function buildReplacementRegex(searchQuery: string, isRegex: boolean): RelicResult<RegExp> {
  if (searchQuery.trim() === "") {
    return fail("REPLACE_EMPTY_QUERY", "検索語句を入力してください。");
  }

  try {
    const regex = isRegex
      ? new RegExp(searchQuery, "g")
      : new RegExp(escapeRegExp(searchQuery), "g");
    if (isRegex && canMatchEmptyText(regex)) {
      return fail("REPLACE_REGEX_EMPTY_MATCH", "空文字に一致する正規表現は置換できません。");
    }

    return ok(regex);
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

function canMatchEmptyText(regex: RegExp): boolean {
  const samples = ["", "a", "abc", "foo", "あ", "1", " a ", "\n"];

  for (const sample of samples) {
    regex.lastIndex = 0;
    const match = regex.exec(sample);
    if (match?.[0] === "") {
      regex.lastIndex = 0;
      return true;
    }
  }

  regex.lastIndex = 0;
  return false;
}
