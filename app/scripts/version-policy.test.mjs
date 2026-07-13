import { describe, expect, it } from "vitest";

import { nextVersion, parseCommitSubject, validateVersionChange } from "./version-policy.mjs";

describe("version policy", () => {
  it("increments minor for feat and resets patch", () => {
    expect(nextVersion("0.5.37", "feat")).toBe("0.6.0");
  });

  it.each(["fix", "docs", "test", "refactor", "perf", "chore"])(
    "increments patch for %s",
    (type) => {
      expect(nextVersion("0.5.37", type)).toBe("0.5.38");
    },
  );

  it("increments major only when explicitly requested", () => {
    expect(nextVersion("0.5.37", "feat", { major: true })).toBe("1.0.0");
  });

  it("parses the Relic commit subject format", () => {
    expect(parseCommitSubject("feat: 0.6.0 バージョン規則を自動化")).toEqual({
      type: "feat",
      breaking: false,
      version: "0.6.0",
      description: "バージョン規則を自動化",
    });
  });

  it("rejects a breaking marker without explicit major approval", () => {
    expect(() =>
      validateVersionChange({
        previous: "0.5.37",
        current: "1.0.0",
        message: "feat!: 1.0.0 保存形式を更新",
      }),
    ).toThrow("Version-Impact: major");
  });

  it("accepts an owner-directed major generation update", () => {
    expect(
      validateVersionChange({
        previous: "0.5.37",
        current: "1.0.0",
        message: "feat!: 1.0.0 新しい製品世代へ更新\n\nVersion-Impact: major",
      }),
    ).toEqual({ expected: "1.0.0", type: "feat", major: true });
  });

  it("requires the subject and package versions to match", () => {
    expect(() =>
      validateVersionChange({
        previous: "0.5.37",
        current: "0.6.0",
        message: "feat: 0.5.38 バージョン規則を自動化",
      }),
    ).toThrow("does not match");
  });

  it("rejects commit scopes because Relic subjects do not use them", () => {
    expect(() => parseCommitSubject("feat(editor): 0.6.0 機能を追加")).toThrow("Invalid commit subject");
  });
});
