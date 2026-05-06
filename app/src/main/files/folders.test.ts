import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createFolder, moveFolder, renameFolder } from "./folders";

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

describe("renameFolder", () => {
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

  it("フォルダ名を変更する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-rename-folder-"));
    temporaryPaths.push(workspacePath);

    await mkdir(path.join(workspacePath, "資料"));
    await writeFile(path.join(workspacePath, "資料", "note.md"), "# Note", "utf8");

    await expect(renameFolder(workspacePath, "資料", "Archive")).resolves.toEqual({
      ok: true,
      value: {
        path: "Archive"
      }
    });
    await expect(readFile(path.join(workspacePath, "Archive", "note.md"), "utf8")).resolves.toBe(
      "# Note"
    );
  });

  it("同名フォルダや同名ファイルがある場合は上書きしない", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-rename-folder-"));
    temporaryPaths.push(workspacePath);

    await mkdir(path.join(workspacePath, "資料"));
    await mkdir(path.join(workspacePath, "Archive"));
    await writeFile(path.join(workspacePath, "既存"), "", "utf8");

    await expect(renameFolder(workspacePath, "資料", "Archive")).resolves.toMatchObject({
      ok: false
    });
    await expect(renameFolder(workspacePath, "資料", "既存")).resolves.toMatchObject({
      ok: false
    });
  });

  it("ワークスペース外への参照とフォルダ以外を拒否する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-rename-folder-"));
    temporaryPaths.push(workspacePath);

    await writeFile(path.join(workspacePath, "note.md"), "", "utf8");

    await expect(renameFolder(workspacePath, "../outside", "inside")).resolves.toMatchObject({
      ok: false
    });
    await expect(renameFolder(workspacePath, "note.md", "note2")).resolves.toMatchObject({
      ok: false
    });
  });
});

describe("moveFolder", () => {
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

  it("フォルダを別フォルダへ移動する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-move-folder-"));
    temporaryPaths.push(workspacePath);

    await mkdir(path.join(workspacePath, "資料"));
    await mkdir(path.join(workspacePath, "archive"));
    await writeFile(path.join(workspacePath, "資料", "note.md"), "# Note", "utf8");

    await expect(moveFolder(workspacePath, "資料", "archive")).resolves.toEqual({
      ok: true,
      value: {
        path: "archive/資料"
      }
    });
    expect((await stat(path.join(workspacePath, "archive", "資料"))).isDirectory()).toBe(true);
    await expect(readFile(path.join(workspacePath, "archive", "資料", "note.md"), "utf8")).resolves.toBe("# Note");
  });

  it("移動先に同名フォルダがある場合は上書きしない", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-move-folder-"));
    temporaryPaths.push(workspacePath);

    await mkdir(path.join(workspacePath, "資料"));
    await mkdir(path.join(workspacePath, "archive"));
    await mkdir(path.join(workspacePath, "archive", "資料"));

    await expect(moveFolder(workspacePath, "資料", "archive")).resolves.toMatchObject({
      ok: false
    });
    expect((await stat(path.join(workspacePath, "資料"))).isDirectory()).toBe(true);
    expect((await stat(path.join(workspacePath, "archive", "資料"))).isDirectory()).toBe(true);
  });
});
