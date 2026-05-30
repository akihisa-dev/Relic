import { existsSync } from "node:fs";

import type {
  AIWorkspaceFileOperation,
  AIWorkspaceMessage,
  AIWorkspaceReference,
  AIWorkspaceState,
  ApplyAIWorkspaceOperationsInput,
  ClearAIWorkspaceDataInput,
  DiscardAIWorkspaceOperationsInput,
  SendAIWorkspaceMessageInput
} from "../../shared/ipc";
import { fail, ok, type RelicResult } from "../../shared/result";
import { createMarkdownFileAtPath, readMarkdownFile, writeMarkdownFileContent } from "../files/markdownFiles";
import { moveWorkspaceItemToTrash, type TrashItem } from "../files/trash";
import { buildAIWorkspaceIndex, searchAIWorkspaceChunks } from "./aiWorkspaceIndex";
import {
  clearAIWorkspaceData,
  emptyAIWorkspaceData,
  readAIWorkspaceData,
  writeAIWorkspaceData,
  type AIWorkspaceData
} from "./aiWorkspaceData";
import { runCodexAIWorkspaceTurn } from "./codexAppServerClient";

interface AIWorkspaceContext {
  userDataPath: string;
  workspaceId: string;
  workspacePath: string;
}

export async function getAIWorkspaceState(context: AIWorkspaceContext): Promise<RelicResult<AIWorkspaceState>> {
  const data = await readAIWorkspaceData(context.userDataPath, context.workspaceId);

  return ok(toState(data));
}

export async function rebuildAIWorkspaceIndex(context: AIWorkspaceContext): Promise<RelicResult<AIWorkspaceState>> {
  try {
    const data = await readAIWorkspaceData(context.userDataPath, context.workspaceId);
    const nextData: AIWorkspaceData = {
      ...data,
      index: await buildAIWorkspaceIndex(context.workspacePath)
    };
    await writeAIWorkspaceData(context.userDataPath, context.workspaceId, nextData);

    return ok(toState(nextData));
  } catch (error) {
    return fail("AI_WORKSPACE_INDEX_FAILED", "AI Workspaceのインデックスを作成できませんでした。", String(error));
  }
}

export async function sendAIWorkspaceMessage(
  context: AIWorkspaceContext,
  input: SendAIWorkspaceMessageInput,
  trashItem?: TrashItem
): Promise<RelicResult<AIWorkspaceState>> {
  const message = input.message.trim();

  if (!message) {
    return fail("AI_WORKSPACE_MESSAGE_EMPTY", "AIに送る内容を入力してください。");
  }

  try {
    const data = await ensureIndexed(context);
    if (shouldDiscardPendingOperations(message) && data.operations.some((operation) => operation.status === "pending")) {
      return discardAIWorkspaceOperations(context, {});
    }

    if (shouldApplyPendingOperations(message) && data.operations.some((operation) => operation.status === "pending")) {
      return applyAIWorkspaceOperations(context, { dirtyFilePaths: input.dirtyFilePaths }, trashItem);
    }

    const references = searchAIWorkspaceChunks(data.index.chunks, message).map<AIWorkspaceReference>((chunk) => ({
      line: chunk.startLine,
      path: chunk.path,
      preview: chunk.content.split("\n").find((line) => line.trim())?.trim().slice(0, 160) ?? chunk.path
    }));
    const userMessage: AIWorkspaceMessage = {
      content: message,
      createdAt: new Date().toISOString(),
      id: createMessageId("user"),
      references: [],
      role: "user"
    };
    const codexResponse = await runCodexAIWorkspaceTurn({
      history: data.history.map((item) => ({ content: item.content, role: item.role })),
      message,
      referenceContents: await readReferenceContents(context.workspacePath, references),
      references,
      workspacePath: context.workspacePath
    }).catch(() => null);
    const operations = codexResponse?.operations ?? [];
    const assistantMessage: AIWorkspaceMessage = {
      content: codexResponse?.message ?? buildAssistantPlaceholder(message, references),
      createdAt: new Date().toISOString(),
      id: createMessageId("assistant"),
      operations,
      references,
      role: "assistant"
    };
    const nextData = {
      ...data,
      history: [...data.history, userMessage, assistantMessage],
      operations: [...data.operations, ...operations]
    };
    await writeAIWorkspaceData(context.userDataPath, context.workspaceId, nextData);

    return ok(toState(nextData));
  } catch (error) {
    return fail("AI_WORKSPACE_MESSAGE_FAILED", "AI Workspaceで処理できませんでした。", String(error));
  }
}

