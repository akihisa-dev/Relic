import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { moveCardbookItemToTrash } from "./trash";

describe("moveCardbookItemToTrash", () => {
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

  it("Markdownカードをゴミ箱へ移動する境界を呼び出す", async () => {
    const cardbookPath = await mkdtemp(path.join(os.tmpdir(), "relic-trash-"));
    temporaryPaths.push(cardbookPath);
    const trashItem = vi.fn().mockResolvedValue(undefined);

    await writeFile(path.join(cardbookPath, "note.md"), "# Note", "utf8");

    await expect(
      moveCardbookItemToTrash(cardbookPath, "note.md", "card", trashItem)
    ).resolves.toEqual({
      ok: true,
      value: {
        path: "note.md"
      }
    });
    expect(trashItem).toHaveBeenCalledWith(path.join(cardbookPath, "note.md"));
  });

  it("カードフォルダをゴミ箱へ移動する境界を呼び出す", async () => {
    const cardbookPath = await mkdtemp(path.join(os.tmpdir(), "relic-trash-"));
    temporaryPaths.push(cardbookPath);
    const trashItem = vi.fn().mockResolvedValue(undefined);

    await mkdir(path.join(cardbookPath, "資料"));

    await expect(moveCardbookItemToTrash(cardbookPath, "資料", "cardFolder", trashItem)).resolves.toEqual({
      ok: true,
      value: {
        path: "資料"
      }
    });
    expect(trashItem).toHaveBeenCalledWith(path.join(cardbookPath, "資料"));
  });

  it("カードブック外・Markdown以外・種別違いを拒否する", async () => {
    const cardbookPath = await mkdtemp(path.join(os.tmpdir(), "relic-trash-"));
    temporaryPaths.push(cardbookPath);
    const trashItem = vi.fn().mockResolvedValue(undefined);

    await writeFile(path.join(cardbookPath, "image.png"), "", "utf8");
    await writeFile(path.join(cardbookPath, "note.md"), "", "utf8");

    await expect(
      moveCardbookItemToTrash(cardbookPath, "../outside.md", "card", trashItem)
    ).resolves.toMatchObject({ ok: false });
    await expect(
      moveCardbookItemToTrash(cardbookPath, "image.png", "card", trashItem)
    ).resolves.toMatchObject({ ok: false });
    await expect(
      moveCardbookItemToTrash(cardbookPath, "note.md", "cardFolder", trashItem)
    ).resolves.toMatchObject({ ok: false });
    expect(trashItem).not.toHaveBeenCalled();
  });
});
