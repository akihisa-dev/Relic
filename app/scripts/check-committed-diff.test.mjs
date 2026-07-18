import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { checkCommittedDiff, normalizeCommit } from "./check-committed-diff.mjs";

const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) =>
    rm(directory, { force: true, recursive: true })
  ));
});

describe("check-committed-diff", () => {
  it("空値とzero commitを未指定として扱う", () => {
    expect(normalizeCommit("")).toBeNull();
    expect(normalizeCommit("0".repeat(40))).toBeNull();
    expect(normalizeCommit(" abc123 ")).toBe("abc123");
  });

  it("指定したcommit範囲の空白エラーを検出する", async () => {
    const repository = await createRepository();
    const base = await commitFile(repository, "example.txt", "valid\n", "base");
    const head = await commitFile(repository, "example.txt", "invalid trailing space \n", "head");

    expect(() => checkCommittedDiff(base, head, { cwd: repository, stdio: "pipe" })).toThrow();
  });

  it("base未指定ではheadの親commitを検査対象にする", async () => {
    const repository = await createRepository();
    await commitFile(repository, "example.txt", "base\n", "base");
    const head = await commitFile(repository, "example.txt", "head\n", "head");

    expect(checkCommittedDiff("", head, { cwd: repository, stdio: "pipe" }).head).toBe(head);
  });
});

async function createRepository() {
  const repository = await mkdtemp(path.join(os.tmpdir(), "relic-committed-diff-"));
  temporaryDirectories.push(repository);
  git(repository, ["init", "--quiet"]);
  git(repository, ["config", "user.name", "Relic Test"]);
  git(repository, ["config", "user.email", "test@example.invalid"]);
  return repository;
}

async function commitFile(repository, fileName, content, message) {
  await writeFile(path.join(repository, fileName), content, "utf8");
  git(repository, ["add", "--", fileName]);
  git(repository, ["commit", "--quiet", "-m", message]);
  return git(repository, ["rev-parse", "HEAD"]).trim();
}

function git(repository, args) {
  return execFileSync("git", args, { cwd: repository, encoding: "utf8" });
}