export async function applyAIWorkspaceOperations(
  context: AIWorkspaceContext,
  input: ApplyAIWorkspaceOperationsInput,
  trashItem?: TrashItem
): Promise<RelicResult<AIWorkspaceState>> {
  const data = await readAIWorkspaceData(context.userDataPath, context.workspaceId);
  const targetIds = new Set(input.operationIds ?? []);
  const targetOperations = data.operations.filter((operation) => {
    if (operation.status !== "pending") return false;
    return targetIds.size === 0 || targetIds.has(operation.id);
  });

  if (targetOperations.length === 0) {
    return fail("AI_WORKSPACE_NO_PENDING_OPERATIONS", "反映できるAI変更案がありません。");
  }

  const dirtyPaths = blockedDirtyPaths(targetOperations, input.dirtyFilePaths ?? []);
  if (dirtyPaths.length > 0) {
    return fail(
      "AI_WORKSPACE_DIRTY_FILE_BLOCKED",
      `未保存のMarkdownがあるためAI変更案を反映できません。先に保存または破棄してください: ${dirtyPaths.join(", ")}`
    );
  }

  const appliedIds = new Set<string>();
  const failedIds = new Set<string>();

  for (const operation of targetOperations) {
    const result = await applyOperation(context.workspacePath, operation, trashItem);
    if (result.ok) {
      appliedIds.add(operation.id);
    } else {
      failedIds.add(operation.id);
    }
  }

  const nextData: AIWorkspaceData = {
    ...data,
    index: await buildAIWorkspaceIndex(context.workspacePath),
    operations: data.operations.map((operation) => {
      if (appliedIds.has(operation.id)) return { ...operation, status: "applied" };
      if (failedIds.has(operation.id)) return { ...operation, status: "failed" };
      return operation;
    })
  };
  const assistantMessage: AIWorkspaceMessage = {
    content: failedIds.size > 0
      ? "一部のAI変更案を反映できませんでした。対象ファイルの状態を確認してから、もう一度依頼してください。"
      : "AI変更案をMarkdownへ反映しました。",
    createdAt: new Date().toISOString(),
    id: createMessageId("assistant"),
    references: targetOperations.map((operation) => ({
      path: operation.path,
      preview: operation.summary
    })),
    role: "assistant"
  };
  nextData.history = [...nextData.history, assistantMessage];
  await writeAIWorkspaceData(context.userDataPath, context.workspaceId, nextData);

  return ok(toState(nextData));
}

export async function discardAIWorkspaceOperations(
  context: AIWorkspaceContext,
  input: DiscardAIWorkspaceOperationsInput
): Promise<RelicResult<AIWorkspaceState>> {
  const data = await readAIWorkspaceData(context.userDataPath, context.workspaceId);
  const targetIds = new Set(input.operationIds ?? []);
  const targetOperations = data.operations.filter((operation) => {
    if (operation.status !== "pending") return false;
    return targetIds.size === 0 || targetIds.has(operation.id);
  });

  if (targetOperations.length === 0) {
    return fail("AI_WORKSPACE_NO_PENDING_OPERATIONS", "取りやめできるAI変更案がありません。");
  }

  const discardedIds = new Set(targetOperations.map((operation) => operation.id));
  const nextData: AIWorkspaceData = {
    ...data,
    operations: data.operations.map((operation) => {
      if (discardedIds.has(operation.id)) return { ...operation, status: "discarded" };
      return operation;
    })
  };
  const assistantMessage: AIWorkspaceMessage = {
    content: "AI変更案を取りやめました。Markdownファイルには反映していません。",
    createdAt: new Date().toISOString(),
    id: createMessageId("assistant"),
    references: targetOperations.map((operation) => ({
      path: operation.path,
      preview: operation.summary
    })),
    role: "assistant"
  };
  nextData.history = [...nextData.history, assistantMessage];
  await writeAIWorkspaceData(context.userDataPath, context.workspaceId, nextData);

  return ok(toState(nextData));
}

