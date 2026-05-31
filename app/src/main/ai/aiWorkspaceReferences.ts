import path from "node:path";

import type { AIWorkspaceReference } from "../../shared/ipc";
import { readMarkdownFile } from "../files/markdownFiles";
import { normalizeWorkspaceRelativeInputPath } from "../files/paths";
import { workspaceSearchMaxFileBytes } from "../files/search";
import type { AIWorkspaceData } from "./aiWorkspaceData";
import { hasCurrentFileReference, normalizeOperationText } from "./aiWorkspaceText";

export function buildReferences(
  data: AIWorkspaceData,
  message: string,
  activeFilePath?: string | null,
  activeFileContent?: string | null
): AIWorkspaceReference[] {
  const references = allWorkspaceReferences(data).map<AIWorkspaceReference>((chunk) => ({
    line: chunk.startLine,
    path: chunk.path,
    preview: chunk.content.split("\n").find((line) => line.trim())?.trim().slice(0, 160) ?? chunk.path
  }));
  const activePath = usableActiveFilePath(activeFilePath);

  if (!activePath || !hasCurrentFileReference(message)) return references;

  const normalizedActiveFilePath = normalizeOperationText(activePath);
  const activeChunk = data.index.chunks.find((chunk) => {
    return normalizeOperationText(chunk.path) === normalizedActiveFilePath;
  });
  const activeContent = usableActiveFileContent(activeFileContent);
  if (!activeChunk) {
    if (!activeContent) return references;

    return [{
      line: 1,
      path: activePath,
      preview: previewMarkdownContent(activeContent, activePath)
    }, ...references.filter((reference) => {
      return normalizeOperationText(reference.path) !== normalizedActiveFilePath;
    })];
  }

  return [{
    line: activeChunk.startLine,
    path: activeChunk.path,
    preview: previewMarkdownContent(activeContent ?? activeChunk.content, activeChunk.path)
  }, ...references.filter((reference) => {
    return normalizeOperationText(reference.path) !== normalizedActiveFilePath;
  })];
}

export async function readReferenceContents(
  workspacePath: string,
  references: AIWorkspaceReference[],
  activeFile?: { content: string | null; path: string | null }
): Promise<Array<{ content: string; path: string }>> {
  const uniquePaths = [...new Set(references.map((reference) => reference.path))];
  const contents: Array<{ content: string; path: string }> = [];

  for (const markdownPath of uniquePaths) {
    const activeContent = usableActiveFileContent(activeFile?.content);
    const activePath = usableActiveFilePath(activeFile?.path);
    if (activePath && activeContent && normalizeOperationText(markdownPath) === normalizeOperationText(activePath)) {
      contents.push({ content: activeContent, path: markdownPath });
      continue;
    }

    const file = await readMarkdownFile(workspacePath, markdownPath);
    if (file.ok) {
      contents.push({ content: file.value.content, path: markdownPath });
    }
  }

  return contents;
}

function allWorkspaceReferences(data: AIWorkspaceData): AIWorkspaceData["index"]["chunks"] {
  const seenPaths = new Set<string>();
  const chunks: AIWorkspaceData["index"]["chunks"] = [];

  for (const chunk of data.index.chunks) {
    if (seenPaths.has(chunk.path)) continue;
    seenPaths.add(chunk.path);
    chunks.push(chunk);
  }

  return chunks;
}

function previewMarkdownContent(content: string, fallbackPath: string): string {
  return content.split("\n").find((line) => line.trim())?.trim().slice(0, 160) ?? fallbackPath;
}

export function usableActiveFileContent(content?: string | null): string | null {
  if (content === undefined || content === null) return null;
  if (Buffer.byteLength(content, "utf8") > workspaceSearchMaxFileBytes) return null;
  return content;
}

export function usableActiveFilePath(filePath?: string | null): string | null {
  if (!filePath) return null;
  const normalizedPath = normalizeWorkspaceRelativeInputPath(filePath);
  if (!normalizedPath || path.posix.extname(normalizedPath) !== ".md") return null;
  return normalizedPath;
}
