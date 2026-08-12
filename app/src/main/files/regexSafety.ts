import { fail, ok, type RelicResult } from "../../shared/result";

export const regexMaxPatternLength = 256;
export const regexMaxLineLength = 10_000;
const regexMaxCapturingGroups = 40;
const regexMaxQuantifiers = 80;
const nestedQuantifiedGroupPattern = /\((?:[^()\\]|\\.|\\[[^\]]*\])*[*+?{](?:[^()\\]|\\.|\\[[^\]]*\])*\)\s*(?:[*+?]|\{\d+(?:,\d*)?\})/;
const regexQuantifierPattern = /^(?:[*+?]|\{\d+(?:,\d*)?\})/;

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

  if (hasAmbiguousRepeatedAlternation(pattern)) {
    return fail(
      "REGEX_TOO_COMPLEX",
      `${operationLabel}の正規表現が重すぎる可能性があります。繰り返しの選択肢を単純にしてください。`
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

/**
 * A repeated alternation whose one branch is a prefix of another can make
 * backtracking engines revisit the same input exponentially. The check is
 * intentionally conservative and considers alternatives inside a group that
 * is itself quantified or nested below a quantified wrapper; ordinary
 * alternatives such as `(cat|dog)+` remain valid.
 */
function hasAmbiguousRepeatedAlternation(pattern: string): boolean {
  const groups = findGroups(pattern);

  const hasAmbiguousAlternation = (open: number, close: number): boolean => {
    const bodyStart = groupBodyStart(pattern, open, close);
    const alternatives = splitTopLevelAlternatives(pattern, bodyStart, close);
    if (alternatives.length < 2) return false;

    return alternatives.some((left, leftIndex) => {
      if (left.length === 0) return true;
      return alternatives.some((right, rightIndex) => {
        if (leftIndex === rightIndex || right.length <= left.length) return false;
        return canonicalRegexFragment(right).startsWith(canonicalRegexFragment(left));
      });
    });
  };

  const isQuantified = ({ close }: RegexGroup): boolean => {
    const quantifierStart = skipWhitespace(pattern, close + 1);
    return regexQuantifierPattern.test(pattern.slice(quantifierStart));
  };

  // The ambiguous alternation may be wrapped by one or more groups before a
  // quantifier is applied (for example `((a|aa))+`). Inspect group ancestry,
  // while retaining the same branch-prefix rule for each individual group.
  return groups.some((group) => {
    if (!hasAmbiguousAlternation(group.open, group.close)) return false;
    return groups.some((ancestor) => (
      isQuantified(ancestor) &&
      ancestor.open <= group.open &&
      ancestor.close >= group.close
    ));
  });
}

function canonicalRegexFragment(fragment: string): string {
  let canonical = fragment.replace(/\\x([0-9a-fA-F]{2})|\\u([0-9a-fA-F]{4})|\\(.)/g, (_match, hex, unicode, escaped) => {
    if (hex) return String.fromCharCode(Number.parseInt(hex, 16));
    if (unicode) return String.fromCharCode(Number.parseInt(unicode, 16));
    return escaped;
  });

  // A non-capturing wrapper does not change the language of a branch, but it
  // can otherwise hide a prefix from the deterministic ambiguity check.
  while (canonical.startsWith("(?:") && canonical.endsWith(")")) {
    canonical = canonical.slice(3, -1);
  }
  return canonical;
}

interface RegexGroup {
  close: number;
  open: number;
}

function findGroups(pattern: string): RegexGroup[] {
  const openGroups: number[] = [];
  const groups: RegexGroup[] = [];

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
    if (char === "(") {
      openGroups.push(index);
    } else if (char === ")") {
      const open = openGroups.pop();
      if (open !== undefined) groups.push({ close: index, open });
    }
  }

  return groups;
}

function groupBodyStart(pattern: string, open: number, close: number): number {
  if (pattern[open + 1] !== "?") return open + 1;

  const marker = pattern[open + 2];
  if (marker === ":" || marker === "=" || marker === "!") return open + 3;
  if (marker === "<" && (pattern[open + 3] === "=" || pattern[open + 3] === "!")) {
    return open + 4;
  }

  // Unknown group extensions are left intact and therefore handled
  // conservatively as part of the first alternative.
  return Math.min(open + 1, close);
}

function splitTopLevelAlternatives(pattern: string, start: number, end: number): string[] {
  const alternatives: string[] = [];
  let currentStart = start;
  let depth = 0;

  for (let index = start; index < end; index += 1) {
    const char = pattern[index];
    if (char === "\\") {
      index += 1;
      continue;
    }
    if (char === "[") {
      index = skipCharacterClass(pattern, index);
      continue;
    }
    if (char === "(") {
      depth += 1;
    } else if (char === ")") {
      depth = Math.max(0, depth - 1);
    } else if (char === "|" && depth === 0) {
      alternatives.push(pattern.slice(currentStart, index));
      currentStart = index + 1;
    }
  }

  alternatives.push(pattern.slice(currentStart, end));
  return alternatives;
}

function skipWhitespace(pattern: string, start: number): number {
  let index = start;
  while (/\s/.test(pattern[index] ?? "")) index += 1;
  return index;
}
