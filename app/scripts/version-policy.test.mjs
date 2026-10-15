import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { nextVersion, parseCommitSubject, validateVersionArtifacts, validateVersionChange } from "./version-policy.mjs";

const script = fileURLToPath(new URL("./version-policy.mjs", import.meta.url));

describe("version policy", () => {
  it("applies each increment in chronological order", () => {
    expect(nextVersion("1.2.3", "patch", "patch", "patch")).toBe("1.2.6");
    expect(nextVersion("1.2.3", "patch", "minor", "patch")).toBe("1.3.1");
    expect(nextVersion("1.2.3", "minor", "major", "patch")).toBe("2.0.1");
  });

  it("requires explicit classifications rather than commit types", () => {
    expect(() => nextVersion("1.2.3", "feat")).toThrow("Unsupported");
    expect(() => nextVersion("1.2.3")).toThrow("required");
    expect(() => nextVersion("invalid", "patch")).toThrow("Invalid version");
  });

  it("accepts ordinary commits including breaking changes without updating the version", () => {
    for (const message of ["fix: 保存を修正", "feat!: 保存形式を変更", "docs: 手順を更新\n\nBREAKING CHANGE: 旧形式を廃止"]) {
      expect(validateVersionChange({ previous: "1.2.3", current: "1.2.3", message }).versionUpdate).toBe(false);
    }
  });

  it("does not require versions in ordinary subjects", () => {
    expect(parseCommitSubject("fix: 保存を修正")).toEqual({ type: "fix", breaking: false, version: null, description: "保存を修正" });
    expect(() => parseCommitSubject("fix(editor): 保存を修正")).toThrow("Invalid commit subject");
  });

  it.each(["fix: 1.2.3 保存を修正", "fix: 保存を修正\n\nVersion-Impact: major"])("rejects version annotations in ordinary commits: %s", (message) => {
    expect(() => validateVersionChange({ previous: "1.2.3", current: "1.2.3", message })).toThrow("Ordinary commits");
  });

  it("accepts a dedicated update covering multiple prior commits", () => {
    expect(validateVersionChange({ previous: "1.2.3", current: "1.3.1", message: "chore: 1.3.1 バージョンを更新" }).versionUpdate).toBe(true);
  });

  it.each([
    ["1.3.1", "fix: 1.3.1 保存を修正"],
    ["1.3.1", "chore: 番号を更新"],
    ["1.3.1", "chore: 1.3.0 番号を更新"],
    ["1.3.1", "chore!: 1.3.1 番号を更新"],
    ["1.2.2", "chore: 1.2.2 番号を更新"],
  ])("rejects invalid update %s / %s", (current, message) => {
    expect(() => validateVersionChange({ previous: "1.2.3", current, message })).toThrow();
  });

  it("requires package and SBOM versions to agree", () => {
    expect(validateVersionArtifacts({ packageVersion: "1.2.3", sbomVersion: "1.2.3" })).toBe("1.2.3");
    expect(() => validateVersionArtifacts({ packageVersion: "1.2.3", sbomVersion: "1.2.2" })).toThrow("does not match SBOM");
  });

  it("checks a real commit range and reads staged artifacts rather than working files", () => {
    const root = mkdtempSync(path.join(tmpdir(), "relic-version-policy-"));
    const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
    const run = (...args) => spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: "utf8" });
    const artifacts = (version, sbomVersion = version) => {
      writeFileSync(path.join(root, "app/package.json"), JSON.stringify({ version }));
      writeFileSync(path.join(root, "sbom/relic-dependencies.cdx.json"), JSON.stringify({ metadata: { component: { version: sbomVersion } } }));
    };
    const commit = (message) => {
      git("add", "app/package.json", "sbom/relic-dependencies.cdx.json");
      git("-c", "core.hooksPath=/dev/null", "commit", "--allow-empty", "-m", message);
    };
    try {
      git("init", "--quiet");
      git("config", "user.name", "Test");
      git("config", "user.email", "test@example.invalid");
      git("config", "commit.gpgsign", "false");
      mkdirSync(path.join(root, "app"));
      mkdirSync(path.join(root, "sbom"));
      artifacts("1.2.3");
      commit("chore: 初期状態");
      const base = git("rev-parse", "HEAD");
      commit("fix: 保存を修正");
      commit("feat: 操作を追加");
      artifacts("1.3.0");
      commit("chore: 1.3.0 バージョンを更新");
      commit("docs: 手順を更新");
      expect(run("check-range", base, "HEAD").status).toBe(0);
      expect(run("next", "--", "1.2.3", "patch", "minor", "patch").stdout.trim()).toBe("1.3.1");
      expect(run("check", "1.2.3", "1.3.1", "patch", "minor", "patch").status).toBe(0);
      expect(run("check", "1.2.3", "1.3.0", "patch", "minor", "patch").status).toBe(1);
      artifacts("1.3.1", "1.3.0");
      git("add", "app/package.json");
      artifacts("1.3.1");
      expect(run("check-staged").status).toBe(1);
      git("add", "sbom/relic-dependencies.cdx.json");
      expect(run("check-staged").status).toBe(0);
      commit("fix: 1.3.1 番号も変更");
      expect(run("check-range", base, "HEAD").status).toBe(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
