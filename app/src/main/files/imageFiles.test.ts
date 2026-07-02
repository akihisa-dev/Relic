import { mkdir, mkdtemp, readFile, rm, stat, symlink, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { importImageFile, readImageFile } from "./imageFiles";

describe("importImageFile", () => {
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

  it("外部画像を指定フォルダへコピーしてワークスペース相対パスを返す", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-image-workspace-"));
    const sourceFolder = await mkdtemp(path.join(os.tmpdir(), "relic-image-source-"));
    temporaryPaths.push(workspacePath, sourceFolder);
    await mkdir(path.join(workspacePath, "notes"));
    await writeFile(path.join(sourceFolder, "diagram.png"), "png-data");

    const result = await importImageFile(workspacePath, path.join(sourceFolder, "diagram.png"), "notes");

    expect(result).toEqual({ ok: true, value: { path: "notes/diagram.png" } });
    await expect(readFile(path.join(workspacePath, "notes", "diagram.png"), "utf8")).resolves.toBe("png-data");
  });

  it("追加先に同名画像がある場合はコピー名で保存する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-image-workspace-"));
    const sourceFolder = await mkdtemp(path.join(os.tmpdir(), "relic-image-source-"));
    temporaryPaths.push(workspacePath, sourceFolder);
    await writeFile(path.join(workspacePath, "diagram.png"), "existing");
    await writeFile(path.join(sourceFolder, "diagram.png"), "new");

    const result = await importImageFile(workspacePath, path.join(sourceFolder, "diagram.png"), "");

    expect(result).toEqual({ ok: true, value: { path: "diagram のコピー.png" } });
    await expect(readFile(path.join(workspacePath, "diagram のコピー.png"), "utf8")).resolves.toBe("new");
  });

  it("ワークスペース内の既存画像はコピーせず相対パスだけ返す", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-image-workspace-"));
    temporaryPaths.push(workspacePath);
    await mkdir(path.join(workspacePath, "assets"));
    await writeFile(path.join(workspacePath, "assets", "diagram.png"), "png-data");

    const result = await importImageFile(workspacePath, path.join(workspacePath, "assets", "diagram.png"), "");

    expect(result).toEqual({ ok: true, value: { path: "assets/diagram.png" } });
  });

  it("未対応形式は取り込まない", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-image-workspace-"));
    const sourceFolder = await mkdtemp(path.join(os.tmpdir(), "relic-image-source-"));
    temporaryPaths.push(workspacePath, sourceFolder);
    await writeFile(path.join(sourceFolder, "note.txt"), "text");

    const result = await importImageFile(workspacePath, path.join(sourceFolder, "note.txt"), "");

    expect(result).toMatchObject({
      error: { code: "IMAGE_IMPORT_TYPE_UNSUPPORTED" },
      ok: false
    });
  });
});

describe("readImageFile", () => {
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

  it("ワークスペース内の対応画像をdata URLとして返す", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-image-workspace-"));
    temporaryPaths.push(workspacePath);
    await mkdir(path.join(workspacePath, "assets"));
    await writeFile(path.join(workspacePath, "assets", "diagram.png"), "png-data");

    const result = await readImageFile(workspacePath, "assets/diagram.png");

    expect(result).toEqual({
      ok: true,
      value: { dataUrl: `data:image/png;base64,${Buffer.from("png-data").toString("base64")}` }
    });
  });

  it("ワークスペース外参照は読まない", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-image-workspace-"));
    temporaryPaths.push(workspacePath);

    const result = await readImageFile(workspacePath, "../outside.png");

    expect(result).toMatchObject({
      error: { code: "WORKSPACE_PATH_OUTSIDE" },
      ok: false
    });
  });

  it("読み取り直前にワークスペース外へ差し替えられた画像は読まない", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-image-workspace-"));
    const outsidePath = await mkdtemp(path.join(os.tmpdir(), "relic-image-outside-"));
    temporaryPaths.push(workspacePath, outsidePath);
    const imagePath = path.join(workspacePath, "diagram.png");
    const outsideImagePath = path.join(outsidePath, "outside.png");
    await writeFile(imagePath, "png-data");
    await writeFile(outsideImagePath, "outside");

    const swapToOutsideAfterStat = (async (targetPath) => {
        const fileStat = await stat(targetPath);
        await unlink(targetPath);
        await symlink(outsideImagePath, targetPath);
        return fileStat;
      }) as typeof stat;

    const result = await readImageFile(workspacePath, "diagram.png", {
      stat: swapToOutsideAfterStat
    });

    expect(result).toMatchObject({
      error: { code: "WORKSPACE_PATH_OUTSIDE" },
      ok: false
    });
  });

  it("未対応形式は表示しない", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-image-workspace-"));
    temporaryPaths.push(workspacePath);
    await writeFile(path.join(workspacePath, "note.txt"), "text");

    const result = await readImageFile(workspacePath, "note.txt");

    expect(result).toMatchObject({
      error: { code: "IMAGE_READ_TYPE_UNSUPPORTED" },
      ok: false
    });
  });
});
