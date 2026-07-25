import { execFileSync, spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import {
  assertLocalPublicationState,
  parsePrePushUpdates,
  selectLocalPublicationScript
} from "./check-local-publication.mjs";

const zero = "0".repeat(40);
const temporaryDirectories = [];
const scriptPath = fileURLToPath(new URL("./check-local-publication.mjs", import.meta.url));

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) =>
    rm(directory, { force: true, recursive: true })
  ));
});

describe("check-local-publication", () => {
  it("branch pushには通常のローカル公開検証を選ぶ", () => {
    const updates = parsePrePushUpdates(`refs/heads/main ${"1".repeat(40)} refs/heads/main ${"2".repeat(40)}\n`);
    expect(selectLocalPublicationScript(updates)).toBe("verify:local:push");
  });

  it("tagを含むpushにはローカル配布検証を選ぶ", () => {
    const updates = parsePrePushUpdates([
      `refs/heads/main ${"1".repeat(40)} refs/heads/main ${"2".repeat(40)}`,
      `refs/tags/1.2.3 ${"3".repeat(40)} refs/tags/1.2.3 ${zero}`
    ].join("\n"));
    expect(selectLocalPublicationScript(updates)).toBe("verify:local:release");
  });

  it("削除だけのpushでは公開検証を実行しない", () => {
    const updates = parsePrePushUpdates(`(delete) ${zero} refs/heads/old ${"2".repeat(40)}\n`);
    expect(selectLocalPublicationScript(updates)).toBeNull();
  });

  it("不正なpre-push入力を拒否する", () => {
    expect(() => parsePrePushUpdates("refs/heads/main only-two-fields")).toThrow(
      "Invalid pre-push update"
    );
  });

  it("cleanなHEADを指すbranchとannotated tagを許可する", async () => {
    const repository = await createRepository();
    const head = commitFile(repository, "tracked.txt", "safe\n", "safe");
    git(repository, ["tag", "-a", "1.2.3", "-m", "release"]);
    const tag = git(repository, ["rev-parse", "refs/tags/1.2.3"]).trim();
    const updates = [
      {
        localRef: "refs/heads/main",
        localSha: head,
        remoteRef: "refs/heads/main",
        remoteSha: zero
      },
      {
        localRef: "refs/tags/1.2.3",
        localSha: tag,
        remoteRef: "refs/tags/1.2.3",
        remoteSha: zero
      }
    ];

    expect(() => assertLocalPublicationState(updates, { cwd: repository })).not.toThrow();
  });

  it("未コミット差分がある作業ツリーを拒否する", async () => {
    const repository = await createRepository();
    const head = commitFile(repository, "tracked.txt", "safe\n", "safe");
    await writeFile(path.join(repository, "untracked.txt"), "not checked\n", "utf8");

    expect(() => assertLocalPublicationState([branchUpdate(head)], { cwd: repository })).toThrow(
      "clean working tree"
    );
  });

  it("現在のHEAD以外を指すrefを拒否する", async () => {
    const repository = await createRepository();
    const oldCommit = commitFile(repository, "tracked.txt", "old\n", "old");
    commitFile(repository, "tracked.txt", "new\n", "new");

    expect(() => assertLocalPublicationState([branchUpdate(oldCommit)], { cwd: repository })).toThrow(
      "checked-out HEAD"
    );
  });

  it("pre-pushの標準入力からCLIとして検証scriptを返す", async () => {
    const repository = await createRepository();
    const head = commitFile(repository, "tracked.txt", "safe\n", "safe");
    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: repository,
      encoding: "utf8",
      input: `refs/heads/main ${head} refs/heads/main ${zero}\n`
    });

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe("verify:local:push\n");
  });
});

async function createRepository() {
  const repository = await mkdtemp(path.join(os.tmpdir(), "relic-local-publication-"));
  temporaryDirectories.push(repository);
  git(repository, ["init", "--quiet"]);
  git(repository, ["config", "user.name", "Relic Test"]);
  git(repository, ["config", "user.email", "test@example.invalid"]);
  return repository;
}

function commitFile(repository, fileName, content, message) {
  writeFileSync(path.join(repository, fileName), content, "utf8");
  git(repository, ["add", "--", fileName]);
  git(repository, ["commit", "--quiet", "-m", message]);
  return git(repository, ["rev-parse", "HEAD"]).trim();
}

function branchUpdate(localSha) {
  return {
    localRef: "refs/heads/main",
    localSha,
    remoteRef: "refs/heads/main",
    remoteSha: zero
  };
}

function git(repository, args) {
  return execFileSync("git", args, { cwd: repository, encoding: "utf8" });
}