export async function clearAIWorkspaceState(
  context: AIWorkspaceContext,
  input: ClearAIWorkspaceDataInput
): Promise<RelicResult<AIWorkspaceState>> {
  const includeHistory = input.includeHistory ?? true;
  const includeIndex = input.includeIndex ?? true;

  if (includeHistory && includeIndex) {
    await clearAIWorkspaceData(context.userDataPath, context.workspaceId);
    return ok(toState(emptyAIWorkspaceData()));
  }

  const data = await readAIWorkspaceData(context.userDataPath, context.workspaceId);
  const nextData: AIWorkspaceData = {
    history: includeHistory ? [] : data.history,
    index: includeIndex ? emptyAIWorkspaceData().index : data.index,
    operations: includeHistory ? [] : data.operations
  };
  await writeAIWorkspaceData(context.userDataPath, context.workspaceId, nextData);

  return ok(toState(nextData));
}

async function ensureIndexed(context: AIWorkspaceContext): Promise<AIWorkspaceData> {
  const data = await readAIWorkspaceData(context.userDataPath, context.workspaceId);

  if (data.index.indexedAt && data.index.chunks.length > 0) return data;

  const nextData = {
    ...data,
    index: await buildAIWorkspaceIndex(context.workspacePath)
  };
  await writeAIWorkspaceData(context.userDataPath, context.workspaceId, nextData);

  return nextData;
}

function toState(data: AIWorkspaceData): AIWorkspaceState {
  return {
    codexAppServerAvailable: existsSync("/Applications/Codex.app/Contents/Resources/codex"),
    history: data.history,
    index: {
      chunkCount: data.index.chunks.length,
      indexedAt: data.index.indexedAt,
      indexedFileCount: new Set(data.index.chunks.map((chunk) => chunk.path)).size,
      skippedLargeFiles: data.index.skippedLargeFiles,
      unreadableFiles: data.index.unreadableFiles
    },
    pendingOperations: data.operations.filter((operation) => operation.status === "pending")
  };
}

async function readReferenceContents(
  workspacePath: string,
  references: AIWorkspaceReference[]
): Promise<Array<{ content: string; path: string }>> {
  const uniquePaths = [...new Set(references.map((reference) => reference.path))].slice(0, 8);
  const contents: Array<{ content: string; path: string }> = [];

  for (const path of uniquePaths) {
    const file = await readMarkdownFile(workspacePath, path);
    if (file.ok) {
      contents.push({ content: file.value.content.slice(0, 16_000), path });
    }
  }

  return contents;
}

async function applyOperation(
  workspacePath: string,
  operation: AIWorkspaceFileOperation,
  trashItem?: TrashItem
): Promise<RelicResult<void>> {
  if (operation.kind === "create") {
    const created = await createMarkdownFileAtPath(workspacePath, operation.path);
    if (!created.ok) return created;
    return writeMarkdownFileContent(workspacePath, operation.path, operation.content ?? "");
  }

  if (operation.kind === "update") {
    return writeMarkdownFileContent(workspacePath, operation.path, operation.content ?? "");
  }

  if (!trashItem) {
    return fail("AI_WORKSPACE_TRASH_UNAVAILABLE", "AI変更案の削除を実行できませんでした。");
  }

  const moved = await moveWorkspaceItemToTrash(workspacePath, operation.path, "file", trashItem);
  if (!moved.ok) return moved;
  return ok(undefined);
}

function shouldApplyPendingOperations(message: string): boolean {
  return /(反映|適用|実行|保存|やって|進めて)/.test(message) &&
    !/(しない|やめ|不要|キャンセル|まだ)/.test(message);
}

function shouldDiscardPendingOperations(message: string): boolean {
  return /(やめ|取りやめ|不要|キャンセル|破棄|なしにして|しない)/.test(message);
}

function blockedDirtyPaths(
  operations: AIWorkspaceFileOperation[],
  dirtyFilePaths: string[]
): string[] {
  const dirtyPathSet = new Set(dirtyFilePaths);
  return [...new Set(
    operations
      .filter((operation) => operation.kind !== "create" && dirtyPathSet.has(operation.path))
      .map((operation) => operation.path)
  )];
}

function buildAssistantPlaceholder(message: string, references: AIWorkspaceReference[]): string {
  if (references.length === 0) {
    return [
      "ワークスペース内のMarkdownを確認しましたが、この内容に直接一致する参照はまだ見つかりませんでした。",
      "Codex App Serverとの実行接続は次の実装段階でこの会話経路に接続します。"
    ].join("\n");
  }

  const files = references.map((reference) => `- ${reference.path}`).join("\n");

  return [
    "関連しそうなMarkdownを確認しました。",
    "",
    files,
    "",
    `受け取った依頼: ${message}`,
    "",
    "この会話経路にCodex App Serverを接続すると、ここからMarkdownの作成・編集・削除まで進められます。"
  ].join("\n");
}

function createMessageId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
