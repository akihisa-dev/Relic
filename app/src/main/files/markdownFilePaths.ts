import path from "node:path";

import { ok, type RelicResult } from "../../shared/result";
import { validateBaseName } from "./names";
import { resolveWorkspaceRelativePath, toWorkspaceRelativePath } from "./paths";
import { pathExists } from "./fileSystem";

const DEFAULT_MAX_COPY_NAME_CANDIDATES = 1000;

export function normalizeMarkdownFileName(name: string): RelicResult<string> {
  const validatedName = validateBaseName(name, "ファイル名を入力してください。");

  if (!validatedName.ok) {
    return validatedName;
  }

  return ok(
    path.extname(validatedName.value) === ".md" ? validatedName.value : `${validatedName.value}.md`
  );
}

export function markdownPathInFolder(relativePath: string, destinationFolder: string): string {
  const normalizedDestFolder = toWorkspaceRelativePath(destinationFolder.trim());
  const baseName = path.posix.basename(toWorkspaceRelativePath(relativePath));
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
    path.posix.join(
      path.posix.dirname(toWorkspaceRelativePath(relativePath)),
      normalizedNewName.value
    )
  ));
}

export async function createCopyRelativePath(
  workspacePath: string,
  sourceRelativePath: string,
  maxCandidates = DEFAULT_MAX_COPY_NAME_CANDIDATES
): Promise<string> {
  const normalizedSourcePath = toWorkspaceRelativePath(sourceRelativePath);
  const directory = path.posix.dirname(normalizedSourcePath);
  const extension = path.posix.extname(normalizedSourcePath);
  const baseName = path.posix.basename(normalizedSourcePath, extension);
  let copyIndex = 1;

  while (copyIndex <= maxCandidates) {
    const copyName =
      copyIndex === 1 ? `${baseName} のコピー${extension}` : `${baseName} のコピー ${copyIndex}${extension}`;
    const candidateRelativePath = toWorkspaceRelativePath(path.posix.join(directory, copyName));
    const candidatePath = resolveWorkspaceRelativePath(workspacePath, candidateRelativePath);

    if (!candidatePath.ok) {
      throw new Error(candidatePath.error.message);
    }

    if (!(await pathExists(candidatePath.value))) {
      return candidateRelativePath;
    }

    copyIndex += 1;
  }

  throw new Error("コピー名の候補が多すぎます。");
}
