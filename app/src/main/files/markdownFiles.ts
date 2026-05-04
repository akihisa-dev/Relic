import { mkdir, rename, stat, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { MarkdownFileContent } from "../../shared/ipc";
import { fail, ok, type RelicResult } from "../../shared/result";
import { validateBaseName } from "./names";
import { resolveWorkspaceRelativePath } from "./paths";

export interface CreatedMarkdownFile {
  path: string;
}

export function normalizeMarkdownFileName(name: string): RelicResult<string> {
  const validatedName = validateBaseName(name, "ファイル名を入力してください。");

  if (!validatedName.ok) {
    return validatedName;
  }

  return ok(
    path.extname(validatedName.value) === ".md" ? validatedName.value : `${validatedName.value}.md`
  );
}

export async function createMarkdownFile(
  workspacePath: string,
  name: string
): Promise<RelicResult<CreatedMarkdownFile>> {
  const normalizedName = normalizeMarkdownFileName(name);

  if (!normalizedName.ok) {
    return normalizedName;
  }

  const absoluteFilePath = path.join(workspacePath, normalizedName.value);

  try {
    await writeFile(absoluteFilePath, "", {
      encoding: "utf8",
      flag: "wx"
    });

    return ok({
      path: normalizedName.value
    });
  } catch (error) {
    if (isFileExistsError(error)) {
      return fail("FILE_ALREADY_EXISTS", "同じ名前のファイルがすでにあります。別名を入力してください。");
    }

    return fail(
      "FILE_CREATE_FAILED",
      "ファイルを作成できませんでした。",
      error instanceof Error ? error.message : String(error)
    );
  }
}

export async function createMarkdownFileAtPath(
  workspacePath: string,
  relativePath: string
): Promise<RelicResult<MarkdownFileContent>> {
  const normalizedRelativePath = toWorkspaceRelativePath(relativePath.replace(/\\/g, "/"));

  if (path.extname(normalizedRelativePath) !== ".md") {
    return fail("FILE_TYPE_UNSUPPORTED", "Markdownファイルだけを作成できます。");
  }

  const normalizedName = normalizeMarkdownFileName(path.basename(normalizedRelativePath));

  if (!normalizedName.ok) {
    return normalizedName;
  }

  if (normalizedName.value !== path.basename(normalizedRelativePath)) {
    return fail("FILE_NAME_INVALID", "Markdownファイル名を指定してください。");
  }

  const absoluteFilePath = resolveWorkspaceRelativePath(workspacePath, normalizedRelativePath);

  if (!absoluteFilePath.ok) {
    return absoluteFilePath;
  }

  try {
    await mkdir(path.dirname(absoluteFilePath.value), { recursive: true });
    await writeFile(absoluteFilePath.value, "", {
      encoding: "utf8",
      flag: "wx"
    });

    return readMarkdownFile(workspacePath, normalizedRelativePath);
  } catch (error) {
    if (isFileExistsError(error)) {
      return fail("FILE_ALREADY_EXISTS", "同じ名前のファイルがすでにあります。");
    }

    return fail(
      "FILE_CREATE_FAILED",
      "ファイルを作成できませんでした。",
      error instanceof Error ? error.message : String(error)
    );
  }
}

export async function readMarkdownFile(
  workspacePath: string,
  relativePath: string
): Promise<RelicResult<MarkdownFileContent>> {
  if (path.extname(relativePath) !== ".md") {
    return fail("FILE_TYPE_UNSUPPORTED", "Markdownファイルだけを開けます。");
  }

  const absoluteFilePath = resolveWorkspaceRelativePath(workspacePath, relativePath);

  if (!absoluteFilePath.ok) {
    return absoluteFilePath;
  }

  try {
    const content = await readFile(absoluteFilePath.value, "utf8");

    return ok({
      content,
      name: path.basename(relativePath, ".md"),
      path: relativePath
    });
  } catch (error) {
    return fail(
      "FILE_READ_FAILED",
      "ファイルを読み込めませんでした。",
      error instanceof Error ? error.message : String(error)
    );
  }
}

export async function renameMarkdownFile(
  workspacePath: string,
  relativePath: string,
  newName: string
): Promise<RelicResult<MarkdownFileContent>> {
  if (path.extname(relativePath) !== ".md") {
    return fail("FILE_TYPE_UNSUPPORTED", "Markdownファイルだけをリネームできます。");
  }

  const absoluteSourcePath = resolveWorkspaceRelativePath(workspacePath, relativePath);

  if (!absoluteSourcePath.ok) {
    return absoluteSourcePath;
  }

  const normalizedNewName = normalizeMarkdownFileName(newName);

  if (!normalizedNewName.ok) {
    return normalizedNewName;
  }

  const nextRelativePath = toWorkspaceRelativePath(
    path.join(path.dirname(relativePath), normalizedNewName.value)
  );
  const absoluteDestinationPath = resolveWorkspaceRelativePath(workspacePath, nextRelativePath);

  if (!absoluteDestinationPath.ok) {
    return absoluteDestinationPath;
  }

  if (absoluteSourcePath.value === absoluteDestinationPath.value) {
    return readMarkdownFile(workspacePath, relativePath);
  }

  if (await pathExists(absoluteDestinationPath.value)) {
    return fail("FILE_ALREADY_EXISTS", "同じ名前のファイルがすでにあります。別名を入力してください。");
  }

  try {
    await rename(absoluteSourcePath.value, absoluteDestinationPath.value);

    return readMarkdownFile(workspacePath, nextRelativePath);
  } catch (error) {
    return fail(
      "FILE_RENAME_FAILED",
      "ファイル名を変更できませんでした。",
      error instanceof Error ? error.message : String(error)
    );
  }
}

export async function duplicateMarkdownFile(
  workspacePath: string,
  relativePath: string
): Promise<RelicResult<MarkdownFileContent>> {
  if (path.extname(relativePath) !== ".md") {
    return fail("FILE_TYPE_UNSUPPORTED", "Markdownファイルだけを複製できます。");
  }

  const sourcePath = resolveWorkspaceRelativePath(workspacePath, relativePath);

  if (!sourcePath.ok) {
    return sourcePath;
  }

  try {
    const content = await readFile(sourcePath.value, "utf8");
    const destinationRelativePath = await createCopyRelativePath(workspacePath, relativePath);
    const destinationPath = resolveWorkspaceRelativePath(workspacePath, destinationRelativePath);

    if (!destinationPath.ok) {
      return destinationPath;
    }

    await writeFile(destinationPath.value, content, {
      encoding: "utf8",
      flag: "wx"
    });

    return readMarkdownFile(workspacePath, destinationRelativePath);
  } catch (error) {
    return fail(
      "FILE_DUPLICATE_FAILED",
      "ファイルを複製できませんでした。",
      error instanceof Error ? error.message : String(error)
    );
  }
}

function isFileExistsError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "EEXIST"
  );
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    return !isMissingFileError(error);
  }
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "ENOENT"
  );
}

function toWorkspaceRelativePath(filePath: string): string {
  return filePath.split(path.sep).join("/");
}

async function createCopyRelativePath(
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
