import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import type { AIWorkspaceFileOperation, AIWorkspaceMessage, AIWorkspaceReference } from "../../shared/ipc";

export interface AIWorkspaceChunk {
  content: string;
  embedding: number[];
  endLine: number;
  path: string;
  startLine: number;
}

export interface AIWorkspaceIndexData {
  chunks: AIWorkspaceChunk[];
  indexedAt: string | null;
  skippedLargeFiles: Array<{ path: string; reason: string }>;
  sourceHash: string | null;
  unreadableFiles: Array<{ path: string; reason: string }>;
}

export interface AIWorkspaceChatData {
  createdAt: string;
  history: AIWorkspaceMessage[];
  id: string;
  operations: AIWorkspaceFileOperation[];
  title: string;
  updatedAt: string;
}

export interface AIWorkspaceData {
  activeChatId: string | null;
  chats: AIWorkspaceChatData[];
  index: AIWorkspaceIndexData;
}

export const emptyAIWorkspaceIndex = (): AIWorkspaceIndexData => ({
  chunks: [],
  indexedAt: null,
  skippedLargeFiles: [],
  sourceHash: null,
  unreadableFiles: []
});

export const emptyAIWorkspaceData = (): AIWorkspaceData => ({
  activeChatId: null,
  chats: [],
  index: emptyAIWorkspaceIndex(),
});

export async function readAIWorkspaceData(userDataPath: string, workspaceId: string): Promise<AIWorkspaceData> {
  try {
    const raw = await readFile(aiWorkspaceDataPath(userDataPath, workspaceId), "utf8");
    const parsed = JSON.parse(raw) as Partial<AIWorkspaceData>;

    const legacyHistory = Array.isArray((parsed as Partial<AIWorkspaceData> & { history?: unknown }).history)
      ? (parsed as Partial<AIWorkspaceData> & { history?: unknown[] }).history
        ?.map(parseAIWorkspaceMessage).filter((message): message is AIWorkspaceMessage => Boolean(message)) ?? []
      : [];
    const legacyOperations = Array.isArray((parsed as Partial<AIWorkspaceData> & { operations?: unknown }).operations)
      ? (parsed as Partial<AIWorkspaceData> & { operations?: unknown[] }).operations
        ?.filter(isAIWorkspaceFileOperation) ?? []
      : [];
    const chats = Array.isArray(parsed.chats)
      ? parsed.chats.map(parseAIWorkspaceChat).filter((chat): chat is AIWorkspaceChatData => Boolean(chat))
      : [];
    const migratedChats = chats.length > 0
      ? chats
      : legacyHistory.length > 0 || legacyOperations.length > 0
        ? [legacyChat(legacyHistory, legacyOperations)]
        : [];
    const activeChatId = typeof parsed.activeChatId === "string" &&
      migratedChats.some((chat) => chat.id === parsed.activeChatId)
      ? parsed.activeChatId
      : migratedChats[0]?.id ?? null;

    return {
      activeChatId,
      chats: migratedChats,
      index: parseIndexData(parsed.index),
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
  return path.join(userDataPath, "ai-workspaces", `${encodeURIComponent(workspaceId)}.json`);
}

function legacyChat(
  history: AIWorkspaceMessage[],
  operations: AIWorkspaceFileOperation[]
): AIWorkspaceChatData {
  const timestamps = [
    ...history.map((message) => message.createdAt),
    ...operations.map((operation) => operation.createdAt)
  ].filter(Boolean).sort();
  const createdAt = timestamps[0] ?? new Date(0).toISOString();
  const updatedAt = timestamps.at(-1) ?? createdAt;

  return {
    createdAt,
    history,
    id: "legacy",
    operations,
    title: "以前のチャット",
    updatedAt
  };
}

function parseAIWorkspaceChat(value: unknown): AIWorkspaceChatData | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<AIWorkspaceChatData>;

  if (
    typeof record.id !== "string" ||
    typeof record.title !== "string" ||
    typeof record.createdAt !== "string" ||
    typeof record.updatedAt !== "string"
  ) {
    return null;
  }

  return {
    createdAt: record.createdAt,
    history: Array.isArray(record.history)
      ? record.history.map(parseAIWorkspaceMessage).filter((message): message is AIWorkspaceMessage => Boolean(message))
      : [],
    id: record.id,
    operations: Array.isArray(record.operations) ? record.operations.filter(isAIWorkspaceFileOperation) : [],
    title: record.title.trim() || "新しいチャット",
    updatedAt: record.updatedAt
  };
}

function parseIndexData(value: unknown): AIWorkspaceIndexData {
  if (!value || typeof value !== "object") return emptyAIWorkspaceIndex();

  const record = value as Partial<AIWorkspaceIndexData>;

  return {
    chunks: Array.isArray(record.chunks)
      ? record.chunks.map(parseAIWorkspaceChunk).filter((chunk): chunk is AIWorkspaceChunk => Boolean(chunk))
      : [],
    indexedAt: typeof record.indexedAt === "string" ? record.indexedAt : null,
    skippedLargeFiles: Array.isArray(record.skippedLargeFiles) ? record.skippedLargeFiles.filter(isSkippedFile) : [],
    sourceHash: typeof record.sourceHash === "string" ? record.sourceHash : null,
    unreadableFiles: Array.isArray(record.unreadableFiles) ? record.unreadableFiles.filter(isSkippedFile) : []
  };
}

function parseAIWorkspaceMessage(value: unknown): AIWorkspaceMessage | null {
  if (!value || typeof value !== "object") return null;
  const record = value as AIWorkspaceMessage;

  if (
    typeof record.id !== "string" ||
    typeof record.content !== "string" ||
    typeof record.createdAt !== "string" ||
    (record.role !== "user" && record.role !== "assistant")
  ) {
    return null;
  }

  const operations = Array.isArray(record.operations)
    ? record.operations.filter(isAIWorkspaceFileOperation)
    : undefined;

  return {
    content: record.content,
    createdAt: record.createdAt,
    id: record.id,
    operations: operations && operations.length > 0 ? operations : undefined,
    references: Array.isArray(record.references) ? record.references.filter(isAIWorkspaceReference) : [],
    role: record.role
  };
}

function isAIWorkspaceReference(value: unknown): value is AIWorkspaceReference {
  if (!value || typeof value !== "object") return false;
  const record = value as AIWorkspaceReference;

  return typeof record.path === "string" &&
    typeof record.preview === "string" &&
    (record.line === undefined || typeof record.line === "number");
}

function parseAIWorkspaceChunk(value: unknown): AIWorkspaceChunk | null {
  if (!value || typeof value !== "object") return null;
  const record = value as AIWorkspaceChunk;

  if (
    typeof record.path !== "string" ||
    typeof record.content !== "string" ||
    typeof record.startLine !== "number" ||
    typeof record.endLine !== "number"
  ) {
    return null;
  }

  return {
    content: record.content,
    embedding: Array.isArray(record.embedding) && record.embedding.every((item) => typeof item === "number")
      ? record.embedding
      : [],
    endLine: record.endLine,
    path: record.path,
    startLine: record.startLine
  };
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
    (
      record.status === "pending" ||
      record.status === "applied" ||
      record.status === "discarded" ||
      record.status === "failed" ||
      record.status === "stale" ||
      record.status === "replaced"
    ) &&
    (record.baseContentHash === undefined || typeof record.baseContentHash === "string") &&
    (record.baseContent === undefined || typeof record.baseContent === "string") &&
    (record.content === undefined || typeof record.content === "string");
}
