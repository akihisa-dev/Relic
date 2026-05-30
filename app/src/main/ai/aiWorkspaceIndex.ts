import { readFile, stat } from "node:fs/promises";
import type { Stats } from "node:fs";
import path from "node:path";

import { collectMarkdownPaths } from "../../shared/workspaceTree";
import { readWorkspaceFileTree } from "../files/fileTree";
import { resolveWorkspaceRelativePath } from "../files/paths";
import { workspaceSearchMaxFileBytes } from "../files/search";
import type { AIWorkspaceChunk, AIWorkspaceIndexData } from "./aiWorkspaceData";

interface IndexOperations {
  readFile(filePath: string, encoding: BufferEncoding): Promise<string>;
  stat(filePath: string): Promise<Stats>;
}

const defaultIndexOperations: IndexOperations = {
  readFile,
  stat
};

const maxChunkLines = 80;

export async function buildAIWorkspaceIndex(
  workspacePath: string,
  operations: IndexOperations = defaultIndexOperations
): Promise<AIWorkspaceIndexData> {
  const fileTree = await readWorkspaceFileTree(workspacePath);
  const chunks: AIWorkspaceChunk[] = [];
  const skippedLargeFiles: Array<{ path: string; reason: string }> = [];
  const unreadableFiles: Array<{ path: string; reason: string }> = [];

  for (const relativePath of collectMarkdownPaths(fileTree)) {
    const absolutePath = resolveWorkspaceRelativePath(workspacePath, relativePath);

    if (!absolutePath.ok) continue;

    let fileStats: Stats;
    try {
      fileStats = await operations.stat(absolutePath.value);
    } catch {
      unreadableFiles.push({ path: relativePath, reason: "ファイル情報を確認できませんでした。" });
      continue;
    }

    if (fileStats.size > workspaceSearchMaxFileBytes) {
      skippedLargeFiles.push({ path: relativePath, reason: "大きいMarkdownのためAI参照から除外しました。" });
      continue;
    }

    try {
      const content = await operations.readFile(absolutePath.value, "utf8");
      chunks.push(...chunkMarkdown(relativePath, content));
    } catch {
      unreadableFiles.push({ path: relativePath, reason: "Markdownを読み込めませんでした。" });
    }
  }

  return {
    chunks,
    indexedAt: new Date().toISOString(),
    skippedLargeFiles,
    unreadableFiles
  };
}

export function searchAIWorkspaceChunks(chunks: AIWorkspaceChunk[], query: string): AIWorkspaceChunk[] {
  const terms = query
    .toLocaleLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean);

  if (terms.length === 0) return chunks.slice(0, 8);

  return chunks
    .map((chunk) => ({ chunk, score: scoreChunk(chunk, terms) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.chunk.path.localeCompare(b.chunk.path, "ja"))
    .slice(0, 8)
    .map((item) => item.chunk);
}

function chunkMarkdown(relativePath: string, content: string): AIWorkspaceChunk[] {
  const lines = content.split("\n");
  const chunks: AIWorkspaceChunk[] = [];

  for (let start = 0; start < lines.length; start += maxChunkLines) {
    const end = Math.min(start + maxChunkLines, lines.length);
    const chunkContent = lines.slice(start, end).join("\n").trim();

    if (chunkContent) {
      chunks.push({
        content: chunkContent,
        endLine: end,
        path: relativePath,
        startLine: start + 1
      });
    }
  }

  if (chunks.length === 0) {
    chunks.push({
      content: `# ${path.basename(relativePath, ".md")}`,
      endLine: 1,
      path: relativePath,
      startLine: 1
    });
  }

  return chunks;
}

function scoreChunk(chunk: AIWorkspaceChunk, terms: string[]): number {
  const haystack = `${chunk.path}\n${chunk.content}`.toLocaleLowerCase();

  return terms.reduce((score, term) => score + countOccurrences(haystack, term), 0);
}

function countOccurrences(value: string, term: string): number {
  let count = 0;
  let index = value.indexOf(term);

  while (index !== -1) {
    count += 1;
    index = value.indexOf(term, index + term.length);
  }

  return count;
}
