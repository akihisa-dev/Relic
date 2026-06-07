import { fail, ok, type RelicResult } from "../../shared/result";

export const regexMaxPatternLength = 256;
export const regexMaxLineLength = 10_000;
const regexMaxCapturingGroups = 40;
const regexMaxQuantifiers = 80;
const nestedQuantifiedGroupPattern = /\((?:[^()\\]|\\.|\\[[^\]]*\])*[*+?{](?:[^()\\]|\\.|\\[[^\]]*\])*\)\s*(?:[*+?]|\{\d+(?:,\d*)?\})/;

export function validateSafeRegexPattern(pattern: string, operationLabel: string): RelicResult<void> {
  if (pattern.length > regexMaxPatternLength) {
    return fail(
      "REGEX_TOO_COMPLEX",
      `${operationLabel}の正規表現が長すぎます。短い条件にしてください。`
    );
  }

  if (countCapturingGroups(pattern) > regexMaxCapturingGroups || countQuantifiers(pattern) > regexMaxQuantifiers) {
    return fail(
      "REGEX_TOO_COMPLEX",
      `${operationLabel}の正規表現が複雑すぎます。条件を単純にしてください。`
    );
  }

  if (nestedQuantifiedGroupPattern.test(pattern)) {
    return fail(
      "REGEX_TOO_COMPLEX",
      `${operationLabel}の正規表現が重すぎる可能性があります。繰り返しを単純にしてください。`
    );
  }

  return ok(undefined);
}

export function isRegexSafeLine(line: string): boolean {
  return line.length <= regexMaxLineLength;
}

export function validateRegexTargetText(text: string, operationLabel: string): RelicResult<void> {
  if (text.split("\n").some((line) => !isRegexSafeLine(line))) {
    return fail(
      "REGEX_TARGET_TOO_LONG",
      `${operationLabel}の対象行が長すぎます。正規表現では処理できません。`
    );
  }

  return ok(undefined);
}

function countCapturingGroups(pattern: string): number {
  let count = 0;

  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];
    if (char === "\\") {
      index += 1;
      continue;
    }
    if (char === "[") {
      index = skipCharacterClass(pattern, index);
      continue;
    }
    if (char === "(" && pattern[index + 1] !== "?") count += 1;
  }

  return count;
}

function countQuantifiers(pattern: string): number {
  let count = 0;

  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];
    if (char === "\\") {
      index += 1;
      continue;
    }
    if (char === "[") {
      index = skipCharacterClass(pattern, index);
      continue;
    }
    if (char === "*" || char === "+" || char === "?" || char === "{") count += 1;
  }

  return count;
}

function skipCharacterClass(pattern: string, startIndex: number): number {
  for (let index = startIndex + 1; index < pattern.length; index += 1) {
    if (pattern[index] === "\\") {
      index += 1;
      continue;
    }
    if (pattern[index] === "]") return index;
  }

  return pattern.length - 1;
}
