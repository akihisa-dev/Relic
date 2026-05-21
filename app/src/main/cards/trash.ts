import { stat } from "node:fs/promises";
import path from "node:path";

import { fail, ok, type RelicResult } from "../../shared/result";
import { resolveCardbookRelativePath } from "./paths";

export type TrashItem = (absolutePath: string) => Promise<void>;

export async function moveCardbookItemToTrash(
  cardbookPath: string,
  relativePath: string,
  type: "card" | "cardFolder",
  trashItem: TrashItem
): Promise<RelicResult<{ path: string }>> {
  if (type === "card" && path.extname(relativePath) !== ".md") {
    return fail("FILE_TYPE_UNSUPPORTED", "Markdownカードだけをゴミ箱に移動できます。");
  }

  const absolutePath = resolveCardbookRelativePath(cardbookPath, relativePath);

  if (!absolutePath.ok) {
    return absolutePath;
  }

  try {
    const itemStats = await stat(absolutePath.value);

    if (type === "card" && !itemStats.isFile()) {
      return fail("TRASH_NOT_FILE", "カードだけをゴミ箱に移動できます。");
    }

    if (type === "cardFolder" && !itemStats.isDirectory()) {
      return fail("TRASH_NOT_FOLDER", "カードフォルダだけをゴミ箱に移動できます。");
    }

    await trashItem(absolutePath.value);

    return ok({
      path: relativePath
    });
  } catch (error) {
    return fail(
      "TRASH_MOVE_FAILED",
      "ゴミ箱に移動できませんでした。",
      error instanceof Error ? error.message : String(error)
    );
  }
}
