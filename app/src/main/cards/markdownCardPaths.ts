import path from "node:path";

import { ok, type RelicResult } from "../../shared/result";
import { validateBaseName } from "./names";
import { resolveCardbookRelativePath, toCardbookRelativePath } from "./paths";
import { pathExists } from "./fsState";

export function normalizeMarkdownCardName(name: string): RelicResult<string> {
  const validatedName = validateBaseName(name, "カード名を入力してください。");

  if (!validatedName.ok) {
    return validatedName;
  }

  return ok(
    path.extname(validatedName.value) === ".md" ? validatedName.value : `${validatedName.value}.md`
  );
}

export function markdownPathInCardFolder(relativePath: string, destinationCardFolder: string): string {
  const normalizedDestCardFolder = toCardbookRelativePath(destinationCardFolder.trim());
  const baseName = path.basename(relativePath);
  return toCardbookRelativePath(
    normalizedDestCardFolder === "" ? baseName : `${normalizedDestCardFolder}/${baseName}`
  );
}

export function renamedMarkdownPath(relativePath: string, newName: string): RelicResult<string> {
  const normalizedNewName = normalizeMarkdownCardName(newName);

  if (!normalizedNewName.ok) {
    return normalizedNewName;
  }

  return ok(toCardbookRelativePath(
    path.join(path.dirname(relativePath), normalizedNewName.value)
  ));
}

export async function createCopyRelativePath(
  cardbookPath: string,
  sourceRelativePath: string
): Promise<string> {
  const directory = path.dirname(sourceRelativePath);
  const extension = path.extname(sourceRelativePath);
  const baseName = path.basename(sourceRelativePath, extension);
  let copyIndex = 1;

  while (true) {
    const copyName =
      copyIndex === 1 ? `${baseName} のコピー${extension}` : `${baseName} のコピー ${copyIndex}${extension}`;
    const candidateRelativePath = toCardbookRelativePath(path.join(directory, copyName));
    const candidatePath = resolveCardbookRelativePath(cardbookPath, candidateRelativePath);

    if (!candidatePath.ok) {
      throw new Error(candidatePath.error.message);
    }

    if (!(await pathExists(candidatePath.value))) {
      return candidateRelativePath;
    }

    copyIndex += 1;
  }
}
