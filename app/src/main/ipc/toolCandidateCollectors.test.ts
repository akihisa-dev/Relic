import { mkdir, mkdtemp, realpath, readFile, rename, rm, stat, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  collectMergeCandidates,
  collectTitleListFiles,
  readToolCandidateContent,
  type ToolActionFileOperations
} from "./toolCandidateCollectors";

describe("toolCandidateCollectors", () => {
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

  it("本文読み取り中に外部実体へ差し替えられた候補を拒否する", async () => {
    const workspacePath = await createWorkspace("relic-tool-candidate-workspace-");
    const outsidePath = await createWorkspace("relic-tool-candidate-outside-");
    const candidatePath = path.join(workspacePath, "note.md");
    const backupPath = path.join(workspacePath, "note.old.md");
    const outsideCandidatePath = path.join(outsidePath, "note.md");
    await writeFile(candidatePath, "inside", "utf8");
    await writeFile(outsideCandidatePath, "secret", "utf8");

    let swapped = false;
    const operations: ToolActionFileOperations = {
      realpath,
      readFile: async (filePath, encoding) => {
        if (!swapped) {
          swapped = true;
          await rename(candidatePath, backupPath);
          await symlink(outsideCandidatePath, candidatePath);
        }
        return readFile(filePath, encoding);
      },
      stat
    };

    await expect(readToolCandidateContent(
      workspacePath,
      { relPath: "note.md" },
      operations,
      { actualAggregateBytes: 0, statAggregateBytes: 0 }
    )).rejects.toMatchObject({
      code: "WORKSPACE_PATH_OUTSIDE"
    });
    expect(swapped).toBe(true);
  });

  it("候補収集時にワークスペース外の実体を除外する", async () => {
    const workspacePath = await createWorkspace("relic-tool-candidate-workspace-");
    const outsidePath = await createWorkspace("relic-tool-candidate-outside-");
    await writeFile(path.join(outsidePath, "outside.md"), "outside", "utf8");
    await symlink(
      path.join(outsidePath, "outside.md"),
      path.join(workspacePath, "linked.md")
    );

    const nodes = [{
      kind: "markdown" as const,
      name: "linked.md",
      path: "linked.md",
      type: "file" as const
    }];
    const operations: ToolActionFileOperations = { realpath, readFile, stat };

    await expect(collectMergeCandidates(workspacePath, nodes, operations)).resolves.toEqual([]);
    await expect(collectTitleListFiles(workspacePath, nodes, undefined, operations)).resolves.toEqual([]);
  });

  async function createWorkspace(prefix: string): Promise<string> {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), prefix));
    temporaryPaths.push(workspacePath);
    await mkdir(workspacePath, { recursive: true });
    return workspacePath;
  }
});
