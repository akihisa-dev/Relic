import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createCopyRelativePath } from "./markdownFilePaths";

describe("createCopyRelativePath", () => {
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

  it("コピー名候補が上限まで埋まっている場合は停止する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-copy-path-"));
    temporaryPaths.push(workspacePath);

    await writeFile(path.join(workspacePath, "読書メモ.md"), "original", "utf8");
    await writeFile(path.join(workspacePath, "読書メモ のコピー.md"), "copy", "utf8");
    await writeFile(path.join(workspacePath, "読書メモ のコピー 2.md"), "copy 2", "utf8");

    await expect(createCopyRelativePath(workspacePath, "読書メモ.md", 2)).rejects.toThrow(
      "コピー名の候補が多すぎます。"
    );
  });
});
