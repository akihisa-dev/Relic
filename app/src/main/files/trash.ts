import { stat } from "node:fs/promises";

import { hasMarkdownExtension } from "../../shared/markdownExtension";
import { fail, ok, type RelicResult } from "../../shared/result";
import { errorDetails } from "./fileSystem";
import { resolveExistingWorkspacePath, verifyExistingWorkspacePath } from "./paths";

export type TrashItem = (absolutePath: string) => Promise<void>;

export async function moveWorkspaceItemToTrash(
  workspacePath: string,
  relativePath: string,
  type: "file" | "folder",
  trashItem: TrashItem
): Promise<RelicResult<{ path: string }>> {
  if (type === "file" && !hasMarkdownExtension(relativePath)) {
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

    const safeTrashPath = await verifyExistingWorkspacePath(workspacePath, absolutePath.value);
    if (!safeTrashPath.ok) return safeTrashPath;

    await trashItem(safeTrashPath.value);

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
