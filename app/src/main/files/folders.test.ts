import { mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
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

  it("Windows予約名や末尾ドットを含むフォルダ名を拒否する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-create-folder-"));
    temporaryPaths.push(workspacePath);

    await expect(createFolder(workspacePath, "AUX")).resolves.toMatchObject({
      error: { code: "FILE_NAME_INVALID" },
      ok: false
    });
    await expect(createFolder(workspacePath, "note.")).resolves.toMatchObject({
      error: { code: "FILE_NAME_INVALID" },
      ok: false
    });
  });

  it("親フォルダを指定して配下にフォルダを作成する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-create-folder-"));
    temporaryPaths.push(workspacePath);

    await mkdir(path.join(workspacePath, "資料"));

    await expect(createFolder(workspacePath, "下書き", "資料")).resolves.toEqual({
      ok: true,
      value: {
        path: "資料/下書き"
      }
    });
    expect((await stat(path.join(workspacePath, "資料", "下書き"))).isDirectory()).toBe(true);
  });

  it("親フォルダがワークスペース外を指す場合は作成しない", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-create-folder-"));
    temporaryPaths.push(workspacePath);

    await expect(createFolder(workspacePath, "下書き", "../outside")).resolves.toMatchObject({
      ok: false
    });
  });

  it("親フォルダの実体がワークスペース外のシンボリックリンクの場合は作成しない", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-create-folder-"));
    const outsidePath = await mkdtemp(path.join(os.tmpdir(), "relic-create-folder-outside-"));
    temporaryPaths.push(workspacePath, outsidePath);

    await symlink(outsidePath, path.join(workspacePath, "linked-out"), "dir");

    await expect(createFolder(workspacePath, "下書き", "linked-out")).resolves.toMatchObject({
      error: { code: "WORKSPACE_PATH_OUTSIDE" },
      ok: false
    });
    await expect(readFile(path.join(outsidePath, "下書き"), "utf8")).rejects.toMatchObject({
      code: "ENOENT"
    });
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

  it("フォルダリネーム時に配下ファイルへのパス付き内部リンクも更新する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-rename-folder-"));
    temporaryPaths.push(workspacePath);

    await mkdir(path.join(workspacePath, "資料"));
    await writeFile(path.join(workspacePath, "資料", "note.md"), "# Note", "utf8");
    await writeFile(path.join(workspacePath, "source.md"), "[[資料/note]]", "utf8");

    await expect(renameFolder(workspacePath, "資料", "Archive")).resolves.toMatchObject({
      ok: true
    });
    await expect(readFile(path.join(workspacePath, "source.md"), "utf8")).resolves.toBe(
      "[[Archive/note]]"
    );
  });

  it("大文字小文字だけのフォルダ名変更を完了する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-rename-folder-"));
    temporaryPaths.push(workspacePath);

    await mkdir(path.join(workspacePath, "Folder"));
    await writeFile(path.join(workspacePath, "Folder", "note.md"), "# Note", "utf8");

    await expect(renameFolder(workspacePath, "Folder", "folder")).resolves.toEqual({
      ok: true,
      value: {
        path: "folder"
      }
    });
    await expect(readFile(path.join(workspacePath, "folder", "note.md"), "utf8")).resolves.toBe("# Note");
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

  it("実体がワークスペース外のシンボリックリンクフォルダはリネームしない", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-rename-folder-"));
    const outsidePath = await mkdtemp(path.join(os.tmpdir(), "relic-rename-folder-outside-"));
    temporaryPaths.push(workspacePath, outsidePath);

    await mkdir(path.join(outsidePath, "outside-folder"));
    await symlink(path.join(outsidePath, "outside-folder"), path.join(workspacePath, "linked-folder"), "dir");

    await expect(renameFolder(workspacePath, "linked-folder", "renamed")).resolves.toMatchObject({
      error: { code: "WORKSPACE_PATH_OUTSIDE" },
      ok: false
    });
    expect((await stat(path.join(outsidePath, "outside-folder"))).isDirectory()).toBe(true);
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

  it("フォルダ移動時に配下ファイルへのパス付き内部リンクも更新する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-move-folder-"));
    temporaryPaths.push(workspacePath);

    await mkdir(path.join(workspacePath, "資料"));
    await mkdir(path.join(workspacePath, "archive"));
    await writeFile(path.join(workspacePath, "資料", "note.md"), "# Note", "utf8");
    await writeFile(path.join(workspacePath, "source.md"), "[[資料/note]]", "utf8");

    await expect(moveFolder(workspacePath, "資料", "archive")).resolves.toMatchObject({
      ok: true
    });
    await expect(readFile(path.join(workspacePath, "source.md"), "utf8")).resolves.toBe(
      "[[archive/資料/note]]"
    );
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

  it("自分自身または配下フォルダへの移動はファイル操作前に拒否する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-move-folder-"));
    temporaryPaths.push(workspacePath);

    await mkdir(path.join(workspacePath, "資料"));
    await mkdir(path.join(workspacePath, "資料", "child"));

    await expect(moveFolder(workspacePath, "資料", "資料")).resolves.toMatchObject({
      error: { code: "FOLDER_MOVE_DESTINATION_INSIDE_SOURCE" },
      ok: false
    });
    await expect(moveFolder(workspacePath, "資料", "資料/child")).resolves.toMatchObject({
      error: { code: "FOLDER_MOVE_DESTINATION_INSIDE_SOURCE" },
      ok: false
    });
    expect((await stat(path.join(workspacePath, "資料"))).isDirectory()).toBe(true);
    expect((await stat(path.join(workspacePath, "資料", "child"))).isDirectory()).toBe(true);
  });

  it("ワークスペース外の移動先フォルダを拒否する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-move-folder-"));
    temporaryPaths.push(workspacePath);

    await mkdir(path.join(workspacePath, "資料"));

    await expect(moveFolder(workspacePath, "資料", "../outside")).resolves.toMatchObject({
      ok: false
    });
    expect((await stat(path.join(workspacePath, "資料"))).isDirectory()).toBe(true);
  });

  it("移動先の親がワークスペース外を指すシンボリックリンクの場合は移動しない", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-move-folder-"));
    const outsidePath = await mkdtemp(path.join(os.tmpdir(), "relic-move-folder-outside-"));
    temporaryPaths.push(workspacePath, outsidePath);

    await mkdir(path.join(workspacePath, "資料"));
    await symlink(outsidePath, path.join(workspacePath, "linked-out"), "dir");

    await expect(moveFolder(workspacePath, "資料", "linked-out")).resolves.toMatchObject({
      error: { code: "WORKSPACE_PATH_OUTSIDE" },
      ok: false
    });
    expect((await stat(path.join(workspacePath, "資料"))).isDirectory()).toBe(true);
    await expect(stat(path.join(outsidePath, "資料"))).rejects.toMatchObject({
      code: "ENOENT"
    });
  });
});
