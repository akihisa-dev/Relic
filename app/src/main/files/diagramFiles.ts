import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  parseRelicDiagramMarkdown,
  serializeRelicDiagramMarkdown,
  type RelicDiagramDocument
} from "../../shared/diagramMarkdown";
import { hasMarkdownExtension, stripMarkdownExtension } from "../../shared/markdownExtension";
import { fail, ok, type RelicResult } from "../../shared/result";
import { atomicWriteTextFile } from "./atomicWrite";
import { errorDetails } from "./fileSystem";
import { resolveExistingWorkspacePath } from "./paths";

export interface RelicDiagramFileContent {
  content: string;
  map: RelicDiagramDocument;
  name: string;
  path: string;
}

export async function readRelicDiagramFile(
  workspacePath: string,
  relativePath: string
): Promise<RelicResult<RelicDiagramFileContent>> {
  if (!hasMarkdownExtension(relativePath)) {
    return fail("FILE_TYPE_UNSUPPORTED", "図解ファイルはMarkdownファイルとして開いてください。");
  }

  const absoluteFilePath = await resolveExistingWorkspacePath(workspacePath, relativePath);
  if (!absoluteFilePath.ok) return absoluteFilePath;

  try {
    const content = await readFile(absoluteFilePath.value, "utf8");
    const parsed = parseRelicDiagramMarkdown(content);
    if (!parsed.ok) return parsed;

    return ok({
      content,
      map: parsed.value,
      name: stripMarkdownExtension(path.basename(relativePath)),
      path: relativePath
    });
  } catch (error) {
    return fail("MAP_FILE_READ_FAILED", "図解ファイルを読み込めませんでした。", errorDetails(error));
  }
}

export async function writeRelicDiagramFile(
  workspacePath: string,
  relativePath: string,
  map: RelicDiagramDocument,
  expectedContent?: string
): Promise<RelicResult<string>> {
  if (!hasMarkdownExtension(relativePath)) {
    return fail("FILE_TYPE_UNSUPPORTED", "図解ファイルはMarkdownファイルとして保存してください。");
  }

  const absoluteFilePath = await resolveExistingWorkspacePath(workspacePath, relativePath);
  if (!absoluteFilePath.ok) return absoluteFilePath;

  const serialized = serializeRelicDiagramMarkdown(map);
  if (!serialized.ok) return serialized;

  try {
    const currentContent = await readFile(absoluteFilePath.value, "utf8");
    if (expectedContent !== undefined && currentContent !== expectedContent) {
      return fail("MAP_FILE_WRITE_CONFLICT", "図解ファイルが外部で変更されています。再読み込みしてから保存してください。");
    }

    const currentMap = parseRelicDiagramMarkdown(currentContent);
    if (!currentMap.ok) return currentMap;

    await atomicWriteTextFile(absoluteFilePath.value, serialized.value);

    return ok(serialized.value);
  } catch (error) {
    return fail("MAP_FILE_WRITE_FAILED", "図解ファイルを保存できませんでした。", errorDetails(error));
  }
}
