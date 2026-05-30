import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import type { AIWorkspaceFileOperation, AIWorkspaceMessage } from "../../shared/ipc";

export interface AIWorkspaceChunk {
  content: string;
  endLine: number;
  path: string;
  startLine: number;
}

export interface AIWorkspaceIndexData {
  chunks: AIWorkspaceChunk[];
  indexedAt: string | null;
  skippedLargeFiles: Array<{ path: string; reason: string }>;
  unreadableFiles: Array<{ path: string; reason: string }>;
}

export interface AIWorkspaceData {
  history: AIWorkspaceMessage[];
  index: AIWorkspaceIndexData;
  operations: AIWorkspaceFileOperation[];
}

export const emptyAIWorkspaceIndex = (): AIWorkspaceIndexData => ({
  chunks: [],
  indexedAt: null,
  skippedLargeFiles: [],
  unreadableFiles: []
});

export const emptyAIWorkspaceData = (): AIWorkspaceData => ({
  history: [],
  index: emptyAIWorkspaceIndex(),
  operations: []
});

export async function readAIWorkspaceData(userDataPath: string, workspaceId: string): Promise<AIWorkspaceData> {
  try {
    const raw = await readFile(aiWorkspaceDataPath(userDataPath, workspaceId), "utf8");
    const parsed = JSON.parse(raw) as Partial<AIWorkspaceData>;

    return {
      history: Array.isArray(parsed.history) ? parsed.history.filter(isAIWorkspaceMessage) : [],
      index: parseIndexData(parsed.index),
      operations: Array.isArray(parsed.operations) ? parsed.operations.filter(isAIWorkspaceFileOperation) : []
    };
  } catch {
    return emptyAIWorkspaceData();
  }
}

export async function writeAIWorkspaceData(
  userDataPath: string,
  workspaceId: string,
  data: AIWorkspaceData
): Promise<void> {
  const filePath = aiWorkspaceDataPath(userDataPath, workspaceId);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export async function clearAIWorkspaceData(userDataPath: string, workspaceId: string): Promise<void> {
  await rm(aiWorkspaceDataPath(userDataPath, workspaceId), { force: true });
}

function aiWorkspaceDataPath(userDataPath: string, workspaceId: string): string {
  return path.join(userDataPath, "ai-workspaces", `${workspaceId}.json`);
}

function parseIndexData(value: unknown): AIWorkspaceIndexData {
  if (!value || typeof value !== "object") return emptyAIWorkspaceIndex();

  const record = value as Partial<AIWorkspaceIndexData>;

  return {
    chunks: Array.isArray(record.chunks) ? record.chunks.filter(isAIWorkspaceChunk) : [],
    indexedAt: typeof record.indexedAt === "string" ? record.indexedAt : null,
    skippedLargeFiles: Array.isArray(record.skippedLargeFiles) ? record.skippedLargeFiles.filter(isSkippedFile) : [],
    unreadableFiles: Array.isArray(record.unreadableFiles) ? record.unreadableFiles.filter(isSkippedFile) : []
  };
}

function isAIWorkspaceMessage(value: unknown): value is AIWorkspaceMessage {
  if (!value || typeof value !== "object") return false;
  const record = value as AIWorkspaceMessage;

  return typeof record.id === "string" &&
    typeof record.content === "string" &&
    typeof record.createdAt === "string" &&
    (record.role === "user" || record.role === "assistant") &&
    Array.isArray(record.references) &&
    (!record.operations || (Array.isArray(record.operations) && record.operations.every(isAIWorkspaceFileOperation)));
}

function isAIWorkspaceChunk(value: unknown): value is AIWorkspaceChunk {
  if (!value || typeof value !== "object") return false;
  const record = value as AIWorkspaceChunk;

  return typeof record.path === "string" &&
    typeof record.content === "string" &&
    typeof record.startLine === "number" &&
    typeof record.endLine === "number";
}

function isSkippedFile(value: unknown): value is { path: string; reason: string } {
  if (!value || typeof value !== "object") return false;
  const record = value as { path?: unknown; reason?: unknown };

  return typeof record.path === "string" && typeof record.reason === "string";
}

function isAIWorkspaceFileOperation(value: unknown): value is AIWorkspaceFileOperation {
  if (!value || typeof value !== "object") return false;
  const record = value as AIWorkspaceFileOperation;

  return typeof record.id === "string" &&
    typeof record.createdAt === "string" &&
    typeof record.path === "string" &&
    typeof record.summary === "string" &&
    (record.kind === "create" || record.kind === "update" || record.kind === "delete") &&
    (record.status === "pending" || record.status === "applied" || record.status === "discarded" || record.status === "failed") &&
    (record.content === undefined || typeof record.content === "string");
}
