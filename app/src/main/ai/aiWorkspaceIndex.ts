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
const embeddingDimensions = 64;

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
  const terms = tokenizeSearchText(query);
  const queryEmbedding = createLocalEmbedding(query);

  if (terms.length === 0) return chunks.slice(0, 8);

  return chunks
    .map((chunk) => ({ chunk, score: scoreChunk(chunk, terms, queryEmbedding) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.chunk.path.localeCompare(b.chunk.path, "ja"))
    .slice(0, 8)
    .map((item) => item.chunk);
}

export function tokenizeSearchText(value: string): string[] {
  const normalized = value.toLocaleLowerCase();
  const terms = new Set<string>();

  for (const match of normalized.matchAll(/[\p{L}\p{N}_-]+/gu)) {
    const token = match[0].trim();
    if (!token) continue;
    terms.add(token);

    if (hasCjk(token)) {
      for (const gram of cjkNgrams(token)) {
        terms.add(gram);
      }
    }
  }

  return [...terms];
}

export function createLocalEmbedding(value: string): number[] {
  const vector = Array.from({ length: embeddingDimensions }, () => 0);
  const terms = tokenizeSearchText(value);

  for (const term of terms) {
    const index = stableHash(term) % embeddingDimensions;
    vector[index] += term.length <= 2 ? 0.7 : 1;
  }

  const magnitude = Math.sqrt(vector.reduce((sum, item) => sum + item * item, 0));
  if (magnitude === 0) return vector;

  return vector.map((item) => Number((item / magnitude).toFixed(6)));
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
        embedding: createLocalEmbedding(`${relativePath}\n${chunkContent}`),
        endLine: end,
        path: relativePath,
        startLine: start + 1
      });
    }
  }

  if (chunks.length === 0) {
    chunks.push({
      content: `# ${path.basename(relativePath, ".md")}`,
      embedding: createLocalEmbedding(relativePath),
      endLine: 1,
      path: relativePath,
      startLine: 1
    });
  }

  return chunks;
}

function scoreChunk(chunk: AIWorkspaceChunk, terms: string[], queryEmbedding: number[]): number {
  const haystack = `${chunk.path}\n${chunk.content}`.toLocaleLowerCase();
  const lexicalScore = terms.reduce((score, term) => score + countOccurrences(haystack, term), 0);
  const vectorScore = cosineSimilarity(queryEmbedding, chunk.embedding) * 2;

  return lexicalScore + vectorScore;
}

function hasCjk(value: string): boolean {
  return /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(value);
}

function cjkNgrams(value: string): string[] {
  const chars = [...value].filter((char) => hasCjk(char));
  if (chars.length <= 1) return chars;

  const grams: string[] = [];
  for (let index = 0; index < chars.length - 1; index += 1) {
    grams.push(chars.slice(index, index + 2).join(""));
  }

  return grams;
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

function stableHash(value: string): number {
  let hash = 2166136261;

  for (const char of value) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function cosineSimilarity(left: number[], right: number[]): number {
  if (left.length === 0 || right.length === 0) return 0;

  const length = Math.min(left.length, right.length);
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (let index = 0; index < length; index += 1) {
    dot += left[index] * right[index];
    leftMagnitude += left[index] * left[index];
    rightMagnitude += right[index] * right[index];
  }

  if (leftMagnitude === 0 || rightMagnitude === 0) return 0;
  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}
