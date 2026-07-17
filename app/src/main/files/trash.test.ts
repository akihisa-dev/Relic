import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { moveWorkspaceItemToTrash } from "./trash";

describe("moveWorkspaceItemToTrash", () => {
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

  it("Markdownファイルをゴミ箱へ移動する境界を呼び出す", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-trash-"));
    temporaryPaths.push(workspacePath);
    const trashItem = vi.fn().mockResolvedValue(undefined);

    await writeFile(path.join(workspacePath, "note.md"), "# Note", "utf8");

    await expect(
      moveWorkspaceItemToTrash(workspacePath, "note.md", "file", trashItem)
    ).resolves.toEqual({
      ok: true,
      value: {
        path: "note.md"
      }
    });
    expect(trashItem).toHaveBeenCalledWith(path.join(workspacePath, "note.md"));
  });

  it("フォルダをゴミ箱へ移動する境界を呼び出す", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-trash-"));
    temporaryPaths.push(workspacePath);
    const trashItem = vi.fn().mockResolvedValue(undefined);

    await mkdir(path.join(workspacePath, "資料"));

    await expect(moveWorkspaceItemToTrash(workspacePath, "資料", "folder", trashItem)).resolves.toEqual({
      ok: true,
      value: {
        path: "資料"
      }
    });
    expect(trashItem).toHaveBeenCalledWith(path.join(workspacePath, "資料"));
  });

  it.each(["image.png", "document.pdf"])("%s をゴミ箱へ移動する境界を呼び出す", async (fileName) => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-trash-"));
    temporaryPaths.push(workspacePath);
    const trashItem = vi.fn().mockResolvedValue(undefined);

    await writeFile(path.join(workspacePath, fileName), "", "utf8");

    await expect(moveWorkspaceItemToTrash(workspacePath, fileName, "file", trashItem)).resolves.toEqual({
      ok: true,
      value: { path: fileName }
    });
    expect(trashItem).toHaveBeenCalledWith(path.join(workspacePath, fileName));
  });

  it("ワークスペース外・未対応ファイル・種別違いを拒否する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-trash-"));
    temporaryPaths.push(workspacePath);
    const trashItem = vi.fn().mockResolvedValue(undefined);

    await writeFile(path.join(workspacePath, "archive.zip"), "", "utf8");
    await writeFile(path.join(workspacePath, "note.md"), "", "utf8");

    await expect(
      moveWorkspaceItemToTrash(workspacePath, "../outside.md", "file", trashItem)
    ).resolves.toMatchObject({ ok: false });
    await expect(
      moveWorkspaceItemToTrash(workspacePath, "archive.zip", "file", trashItem)
    ).resolves.toMatchObject({ ok: false });
    await expect(
      moveWorkspaceItemToTrash(workspacePath, "note.md", "folder", trashItem)
    ).resolves.toMatchObject({ ok: false });
    expect(trashItem).not.toHaveBeenCalled();
  });

  it("シンボリックリンク経由で実体がワークスペース外の項目はゴミ箱へ移動しない", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-trash-"));
    const outsidePath = await mkdtemp(path.join(os.tmpdir(), "relic-trash-outside-"));
    temporaryPaths.push(workspacePath, outsidePath);
    const trashItem = vi.fn().mockResolvedValue(undefined);

    await mkdir(path.join(outsidePath, "outside-folder"));
    await writeFile(path.join(outsidePath, "outside.md"), "outside", "utf8");
    await symlink(path.join(outsidePath, "outside.md"), path.join(workspacePath, "linked.md"));
    await symlink(path.join(outsidePath, "outside-folder"), path.join(workspacePath, "linked-folder"), "dir");

    await expect(
      moveWorkspaceItemToTrash(workspacePath, "linked.md", "file", trashItem)
    ).resolves.toMatchObject({
      error: { code: "WORKSPACE_PATH_OUTSIDE" },
      ok: false
    });
    await expect(
      moveWorkspaceItemToTrash(workspacePath, "linked-folder", "folder", trashItem)
    ).resolves.toMatchObject({
      error: { code: "WORKSPACE_PATH_OUTSIDE" },
      ok: false
    });
    expect(trashItem).not.toHaveBeenCalled();
  });
});
