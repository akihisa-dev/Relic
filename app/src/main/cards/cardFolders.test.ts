import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createCardFolder, moveCardFolder, renameCardFolder } from "./cardFolders";

describe("createCardFolder", () => {
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

  it("カードフォルダを作成する", async () => {
    const cardbookPath = await mkdtemp(path.join(os.tmpdir(), "relic-create-cardFolder-"));
    temporaryPaths.push(cardbookPath);

    await expect(createCardFolder(cardbookPath, "資料")).resolves.toEqual({
      ok: true,
      value: {
        path: "資料"
      }
    });
    expect((await stat(path.join(cardbookPath, "資料"))).isDirectory()).toBe(true);
  });

  it("スラッシュを含むカードフォルダ名を拒否する", async () => {
    const cardbookPath = await mkdtemp(path.join(os.tmpdir(), "relic-create-cardFolder-"));
    temporaryPaths.push(cardbookPath);

    const result = await createCardFolder(cardbookPath, "資料/下書き");

    expect(result.ok).toBe(false);
  });

  it("親カードフォルダを指定して配下にカードフォルダを作成する", async () => {
    const cardbookPath = await mkdtemp(path.join(os.tmpdir(), "relic-create-cardFolder-"));
    temporaryPaths.push(cardbookPath);

    await mkdir(path.join(cardbookPath, "資料"));

    await expect(createCardFolder(cardbookPath, "下書き", "資料")).resolves.toEqual({
      ok: true,
      value: {
        path: "資料/下書き"
      }
    });
    expect((await stat(path.join(cardbookPath, "資料", "下書き"))).isDirectory()).toBe(true);
  });

  it("親カードフォルダがカードブック外を指す場合は作成しない", async () => {
    const cardbookPath = await mkdtemp(path.join(os.tmpdir(), "relic-create-cardFolder-"));
    temporaryPaths.push(cardbookPath);

    await expect(createCardFolder(cardbookPath, "下書き", "../outside")).resolves.toMatchObject({
      ok: false
    });
  });

  it("同名カードフォルダや同名カードがある場合は作成しない", async () => {
    const cardbookPath = await mkdtemp(path.join(os.tmpdir(), "relic-create-cardFolder-"));
    temporaryPaths.push(cardbookPath);

    await mkdir(path.join(cardbookPath, "資料"));
    await writeFile(path.join(cardbookPath, "下書き"), "", "utf8");

    await expect(createCardFolder(cardbookPath, "資料")).resolves.toMatchObject({ ok: false });
    await expect(createCardFolder(cardbookPath, "下書き")).resolves.toMatchObject({ ok: false });
  });
});

describe("renameCardFolder", () => {
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

  it("カードフォルダ名を変更する", async () => {
    const cardbookPath = await mkdtemp(path.join(os.tmpdir(), "relic-rename-cardFolder-"));
    temporaryPaths.push(cardbookPath);

    await mkdir(path.join(cardbookPath, "資料"));
    await writeFile(path.join(cardbookPath, "資料", "note.md"), "# Note", "utf8");

    await expect(renameCardFolder(cardbookPath, "資料", "Archive")).resolves.toEqual({
      ok: true,
      value: {
        path: "Archive"
      }
    });
    await expect(readFile(path.join(cardbookPath, "Archive", "note.md"), "utf8")).resolves.toBe(
      "# Note"
    );
  });

  it("同名カードフォルダや同名カードがある場合は上書きしない", async () => {
    const cardbookPath = await mkdtemp(path.join(os.tmpdir(), "relic-rename-cardFolder-"));
    temporaryPaths.push(cardbookPath);

    await mkdir(path.join(cardbookPath, "資料"));
    await mkdir(path.join(cardbookPath, "Archive"));
    await writeFile(path.join(cardbookPath, "既存"), "", "utf8");

    await expect(renameCardFolder(cardbookPath, "資料", "Archive")).resolves.toMatchObject({
      ok: false
    });
    await expect(renameCardFolder(cardbookPath, "資料", "既存")).resolves.toMatchObject({
      ok: false
    });
  });

  it("カードブック外への参照とカードフォルダ以外を拒否する", async () => {
    const cardbookPath = await mkdtemp(path.join(os.tmpdir(), "relic-rename-cardFolder-"));
    temporaryPaths.push(cardbookPath);

    await writeFile(path.join(cardbookPath, "note.md"), "", "utf8");

    await expect(renameCardFolder(cardbookPath, "../outside", "inside")).resolves.toMatchObject({
      ok: false
    });
    await expect(renameCardFolder(cardbookPath, "note.md", "note2")).resolves.toMatchObject({
      ok: false
    });
  });
});

describe("moveCardFolder", () => {
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

  it("カードフォルダを別カードフォルダへ移動する", async () => {
    const cardbookPath = await mkdtemp(path.join(os.tmpdir(), "relic-move-cardFolder-"));
    temporaryPaths.push(cardbookPath);

    await mkdir(path.join(cardbookPath, "資料"));
    await mkdir(path.join(cardbookPath, "archive"));
    await writeFile(path.join(cardbookPath, "資料", "note.md"), "# Note", "utf8");

    await expect(moveCardFolder(cardbookPath, "資料", "archive")).resolves.toEqual({
      ok: true,
      value: {
        path: "archive/資料"
      }
    });
    expect((await stat(path.join(cardbookPath, "archive", "資料"))).isDirectory()).toBe(true);
    await expect(readFile(path.join(cardbookPath, "archive", "資料", "note.md"), "utf8")).resolves.toBe("# Note");
  });

  it("移動先に同名カードフォルダがある場合は上書きしない", async () => {
    const cardbookPath = await mkdtemp(path.join(os.tmpdir(), "relic-move-cardFolder-"));
    temporaryPaths.push(cardbookPath);

    await mkdir(path.join(cardbookPath, "資料"));
    await mkdir(path.join(cardbookPath, "archive"));
    await mkdir(path.join(cardbookPath, "archive", "資料"));

    await expect(moveCardFolder(cardbookPath, "資料", "archive")).resolves.toMatchObject({
      ok: false
    });
    expect((await stat(path.join(cardbookPath, "資料"))).isDirectory()).toBe(true);
    expect((await stat(path.join(cardbookPath, "archive", "資料"))).isDirectory()).toBe(true);
  });
});
