import { describe, expect, it } from "vitest";

import { validateSafeRegexPattern } from "./regexSafety";

describe("validateSafeRegexPattern", () => {
  it("繰り返し内で接頭辞が重なるalternationを早期拒否する", () => {
    const result = validateSafeRegexPattern("^(a|aa)+$", "検索");

    expect(result).toEqual(expect.objectContaining({
      error: expect.objectContaining({ code: "REGEX_TOO_COMPLEX" }),
      ok: false
    }));
  });

  it.each([
    "^(a|(?:aa))+$",
    String.raw`^(a|\x61\x61)+$`,
    String.raw`^(a|\u0061\u0061)+$`
  ])("wrapper/escape越しの曖昧alternationも拒否する: %s", (pattern) => {
    expect(validateSafeRegexPattern(pattern, "検索")).toEqual(expect.objectContaining({
      error: expect.objectContaining({ code: "REGEX_TOO_COMPLEX" }),
      ok: false
    }));
  });

  it.each([
    "^((a|aa))+$",
    "^(?:(?:a|aa))+$",
    "^(?:(?:(a|aa)))+$",
    "^((a|aa)){2,}$",
  ])("量指定されたwrapper内の曖昧なalternationを拒否する: %s", (pattern) => {
    expect(validateSafeRegexPattern(pattern, "検索")).toEqual(expect.objectContaining({
      error: expect.objectContaining({ code: "REGEX_TOO_COMPLEX" }),
      ok: false
    }));
  });

  it("互いに重ならない繰り返しalternationは許可する", () => {
    expect(validateSafeRegexPattern("^(cat|dog)+$", "検索")).toEqual({ ok: true, value: undefined });
    expect(validateSafeRegexPattern("^(a|b)+$", "検索")).toEqual({ ok: true, value: undefined });
  });

  it("繰り返しでない接頭辞alternationは拒否しない", () => {
    expect(validateSafeRegexPattern("^(a|aa)$", "検索")).toEqual({ ok: true, value: undefined });
  });

  it.each([
    "^((cat|dog))+$",
    "^(?:(?:a|b))+$",
    String.raw`^((a\|aa|bb))+$`,
    String.raw`^(([a|b]|c))+$`,
    "^(?=((a|b)))+$",
  ])("nestedでも曖昧でないalternationは許可する: %s", (pattern) => {
    expect(validateSafeRegexPattern(pattern, "検索")).toEqual({ ok: true, value: undefined });
  });
});
