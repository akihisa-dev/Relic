import { mkdir, rename, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { MarkdownCardContent } from "../../shared/ipc";
import { fail, ok, type RelicResult } from "../../shared/result";
import { errorDetails, isCardExistsError, pathExists } from "./fsState";
import { updateLinksForCardRename } from "./linkUpdater";
import {
  createCopyRelativePath,
  markdownPathInCardFolder,
  normalizeMarkdownCardName,
  renamedMarkdownPath
} from "./markdownCardPaths";
import { resolveCardbookRelativePath, toCardbookRelativePath } from "./paths";

export interface CreatedMarkdownCard {
  path: string;
}

export { normalizeMarkdownCardName } from "./markdownCardPaths";

export async function createMarkdownCard(
  cardbookPath: string,
  name: string
): Promise<RelicResult<CreatedMarkdownCard>> {
  const normalizedName = normalizeMarkdownCardName(name);

  if (!normalizedName.ok) {
    return normalizedName;
  }

  const absoluteCardPath = path.join(cardbookPath, normalizedName.value);

  try {
    await writeFile(absoluteCardPath, "", {
      encoding: "utf8",
      flag: "wx"
    });

    return ok({
      path: normalizedName.value
    });
  } catch (error) {
    if (isCardExistsError(error)) {
      return fail("FILE_ALREADY_EXISTS", "同じ名前のカードがすでにあります。別名を入力してください。");
    }

    return fail(
      "FILE_CREATE_FAILED",
      "カードを作成できませんでした。",
      errorDetails(error)
    );
  }
}

export async function createMarkdownCardAtPath(
  cardbookPath: string,
  relativePath: string
): Promise<RelicResult<MarkdownCardContent>> {
  const normalizedRelativePath = toCardbookRelativePath(relativePath.replace(/\\/g, "/"));

  if (path.extname(normalizedRelativePath) !== ".md") {
    return fail("FILE_TYPE_UNSUPPORTED", "Markdownカードだけを作成できます。");
  }

  const normalizedName = normalizeMarkdownCardName(path.basename(normalizedRelativePath));

  if (!normalizedName.ok) {
    return normalizedName;
  }

  if (normalizedName.value !== path.basename(normalizedRelativePath)) {
    return fail("FILE_NAME_INVALID", "Markdownカード名を指定してください。");
  }

  const absoluteCardPath = resolveCardbookRelativePath(cardbookPath, normalizedRelativePath);

  if (!absoluteCardPath.ok) {
    return absoluteCardPath;
  }

  try {
    await mkdir(path.dirname(absoluteCardPath.value), { recursive: true });
    await writeFile(absoluteCardPath.value, "", {
      encoding: "utf8",
      flag: "wx"
    });

    return readMarkdownCard(cardbookPath, normalizedRelativePath);
  } catch (error) {
    if (isCardExistsError(error)) {
      return fail("FILE_ALREADY_EXISTS", "同じ名前のカードがすでにあります。");
    }

    return fail(
      "FILE_CREATE_FAILED",
      "カードを作成できませんでした。",
      errorDetails(error)
    );
  }
}

export async function readMarkdownCard(
  cardbookPath: string,
  relativePath: string
): Promise<RelicResult<MarkdownCardContent>> {
  if (path.extname(relativePath) !== ".md") {
    return fail("FILE_TYPE_UNSUPPORTED", "Markdownカードだけを開けます。");
  }

  const absoluteCardPath = resolveCardbookRelativePath(cardbookPath, relativePath);

  if (!absoluteCardPath.ok) {
    return absoluteCardPath;
  }

  try {
    const content = await readFile(absoluteCardPath.value, "utf8");

    return ok({
      content,
      name: path.basename(relativePath, ".md"),
      path: relativePath
    });
  } catch (error) {
    return fail(
      "FILE_READ_FAILED",
      "カードを読み込めませんでした。",
      errorDetails(error)
    );
  }
}

export async function renameMarkdownCard(
  cardbookPath: string,
  relativePath: string,
  newName: string
): Promise<RelicResult<MarkdownCardContent>> {
  if (path.extname(relativePath) !== ".md") {
    return fail("FILE_TYPE_UNSUPPORTED", "Markdownカードだけをリネームできます。");
  }

  const absoluteSourcePath = resolveCardbookRelativePath(cardbookPath, relativePath);

  if (!absoluteSourcePath.ok) {
    return absoluteSourcePath;
  }

  const nextRelativePath = renamedMarkdownPath(relativePath, newName);

  if (!nextRelativePath.ok) {
    return nextRelativePath;
  }

  const absoluteDestinationPath = resolveCardbookRelativePath(cardbookPath, nextRelativePath.value);

  if (!absoluteDestinationPath.ok) {
    return absoluteDestinationPath;
  }

  if (absoluteSourcePath.value === absoluteDestinationPath.value) {
    return readMarkdownCard(cardbookPath, relativePath);
  }

  if (await pathExists(absoluteDestinationPath.value)) {
    return fail("FILE_ALREADY_EXISTS", "同じ名前のカードがすでにあります。別名を入力してください。");
  }

  try {
    await rename(absoluteSourcePath.value, absoluteDestinationPath.value);
    await updateLinksForCardRename(cardbookPath, relativePath, nextRelativePath.value);

    return readMarkdownCard(cardbookPath, nextRelativePath.value);
  } catch (error) {
    return fail(
      "FILE_RENAME_FAILED",
      "カード名を変更できませんでした。",
      errorDetails(error)
    );
  }
}

export async function moveMarkdownCard(
  cardbookPath: string,
  relativePath: string,
  destinationCardFolder: string
): Promise<RelicResult<MarkdownCardContent>> {
  if (path.extname(relativePath) !== ".md") {
    return fail("FILE_TYPE_UNSUPPORTED", "Markdownカードだけを移動できます。");
  }

  const absoluteSourcePath = resolveCardbookRelativePath(cardbookPath, relativePath);

  if (!absoluteSourcePath.ok) {
    return absoluteSourcePath;
  }

  const nextRelativePath = markdownPathInCardFolder(relativePath, destinationCardFolder);

  if (nextRelativePath === relativePath) {
    return readMarkdownCard(cardbookPath, relativePath);
  }

  const absoluteDestinationPath = resolveCardbookRelativePath(cardbookPath, nextRelativePath);

  if (!absoluteDestinationPath.ok) {
    return absoluteDestinationPath;
  }

  if (await pathExists(absoluteDestinationPath.value)) {
    return fail("FILE_ALREADY_EXISTS", "移動先に同じ名前のカードがすでにあります。");
  }

  try {
    await rename(absoluteSourcePath.value, absoluteDestinationPath.value);
    await updateLinksForCardRename(cardbookPath, relativePath, nextRelativePath);

    return readMarkdownCard(cardbookPath, nextRelativePath);
  } catch (error) {
    return fail(
      "FILE_MOVE_FAILED",
      "カードを移動できませんでした。",
      errorDetails(error)
    );
  }
}

export async function duplicateMarkdownCard(
  cardbookPath: string,
  relativePath: string
): Promise<RelicResult<MarkdownCardContent>> {
  if (path.extname(relativePath) !== ".md") {
    return fail("FILE_TYPE_UNSUPPORTED", "Markdownカードだけを複製できます。");
  }

  const sourcePath = resolveCardbookRelativePath(cardbookPath, relativePath);

  if (!sourcePath.ok) {
    return sourcePath;
  }

  try {
    const content = await readFile(sourcePath.value, "utf8");
    const destinationRelativePath = await createCopyRelativePath(cardbookPath, relativePath);
    const destinationPath = resolveCardbookRelativePath(cardbookPath, destinationRelativePath);

    if (!destinationPath.ok) {
      return destinationPath;
    }

    await writeFile(destinationPath.value, content, {
      encoding: "utf8",
      flag: "wx"
    });

    return readMarkdownCard(cardbookPath, destinationRelativePath);
  } catch (error) {
    return fail(
      "FILE_DUPLICATE_FAILED",
      "カードを複製できませんでした。",
      errorDetails(error)
    );
  }
}
