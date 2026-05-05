import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { initializeGitRepository, readGitStatus } from "./git";

describe("git", () => {
  const temporaryPaths: string[] = [];

  afterEach(async () => {
    await Promise.all(
      temporaryPaths.splice(0).map((temporaryPath) =>
        rm(temporaryPath, {
          force: true,
          recursive: true
        })
      )
    );
  });

  it("未初期化ワークスペースでは initialized=false を返す", async () => {
    const workspacePath = await createWorkspace();

    await expect(readGitStatus(workspacePath)).resolves.toEqual({
      ok: true,
      value: {
        currentBranch: null,
        initialized: false
      }
    });
  });

  it("ワークスペースを Git 初期化できる", async () => {
    const workspacePath = await createWorkspace();

    await expect(initializeGitRepository(workspacePath)).resolves.toEqual({
      ok: true,
      value: {
        currentBranch: "main",
        initialized: true
      }
    });
  });

  it("すでに初期化済みなら再初期化しない", async () => {
    const workspacePath = await createWorkspace();

    await initializeGitRepository(workspacePath);

    await expect(initializeGitRepository(workspacePath)).resolves.toMatchObject({
      ok: false,
      error: { code: "GIT_ALREADY_INITIALIZED" }
    });
  });

  async function createWorkspace(): Promise<string> {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-git-"));
    temporaryPaths.push(workspacePath);

    return workspacePath;
  }
});
