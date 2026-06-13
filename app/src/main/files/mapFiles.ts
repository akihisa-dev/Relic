import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  parseRelicMapMarkdown,
  serializeRelicMapMarkdown,
  type RelicMapDocument
} from "../../shared/mapMarkdown";
import { fail, ok, type RelicResult } from "../../shared/result";
import { atomicWriteTextFile } from "./atomicWrite";
import { errorDetails } from "./fileSystem";
import { resolveExistingWorkspacePath } from "./paths";

export interface RelicMapFileContent {
  content: string;
  map: RelicMapDocument;
  name: string;
  path: string;
}

export async function readRelicMapFile(
  workspacePath: string,
  relativePath: string
): Promise<RelicResult<RelicMapFileContent>> {
  if (path.extname(relativePath) !== ".md") {
    return fail("FILE_TYPE_UNSUPPORTED", "MapファイルはMarkdownファイルとして開いてください。");
  }

  const absoluteFilePath = await resolveExistingWorkspacePath(workspacePath, relativePath);
  if (!absoluteFilePath.ok) return absoluteFilePath;

  try {
    const content = await readFile(absoluteFilePath.value, "utf8");
    const parsed = parseRelicMapMarkdown(content);
    if (!parsed.ok) return parsed;

    return ok({
      content,
      map: parsed.value,
      name: path.basename(relativePath, ".md"),
      path: relativePath
    });
  } catch (error) {
    return fail("MAP_FILE_READ_FAILED", "Mapファイルを読み込めませんでした。", errorDetails(error));
  }
}

export async function writeRelicMapFile(
  workspacePath: string,
  relativePath: string,
  map: RelicMapDocument,
  expectedContent?: string
): Promise<RelicResult<string>> {
  if (path.extname(relativePath) !== ".md") {
    return fail("FILE_TYPE_UNSUPPORTED", "MapファイルはMarkdownファイルとして保存してください。");
  }

  const absoluteFilePath = await resolveExistingWorkspacePath(workspacePath, relativePath);
  if (!absoluteFilePath.ok) return absoluteFilePath;

  const serialized = serializeRelicMapMarkdown(map);
  if (!serialized.ok) return serialized;

  try {
    const currentContent = await readFile(absoluteFilePath.value, "utf8");
    if (expectedContent !== undefined && currentContent !== expectedContent) {
      return fail("MAP_FILE_WRITE_CONFLICT", "Mapファイルが外部で変更されています。再読み込みしてから保存してください。");
    }

    const currentMap = parseRelicMapMarkdown(currentContent);
    if (!currentMap.ok) return currentMap;

    await atomicWriteTextFile(absoluteFilePath.value, serialized.value);

    return ok(serialized.value);
  } catch (error) {
    return fail("MAP_FILE_WRITE_FAILED", "Mapファイルを保存できませんでした。", errorDetails(error));
  }
}
