import path from "node:path";

import { ok, type RelicResult } from "../../shared/result";
import { validateBaseName } from "./names";
import { resolveWorkspaceRelativePath, toWorkspaceRelativePath } from "./paths";
import { pathExists } from "./fileSystem";

export function normalizeMarkdownFileName(name: string): RelicResult<string> {
  const validatedName = validateBaseName(name, "カード名を入力してください。");

  if (!validatedName.ok) {
    return validatedName;
  }

  return ok(
    path.extname(validatedName.value) === ".md" ? validatedName.value : `${validatedName.value}.md`
  );
}

export function markdownPathInFolder(relativePath: string, destinationFolder: string): string {
  const normalizedDestFolder = toWorkspaceRelativePath(destinationFolder.trim());
  const baseName = path.basename(relativePath);
  return toWorkspaceRelativePath(
    normalizedDestFolder === "" ? baseName : `${normalizedDestFolder}/${baseName}`
  );
}

export function renamedMarkdownPath(relativePath: string, newName: string): RelicResult<string> {
  const normalizedNewName = normalizeMarkdownFileName(newName);

  if (!normalizedNewName.ok) {
    return normalizedNewName;
  }

  return ok(toWorkspaceRelativePath(
    path.join(path.dirname(relativePath), normalizedNewName.value)
  ));
}

export async function createCopyRelativePath(
  workspacePath: string,
  sourceRelativePath: string
): Promise<string> {
  const directory = path.dirname(sourceRelativePath);
  const extension = path.extname(sourceRelativePath);
  const baseName = path.basename(sourceRelativePath, extension);
  let copyIndex = 1;

  while (true) {
    const copyName =
      copyIndex === 1 ? `${baseName} のコピー${extension}` : `${baseName} のコピー ${copyIndex}${extension}`;
    const candidateRelativePath = toWorkspaceRelativePath(path.join(directory, copyName));
    const candidatePath = resolveWorkspaceRelativePath(workspacePath, candidateRelativePath);

    if (!candidatePath.ok) {
      throw new Error(candidatePath.error.message);
    }

    if (!(await pathExists(candidatePath.value))) {
      return candidateRelativePath;
    }

    copyIndex += 1;
  }
}
