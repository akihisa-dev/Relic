import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createFolder } from "./folders";

describe("createFolder", () => {
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

  it("フォルダを作成する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-create-folder-"));
    temporaryPaths.push(workspacePath);

    await expect(createFolder(workspacePath, "資料")).resolves.toEqual({
      ok: true,
      value: {
        path: "資料"
      }
    });
    expect((await stat(path.join(workspacePath, "資料"))).isDirectory()).toBe(true);
  });

  it("スラッシュを含むフォルダ名を拒否する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-create-folder-"));
    temporaryPaths.push(workspacePath);

    const result = await createFolder(workspacePath, "資料/下書き");

    expect(result.ok).toBe(false);
  });

  it("同名フォルダや同名ファイルがある場合は作成しない", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-create-folder-"));
    temporaryPaths.push(workspacePath);

    await mkdir(path.join(workspacePath, "資料"));
    await writeFile(path.join(workspacePath, "下書き"), "", "utf8");

    await expect(createFolder(workspacePath, "資料")).resolves.toMatchObject({ ok: false });
    await expect(createFolder(workspacePath, "下書き")).resolves.toMatchObject({ ok: false });
  });
});
