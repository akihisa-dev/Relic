import { mkdir } from "node:fs/promises";
import path from "node:path";

import { ensureMarkdownExtension, stripMarkdownExtension } from "../../shared/markdownExtension";
import { fail, ok, type RelicResult } from "../../shared/result";
import { atomicWriteNewTextFile } from "../files/atomicWrite";
import { isFileExistsError, pathExists } from "../files/fileSystem";
import { resolveNewWorkspacePath } from "../files/paths";

const DEFAULT_MAX_TOOL_OUTPUT_CANDIDATES = 1000;

export function safeOutputName(name: string): RelicResult<string> {
  const trimmed = name.trim();
  const normalized = trimmed.replace(/\\/g, "/");

  if (
    !trimmed ||
    /[<>:"|?*\u0000-\u001f]/.test(trimmed) ||
    normalized.includes("/") ||
    normalized === "." ||
    normalized === ".." ||
    path.posix.isAbsolute(normalized) ||
    path.win32.isAbsolute(trimmed)
  ) {
    return fail("TOOL_OUTPUT_NAME_INVALID", "出力ファイル名が無効です。");
  }

  return ok(trimmed);
}

export async function writeToolMarkdownOutput(
  workspacePath: string,
  outputFolder: string,
  outputNameInput: string,
  content: string
): Promise<RelicResult<string>> {
  const outputName = safeOutputName(outputNameInput);
  if (!outputName.ok) return outputName;
  const outputDir = await resolveToolOutputDirectory(workspacePath, outputFolder, outputName.value);
  if (!outputDir.ok) return outputDir;

  await mkdir(outputDir.value, { recursive: true });
  const outputPath = await writeUniqueToolOutputFile(outputDir.value, outputName.value, content);
  if (!outputPath.ok) return outputPath;

  return ok(path.relative(workspacePath, outputPath.value));
}

async function resolveToolOutputDirectory(
  workspacePath: string,
  outputFolder: string,
  outputName: string
): Promise<RelicResult<string>> {
  const outputRelativePath = path.posix.join(
    normalizeWorkspaceRelativeFolder(outputFolder),
    ensureMarkdownExtension(outputName)
  );
  const outputPath = await resolveNewWorkspacePath(workspacePath, outputRelativePath);

  if (!outputPath.ok) return outputPath;

  return ok(path.dirname(outputPath.value));
}

function normalizeWorkspaceRelativeFolder(folder: string): string {
  const normalized = folder.replace(/\\/g, "/").trim();
  return normalized === "" ? "." : normalized;
}

export async function uniqueFilePath(
  dir: string,
  name: string,
  maxCandidates = DEFAULT_MAX_TOOL_OUTPUT_CANDIDATES
): Promise<RelicResult<string>> {
  const base = stripMarkdownExtension(name);

  for (let counter = 0; counter < maxCandidates; counter += 1) {
    const suffix = counter === 0 ? "" : `-${counter}`;
    const candidate = path.join(dir, `${base}${suffix}.md`);

    if (!(await pathExists(candidate))) {
      return ok(candidate);
    }
  }

  return fail("TOOL_OUTPUT_NAME_EXHAUSTED", "出力ファイル名の候補が多すぎます。");
}

export async function writeUniqueToolOutputFile(
  dir: string,
  name: string,
  content: string,
  maxCandidates = DEFAULT_MAX_TOOL_OUTPUT_CANDIDATES,
  writeNewTextFile: (filePath: string, content: string) => Promise<void> = atomicWriteNewTextFile
): Promise<RelicResult<string>> {
  const base = stripMarkdownExtension(name);

  for (let counter = 0; counter < maxCandidates; counter += 1) {
    const suffix = counter === 0 ? "" : `-${counter}`;
    const candidate = path.join(dir, `${base}${suffix}.md`);

    try {
      await writeNewTextFile(candidate, content);
      return ok(candidate);
    } catch (error) {
      if (isFileExistsError(error)) continue;

      throw error;
    }
  }

  return fail("TOOL_OUTPUT_NAME_EXHAUSTED", "出力ファイル名の候補が多すぎます。");
}
