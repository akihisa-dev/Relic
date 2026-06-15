import { stat } from "node:fs/promises";
import path from "node:path";

import { fail, ok, type RelicResult } from "../../shared/result";
import { errorDetails } from "./fileSystem";
import { resolveExistingWorkspacePath } from "./paths";

export type TrashItem = (absolutePath: string) => Promise<void>;

export async function moveWorkspaceItemToTrash(
  workspacePath: string,
  relativePath: string,
  type: "file" | "folder",
  trashItem: TrashItem
): Promise<RelicResult<{ path: string }>> {
  if (type === "file" && path.extname(relativePath) !== ".md") {
    return fail("FILE_TYPE_UNSUPPORTED", "Markdownファイルだけをゴミ箱に移動できます。");
  }

  const absolutePath = await resolveExistingWorkspacePath(workspacePath, relativePath);

  if (!absolutePath.ok) {
    return absolutePath;
  }

  try {
    const itemStats = await stat(absolutePath.value);

    if (type === "file" && !itemStats.isFile()) {
      return fail("TRASH_NOT_FILE", "ファイルだけをゴミ箱に移動できます。");
    }

    if (type === "folder" && !itemStats.isDirectory()) {
      return fail("TRASH_NOT_FOLDER", "フォルダだけをゴミ箱に移動できます。");
    }

    await trashItem(absolutePath.value);

    return ok({
      path: relativePath
    });
  } catch (error) {
    return fail(
      "TRASH_MOVE_FAILED",
      "ゴミ箱に移動できませんでした。",
      errorDetails(error)
    );
  }
}
