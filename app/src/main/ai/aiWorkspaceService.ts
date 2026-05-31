import { createHash } from "node:crypto";
import path from "node:path";

import type {
  AIWorkspaceFileOperation,
  AIWorkspaceMessage,
  AIWorkspaceReference,
  AIWorkspaceState,
  ApplyAIWorkspaceOperationsInput,
  ClearAIWorkspaceDataInput,
  CreateAIWorkspaceChatInput,
  DeleteAIWorkspaceChatInput,
  DiscardAIWorkspaceOperationsInput,
  PreviewAIWorkspaceMessageInput,
  AIWorkspaceMessagePreview,
  AIProvider,
  SelectAIWorkspaceChatInput,
  SendAIWorkspaceMessageInput
} from "../../shared/ipc";
import { fail, ok, type RelicResult } from "../../shared/result";
import { createMarkdownFileAtPath, readMarkdownFile, writeMarkdownFileContent } from "../files/markdownFiles";
import { normalizeWorkspaceRelativeInputPath, resolveWorkspaceRelativePath } from "../files/paths";
import { workspaceSearchMaxFileBytes } from "../files/search";
import { moveWorkspaceItemToTrash, type TrashItem } from "../files/trash";
import { readAppSettings } from "../settings/appSettings";
import { buildAIWorkspaceIndex, computeAIWorkspaceIndexSourceHash } from "./aiWorkspaceIndex";
import {
  clearAIWorkspaceData,
  emptyAIWorkspaceData,
  readAIWorkspaceData,
  writeAIWorkspaceData,
  type AIWorkspaceChatData,
  type AIWorkspaceData
} from "./aiWorkspaceData";
import { hasOpenAIAPIKey, readOpenAIAPIKey } from "./openAIKeyStore";
import { readCodexAIWorkspaceUsage, runCodexAIWorkspaceTurn } from "./codexAppServerClient";
import { runOpenAIWorkspaceTurn } from "./openAIResponsesClient";

interface AIWorkspaceContext {
  userDataPath: string;
  workspaceId: string;
  workspacePath: string;
}

interface RejectedAIWorkspaceOperation {
  path: string;
  reason: string;
}

interface PreparedAIWorkspaceOperations {
  operations: AIWorkspaceFileOperation[];
  rejectedOperations: RejectedAIWorkspaceOperation[];
}

interface AppliedAIWorkspaceOperations {
  applied: AIWorkspaceFileOperation[];
  blockedDirtyPaths: string[];
  failed: AIWorkspaceFileOperation[];
  stale: AIWorkspaceFileOperation[];
}

interface AIWorkspaceTurnResult {
  message: string;
  operations: AIWorkspaceFileOperation[];
}

export async function getAIWorkspaceState(context: AIWorkspaceContext): Promise<RelicResult<AIWorkspaceState>> {
  try {
    const data = await ensureIndexed(context);

    return ok(await toState(data, context.userDataPath));
  } catch (error) {
    return fail("AI_WORKSPACE_INDEX_FAILED", "Coworkのインデックスを作成できませんでした。", String(error));
  }
}

export async function rebuildAIWorkspaceIndex(context: AIWorkspaceContext): Promise<RelicResult<AIWorkspaceState>> {
  try {
    const data = await readAIWorkspaceData(context.userDataPath, context.workspaceId);
    const nextData: AIWorkspaceData = {
      ...data,
      index: await buildAIWorkspaceIndex(context.workspacePath)
    };
    await writeAIWorkspaceData(context.userDataPath, context.workspaceId, nextData);

    return ok(await toState(nextData, context.userDataPath));
  } catch (error) {
    return fail("AI_WORKSPACE_INDEX_FAILED", "Coworkのインデックスを作成できませんでした。", String(error));
  }
}

export async function createAIWorkspaceChat(
  context: AIWorkspaceContext,
  input: CreateAIWorkspaceChatInput = {}
): Promise<RelicResult<AIWorkspaceState>> {
  try {
    const data = await readAIWorkspaceData(context.userDataPath, context.workspaceId);
    const now = new Date().toISOString();
    const chat: AIWorkspaceChatData = {
      createdAt: now,
      history: [],
      id: createChatId(),
      operations: [],
      title: input.title?.trim() || "新しいチャット",
      updatedAt: now
    };
    const nextData: AIWorkspaceData = {
      ...data,
      activeChatId: chat.id,
      chats: [chat, ...data.chats]
    };
    await writeAIWorkspaceData(context.userDataPath, context.workspaceId, nextData);

    return ok(await toState(nextData, context.userDataPath));
  } catch (error) {
    return fail("AI_WORKSPACE_CHAT_CREATE_FAILED", "AIチャットを作成できませんでした。", String(error));
  }
}

export async function selectAIWorkspaceChat(
  context: AIWorkspaceContext,
  input: SelectAIWorkspaceChatInput
): Promise<RelicResult<AIWorkspaceState>> {
  try {
    const data = await readAIWorkspaceData(context.userDataPath, context.workspaceId);
    if (!data.chats.some((chat) => chat.id === input.chatId)) {
      return fail("AI_WORKSPACE_CHAT_NOT_FOUND", "選択したAIチャットが見つかりません。");
    }

    const nextData: AIWorkspaceData = {
      ...data,
      activeChatId: input.chatId
    };
    await writeAIWorkspaceData(context.userDataPath, context.workspaceId, nextData);

    return ok(await toState(nextData, context.userDataPath));
  } catch (error) {
    return fail("AI_WORKSPACE_CHAT_SELECT_FAILED", "AIチャットを切り替えられませんでした。", String(error));
  }
}

export async function deleteAIWorkspaceChat(
  context: AIWorkspaceContext,
  input: DeleteAIWorkspaceChatInput
): Promise<RelicResult<AIWorkspaceState>> {
  try {
    const data = await readAIWorkspaceData(context.userDataPath, context.workspaceId);
    const chatIndex = data.chats.findIndex((chat) => chat.id === input.chatId);
    if (chatIndex < 0) {
      return fail("AI_WORKSPACE_CHAT_NOT_FOUND", "削除するAIチャットが見つかりません。");
    }

    const chats = data.chats.filter((chat) => chat.id !== input.chatId);
    const activeChatId = data.activeChatId === input.chatId
      ? chats[Math.max(0, chatIndex - 1)]?.id ?? chats[0]?.id ?? null
      : data.activeChatId && chats.some((chat) => chat.id === data.activeChatId)
        ? data.activeChatId
        : chats[0]?.id ?? null;
    const nextData: AIWorkspaceData = {
      ...data,
      activeChatId,
      chats
    };
    await writeAIWorkspaceData(context.userDataPath, context.workspaceId, nextData);

    return ok(await toState(nextData, context.userDataPath));
  } catch (error) {
    return fail("AI_WORKSPACE_CHAT_DELETE_FAILED", "AIチャットを削除できませんでした。", String(error));
  }
}

export async function previewAIWorkspaceMessage(
  context: AIWorkspaceContext,
  input: PreviewAIWorkspaceMessageInput
): Promise<RelicResult<AIWorkspaceMessagePreview>> {
  const message = input.message.trim();

  if (!message) {
    return fail("AI_WORKSPACE_MESSAGE_EMPTY", "AIに送る内容を入力してください。");
  }

  try {
    const data = await ensureIndexed(context);

    return ok({
      message,
      references: buildReferences(data, message, input.activeFilePath, input.activeFileContent),
      requiresExternalAI: true,
      skippedLargeFiles: data.index.skippedLargeFiles,
      unreadableFiles: data.index.unreadableFiles
    });
  } catch (error) {
    return fail("AI_WORKSPACE_PREVIEW_FAILED", "AIへ送るMarkdown参照を確認できませんでした。", String(error));
  }
}

export async function sendAIWorkspaceMessage(
  context: AIWorkspaceContext,
  input: SendAIWorkspaceMessageInput,
  trashItem?: TrashItem,
  options: { signal?: AbortSignal } = {}
): Promise<RelicResult<AIWorkspaceState>> {
  const message = input.message.trim();
  let userOnlyData: AIWorkspaceData | null = null;

  if (!message) {
    return fail("AI_WORKSPACE_MESSAGE_EMPTY", "AIに送る内容を入力してください。");
  }

  try {
    throwIfAIWorkspaceAborted(options.signal);
    const data = await ensureIndexed(context);
    throwIfAIWorkspaceAborted(options.signal);
    const chat = ensureActiveChat(data, message);
    const references = buildReferences(data, message, input.activeFilePath, input.activeFileContent);
    const userMessage: AIWorkspaceMessage = {
      content: message,
      createdAt: new Date().toISOString(),
      id: createMessageId("user"),
      references: [],
      role: "user"
    };
    const userOnlyChat: AIWorkspaceChatData = {
      ...chat,
      history: [...chat.history, userMessage],
      title: titleForChatAfterUserMessage(chat, message),
      updatedAt: userMessage.createdAt
    };
    userOnlyData = {
      ...data,
      activeChatId: userOnlyChat.id,
      chats: upsertChat(data.chats, userOnlyChat)
    };
    await writeAIWorkspaceData(context.userDataPath, context.workspaceId, userOnlyData);
    throwIfAIWorkspaceAborted(options.signal);

    const settings = await readAppSettings(context.userDataPath);
    const provider = settings.aiSettings.aiProvider;
    const referenceContents = await readReferenceContents(context.workspacePath, references, {
      content: input.activeFileContent ?? null,
      path: input.activeFilePath ?? null
    });
    throwIfAIWorkspaceAborted(options.signal);
    const turnInput = {
      history: chat.history.map((item) => ({ content: item.content, role: item.role })),
      message,
      pendingOperations: [],
      referenceContents,
      references
    } satisfies Omit<Parameters<typeof runOpenAIWorkspaceTurn>[0], "apiKey" | "model">;

    let aiError: string | null = null;
    let aiResponse: AIWorkspaceTurnResult | null = null;

    if (provider === "openai-api") {
      const apiKey = await readOpenAIAPIKey(context.userDataPath);
      if (!apiKey) {
        return fail("AI_WORKSPACE_OPENAI_KEY_MISSING", "OpenAI APIキーをAI設定で登録してください。");
      }

      aiResponse = await runOpenAIWorkspaceTurn({
        ...turnInput,
        apiKey,
        model: settings.aiSettings.openAIModel,
        signal: options.signal
      }).catch((error) => {
        if (isAIWorkspaceAbortError(error, options.signal)) throw error;
        aiError = normalizeAIProviderError(provider, error);
        return null;
      });
    } else {
      aiResponse = await runCodexAIWorkspaceTurn({
        ...turnInput,
        signal: options.signal,
        workspacePath: context.workspacePath
      }).catch((error) => {
        if (isAIWorkspaceAbortError(error, options.signal)) throw error;
        aiError = normalizeAIProviderError(provider, error);
        return null;
      });
    }

    throwIfAIWorkspaceAborted(options.signal);

    const preparedOperations = aiResponse
      ? await prepareOperations(context.workspacePath, aiResponse.operations)
      : { operations: [], rejectedOperations: [] };
    const appliedOperations = await applyPreparedOperations(
      context.workspacePath,
      preparedOperations.operations,
      input.dirtyFilePaths ?? [],
      trashItem
    );
    const assistantMessage: AIWorkspaceMessage = {
      content: aiResponse
        ? buildChatOnlyAssistantMessage(aiResponse.message, preparedOperations.rejectedOperations, appliedOperations)
        : buildAssistantFallback(provider, message, references, aiError),
      createdAt: new Date().toISOString(),
      id: createMessageId("assistant"),
      references,
      role: "assistant"
    };
    const nextData = {
      ...userOnlyData,
      activeChatId: userOnlyChat.id,
      chats: upsertChat(userOnlyData.chats, {
        ...userOnlyChat,
        history: [...userOnlyChat.history, assistantMessage],
        updatedAt: assistantMessage.createdAt
      }),
      index: appliedOperations.applied.length > 0 ? await buildAIWorkspaceIndex(context.workspacePath) : userOnlyData.index,
    };
    await writeAIWorkspaceData(context.userDataPath, context.workspaceId, nextData);

    return ok(await toState(nextData, context.userDataPath));
  } catch (error) {
    if (isAIWorkspaceAbortError(error, options.signal)) {
      if (userOnlyData) {
        return ok(await toState(userOnlyData, context.userDataPath));
      }

      return fail("AI_WORKSPACE_MESSAGE_CANCELLED", "AIの応答生成を中断しました。");
    }

    return fail("AI_WORKSPACE_MESSAGE_FAILED", "Coworkで処理できませんでした。", String(error));
  }
}

async function keepPendingOperations(
  context: AIWorkspaceContext,
  data: AIWorkspaceData,
  message: string
): Promise<RelicResult<AIWorkspaceState>> {
  const chat = activeChat(data);
  const pendingOperations = chat.operations.filter((operation) => operation.status === "pending");
  const assistantMessage: AIWorkspaceMessage = {
    content: buildKeepPendingOperationsMessage(pendingOperations),
    createdAt: new Date().toISOString(),
    id: createMessageId("assistant"),
    references: pendingOperations.map((operation) => ({
      path: operation.path,
      preview: operation.summary
    })),
    role: "assistant"
  };
  const nextData: AIWorkspaceData = {
    ...data,
    activeChatId: chat.id,
    chats: upsertChat(data.chats, {
      ...chat,
      history: [...chat.history, ...buildOptionalUserHistory(message), assistantMessage],
      updatedAt: assistantMessage.createdAt
    })
  };
  await writeAIWorkspaceData(context.userDataPath, context.workspaceId, nextData);

  return ok(await toState(nextData, context.userDataPath));
}

function mergeNewOperations(
  currentOperations: AIWorkspaceFileOperation[],
  newOperations: AIWorkspaceFileOperation[]
): AIWorkspaceFileOperation[] {
  if (newOperations.length === 0) return currentOperations;

  const replacedPaths = new Set(newOperations.map((operation) => operation.path));
  return [
    ...currentOperations.map((operation) => {
      if (operation.status === "pending" && replacedPaths.has(operation.path)) {
        return { ...operation, status: "replaced" as const };
      }

      return operation;
    }),
    ...newOperations
  ];
}

export async function applyAIWorkspaceOperations(
  context: AIWorkspaceContext,
  input: ApplyAIWorkspaceOperationsInput,
  trashItem?: TrashItem
): Promise<RelicResult<AIWorkspaceState>> {
  const data = await readAIWorkspaceData(context.userDataPath, context.workspaceId);
  const chat = activeChat(data);
  const targetIds = new Set(input.operationIds ?? []);
  const targetOperations = chat.operations.filter((operation) => {
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
  const staleIds = new Set<string>();

  for (const operation of targetOperations) {
    const result = await applyOperation(context.workspacePath, operation, trashItem);
    if (result.ok) {
      appliedIds.add(operation.id);
    } else if (result.error.code === "AI_WORKSPACE_STALE_OPERATION") {
      staleIds.add(operation.id);
    } else {
      failedIds.add(operation.id);
    }
  }

  const nextOperations = chat.operations.map((operation) => {
    if (appliedIds.has(operation.id)) return { ...operation, status: "applied" as const };
    if (staleIds.has(operation.id)) return { ...operation, status: "stale" as const };
    if (failedIds.has(operation.id)) return { ...operation, status: "failed" as const };
    return operation;
  });
  const assistantMessage: AIWorkspaceMessage = {
    content: buildApplyOperationsMessage(targetOperations, staleIds, failedIds),
    createdAt: new Date().toISOString(),
    id: createMessageId("assistant"),
    references: targetOperations.map((operation) => ({
      path: operation.path,
      preview: operation.summary
    })),
    role: "assistant"
  };
  const nextData: AIWorkspaceData = {
    ...data,
    activeChatId: chat.id,
    index: await buildAIWorkspaceIndex(context.workspacePath),
    chats: upsertChat(data.chats, {
      ...chat,
      history: [...chat.history, ...buildOptionalUserHistory(input.userMessage), assistantMessage],
      operations: nextOperations,
      updatedAt: assistantMessage.createdAt
    })
  };
  await writeAIWorkspaceData(context.userDataPath, context.workspaceId, nextData);

  return ok(await toState(nextData, context.userDataPath));
}

export async function discardAIWorkspaceOperations(
  context: AIWorkspaceContext,
  input: DiscardAIWorkspaceOperationsInput
): Promise<RelicResult<AIWorkspaceState>> {
  const data = await readAIWorkspaceData(context.userDataPath, context.workspaceId);
  const chat = activeChat(data);
  const targetIds = new Set(input.operationIds ?? []);
  const targetOperations = chat.operations.filter((operation) => {
    if (operation.status !== "pending") return false;
    return targetIds.size === 0 || targetIds.has(operation.id);
  });

  if (targetOperations.length === 0) {
    return fail("AI_WORKSPACE_NO_PENDING_OPERATIONS", "取りやめできるAI変更案がありません。");
  }

  const discardedIds = new Set(targetOperations.map((operation) => operation.id));
  const nextOperations = chat.operations.map((operation) => {
    if (discardedIds.has(operation.id)) return { ...operation, status: "discarded" as const };
    return operation;
  });
  const assistantMessage: AIWorkspaceMessage = {
    content: buildDiscardOperationsMessage(targetOperations),
    createdAt: new Date().toISOString(),
    id: createMessageId("assistant"),
    references: targetOperations.map((operation) => ({
      path: operation.path,
      preview: operation.summary
    })),
    role: "assistant"
  };
  const nextData: AIWorkspaceData = {
    ...data,
    activeChatId: chat.id,
    chats: upsertChat(data.chats, {
      ...chat,
      history: [...chat.history, ...buildOptionalUserHistory(input.userMessage), assistantMessage],
      operations: nextOperations,
      updatedAt: assistantMessage.createdAt
    })
  };
  await writeAIWorkspaceData(context.userDataPath, context.workspaceId, nextData);

  return ok(await toState(nextData, context.userDataPath));
}

async function createRevertOperations(
  context: AIWorkspaceContext,
  data: AIWorkspaceData,
  message: string,
  activeFilePath?: string | null
): Promise<RelicResult<AIWorkspaceState>> {
  const chat = activeChat(data);
  const targetOperations = selectAppliedOperationsForRevert(chat.operations, message, activeFilePath);
  if (targetOperations.length === 0) {
    return fail("AI_WORKSPACE_NO_REVERTABLE_OPERATIONS", "元に戻せるAI変更履歴がありません。");
  }

  const revertOperations: AIWorkspaceFileOperation[] = [];
  for (const operation of targetOperations) {
    const revertOperation = await buildRevertOperation(context.workspacePath, operation);
    if (revertOperation) revertOperations.push(revertOperation);
  }

  if (revertOperations.length === 0) {
    return fail("AI_WORKSPACE_NO_REVERTABLE_OPERATIONS", "元に戻せるAI変更履歴がありません。");
  }

  const userMessage: AIWorkspaceMessage = {
    content: message,
    createdAt: new Date().toISOString(),
    id: createMessageId("user"),
    references: [],
    role: "user"
  };
  const assistantMessage: AIWorkspaceMessage = {
    content: buildRevertOperationsMessage(revertOperations),
    createdAt: new Date().toISOString(),
    id: createMessageId("assistant"),
    operations: revertOperations,
    references: revertOperations.map((operation) => ({
      path: operation.path,
      preview: operation.summary
    })),
    role: "assistant"
  };
  const nextData: AIWorkspaceData = {
    ...data,
    activeChatId: chat.id,
    chats: upsertChat(data.chats, {
      ...chat,
      history: [...chat.history, userMessage, assistantMessage],
      operations: mergeNewOperations(chat.operations, revertOperations),
      updatedAt: assistantMessage.createdAt
    })
  };
  await writeAIWorkspaceData(context.userDataPath, context.workspaceId, nextData);

  return ok(await toState(nextData, context.userDataPath));
}

export async function clearAIWorkspaceState(
  context: AIWorkspaceContext,
  input: ClearAIWorkspaceDataInput
): Promise<RelicResult<AIWorkspaceState>> {
  const includeHistory = input.includeHistory ?? true;
  const includeIndex = input.includeIndex ?? true;

  if (includeHistory && includeIndex) {
    await clearAIWorkspaceData(context.userDataPath, context.workspaceId);
    return ok(await toState(emptyAIWorkspaceData(), context.userDataPath));
  }

  const data = await readAIWorkspaceData(context.userDataPath, context.workspaceId);
  const nextData: AIWorkspaceData = {
    activeChatId: includeHistory ? null : data.activeChatId,
    chats: includeHistory ? [] : data.chats,
    index: includeIndex ? emptyAIWorkspaceData().index : data.index,
  };
  await writeAIWorkspaceData(context.userDataPath, context.workspaceId, nextData);

  return ok(await toState(nextData, context.userDataPath));
}

async function ensureIndexed(context: AIWorkspaceContext): Promise<AIWorkspaceData> {
  const [data, currentSourceHash] = await Promise.all([
    readAIWorkspaceData(context.userDataPath, context.workspaceId),
    computeAIWorkspaceIndexSourceHash(context.workspacePath)
  ]);

  if (data.index.indexedAt && data.index.sourceHash === currentSourceHash) return data;

  const nextData = {
    ...data,
    index: await buildAIWorkspaceIndex(context.workspacePath)
  };
  await writeAIWorkspaceData(context.userDataPath, context.workspaceId, nextData);

  return nextData;
}

async function toState(data: AIWorkspaceData, userDataPath?: string): Promise<AIWorkspaceState> {
  const settings = userDataPath ? await readAppSettings(userDataPath) : null;
  const aiProvider = settings?.aiSettings.aiProvider ?? "codex-app-server";
  const chat = data.chats.find((item) => item.id === data.activeChatId) ?? data.chats[0] ?? null;
  const sortedChats = [...data.chats].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const codexUsage = aiProvider === "codex-app-server"
    ? await readCodexAIWorkspaceUsage().catch(() => null)
    : null;

  return {
    activeChatId: chat?.id ?? null,
    aiProvider,
    chats: sortedChats.map((item) => ({
      createdAt: item.createdAt,
      id: item.id,
      messageCount: item.history.length,
      title: item.title,
      updatedAt: item.updatedAt
    })),
    history: chat?.history ?? [],
    index: {
      chunkCount: data.index.chunks.length,
      indexedAt: data.index.indexedAt,
      indexedFileCount: new Set(data.index.chunks.map((chunk) => chunk.path)).size,
      skippedLargeFiles: data.index.skippedLargeFiles,
      unreadableFiles: data.index.unreadableFiles
    },
    codexUsage,
    openAIAPIKeyConfigured: userDataPath ? await hasOpenAIAPIKey(userDataPath) : false,
    operationHistory: chat?.operations ?? [],
    pendingOperations: chat?.operations.filter((operation) => operation.status === "pending") ?? []
  };
}

function buildReferences(
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

function activeChat(data: AIWorkspaceData): AIWorkspaceChatData {
  return data.chats.find((chat) => chat.id === data.activeChatId) ?? data.chats[0] ?? emptyChat();
}

function ensureActiveChat(data: AIWorkspaceData, firstMessage: string): AIWorkspaceChatData {
  const existing = data.chats.find((chat) => chat.id === data.activeChatId) ?? data.chats[0];
  if (existing) return existing;

  const now = new Date().toISOString();
  return {
    createdAt: now,
    history: [],
    id: createChatId(),
    operations: [],
    title: titleFromMessage(firstMessage),
    updatedAt: now
  };
}

function emptyChat(): AIWorkspaceChatData {
  const now = new Date().toISOString();
  return {
    createdAt: now,
    history: [],
    id: createChatId(),
    operations: [],
    title: "新しいチャット",
    updatedAt: now
  };
}

function upsertChat(chats: AIWorkspaceChatData[], chat: AIWorkspaceChatData): AIWorkspaceChatData[] {
  const exists = chats.some((item) => item.id === chat.id);
  if (!exists) return [chat, ...chats];

  return chats.map((item) => item.id === chat.id ? chat : item);
}

function titleForChatAfterUserMessage(chat: AIWorkspaceChatData, message: string): string {
  if (chat.title && chat.title !== "新しいチャット") return chat.title;
  return titleFromMessage(message);
}

function titleFromMessage(message: string): string {
  const normalized = message.replace(/\s+/g, " ").trim();
  if (!normalized) return "新しいチャット";
  return normalized.length > 28 ? `${normalized.slice(0, 28)}…` : normalized;
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

async function readReferenceContents(
  workspacePath: string,
  references: AIWorkspaceReference[],
  activeFile?: { content: string | null; path: string | null }
): Promise<Array<{ content: string; path: string }>> {
  const uniquePaths = [...new Set(references.map((reference) => reference.path))];
  const contents: Array<{ content: string; path: string }> = [];

  for (const path of uniquePaths) {
    const activeContent = usableActiveFileContent(activeFile?.content);
    const activePath = usableActiveFilePath(activeFile?.path);
    if (activePath && activeContent && normalizeOperationText(path) === normalizeOperationText(activePath)) {
      contents.push({ content: activeContent, path });
      continue;
    }

    const file = await readMarkdownFile(workspacePath, path);
    if (file.ok) {
      contents.push({ content: file.value.content, path });
    }
  }

  return contents;
}

function previewMarkdownContent(content: string, fallbackPath: string): string {
  return content.split("\n").find((line) => line.trim())?.trim().slice(0, 160) ?? fallbackPath;
}

function usableActiveFileContent(content?: string | null): string | null {
  if (content === undefined || content === null) return null;
  if (Buffer.byteLength(content, "utf8") > workspaceSearchMaxFileBytes) return null;
  return content;
}

function usableActiveFilePath(filePath?: string | null): string | null {
  if (!filePath) return null;
  const normalizedPath = normalizeWorkspaceRelativeInputPath(filePath);
  if (!normalizedPath || path.posix.extname(normalizedPath) !== ".md") return null;
  return normalizedPath;
}

async function applyOperation(
  workspacePath: string,
  operation: AIWorkspaceFileOperation,
  trashItem?: TrashItem
): Promise<RelicResult<void>> {
  if (operation.kind === "create") {
    const created = await createMarkdownFileAtPath(workspacePath, operation.path, operation.content ?? "");
    if (!created.ok) return created;
    return ok(undefined);
  }

  const currentFile = await readMarkdownFile(workspacePath, operation.path);
  if (!currentFile.ok) return currentFile;

  if (operation.baseContentHash && hashContent(currentFile.value.content) !== operation.baseContentHash) {
    return fail(
      "AI_WORKSPACE_STALE_OPERATION",
      "AI変更案の作成後に対象Markdownが変更されています。"
    );
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

async function prepareOperations(
  workspacePath: string,
  operations: AIWorkspaceFileOperation[]
): Promise<PreparedAIWorkspaceOperations> {
  const nextOperations: AIWorkspaceFileOperation[] = [];
  const rejectedOperations: RejectedAIWorkspaceOperation[] = [];

  for (const operation of operations) {
    const pathResult = validateOperationPath(workspacePath, operation.path);
    if (!pathResult.ok) {
      rejectedOperations.push({ path: operation.path, reason: pathResult.error.message });
      continue;
    }

    if (operation.kind === "create") {
      const existingFile = await readMarkdownFile(workspacePath, pathResult.value);
      if (existingFile.ok) {
        rejectedOperations.push({
          path: pathResult.value,
          reason: "同じパスのMarkdownがすでにあるため、新規作成案としては採用しませんでした。"
        });
        continue;
      }

      nextOperations.push({ ...operation, path: pathResult.value });
      continue;
    }

    const file = await readMarkdownFile(workspacePath, pathResult.value);
    if (!file.ok) {
      rejectedOperations.push({ path: pathResult.value, reason: file.error.message });
      continue;
    }

    nextOperations.push({
      ...operation,
      baseContent: file.value.content,
      baseContentHash: hashContent(file.value.content),
      path: pathResult.value
    });
  }

  return { operations: nextOperations, rejectedOperations };
}

async function applyPreparedOperations(
  workspacePath: string,
  operations: AIWorkspaceFileOperation[],
  dirtyFilePaths: string[],
  trashItem?: TrashItem
): Promise<AppliedAIWorkspaceOperations> {
  const dirtyPathSet = new Set(dirtyFilePaths);
  const result: AppliedAIWorkspaceOperations = {
    applied: [],
    blockedDirtyPaths: [],
    failed: [],
    stale: []
  };

  for (const operation of operations) {
    if (operation.kind !== "create" && dirtyPathSet.has(operation.path)) {
      result.blockedDirtyPaths.push(operation.path);
      continue;
    }

    const applied = await applyOperation(workspacePath, operation, trashItem);
    if (applied.ok) {
      result.applied.push(operation);
    } else if (applied.error.code === "AI_WORKSPACE_STALE_OPERATION") {
      result.stale.push(operation);
    } else {
      result.failed.push(operation);
    }
  }

  return result;
}

function validateOperationPath(workspacePath: string, operationPath: string): RelicResult<string> {
  const normalizedPath = operationPath.replace(/\\/g, "/").trim();
  if (!normalizedPath || normalizedPath.includes("\0") || path.extname(normalizedPath) !== ".md") {
    return fail("AI_WORKSPACE_OPERATION_PATH_INVALID", "AI変更案はMarkdownファイルだけを対象にできます。");
  }

  const relativePath = operationRelativePath(workspacePath, normalizedPath);
  if (!relativePath.ok) return relativePath;

  if (relativePath.value.split("/").includes("..")) {
    return fail("AI_WORKSPACE_OPERATION_PATH_INVALID", "AI変更案のパスがワークスペース外を指しています。");
  }

  const resolved = resolveWorkspaceRelativePath(workspacePath, relativePath.value);
  if (!resolved.ok) return resolved;

  return ok(relativePath.value);
}

function operationRelativePath(workspacePath: string, normalizedPath: string): RelicResult<string> {
  if (path.isAbsolute(normalizedPath)) {
    const relativePath = path.relative(workspacePath, normalizedPath);
    if (relativePath === "" || relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
      return fail("AI_WORKSPACE_OPERATION_PATH_INVALID", "AI変更案のパスがワークスペース外を指しています。");
    }

    return ok(relativePath.split(path.sep).join("/"));
  }

  if (path.win32.isAbsolute(normalizedPath)) {
    return fail("AI_WORKSPACE_OPERATION_PATH_INVALID", "AI変更案のパスがワークスペース外を指しています。");
  }

  return ok(normalizedPath);
}

function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function shouldApplyPendingOperations(message: string): boolean {
  return /(反映|適用|実行|保存|やって|進めて)/.test(message) &&
    !/(しない|やめ|不要|キャンセル|まだ)/.test(message);
}

function shouldHoldPendingOperations(message: string): boolean {
  return /((まだ|今は|あとで|後で).*(反映|適用|実行|保存).*(しない|しないで|しなくていい)|(反映|適用|実行|保存).*(まだ|今は|あとで|後で).*(しない|しないで|しなくていい))/.test(message);
}

function shouldDiscardPendingOperations(message: string): boolean {
  return /(やめ|取りやめ|不要|キャンセル|破棄|なしにして)/.test(message);
}

function shouldRevertAppliedOperations(message: string): boolean {
  return /(戻し|戻して|元に戻|取り消し|巻き戻)/.test(message);
}

function selectPendingOperationIdsFromMessage(
  operations: AIWorkspaceFileOperation[],
  message: string,
  activeFilePath?: string | null
): string[] | undefined {
  const pendingOperations = operations.filter((operation) => operation.status === "pending");
  const normalizedMessage = normalizeOperationText(message);
  const normalizedActiveFilePath = activeFilePath ? normalizeOperationText(activeFilePath) : "";

  if (hasCurrentFileReference(message)) {
    if (!normalizedActiveFilePath) return ["__ai_workspace_no_matching_active_file__"];

    const activeOperationIds: string[] = [];
    for (const operation of pendingOperations) {
      if (normalizeOperationText(operation.path) === normalizedActiveFilePath) {
        activeOperationIds.push(operation.id);
      }
    }

    return activeOperationIds.length > 0 ? activeOperationIds : ["__ai_workspace_no_matching_active_file__"];
  }

  const matchedIds: string[] = [];
  for (const operation of pendingOperations) {
    const matchesPath = operationPathCandidates(operation.path).some((candidate) => {
      const normalizedCandidate = normalizeOperationText(candidate);
      return normalizedCandidate.length >= 2 && normalizedMessage.includes(normalizedCandidate);
    });

    if (matchesPath) {
      matchedIds.push(operation.id);
    }
  }

  return matchedIds.length > 0 ? matchedIds : undefined;
}

function selectAppliedOperationsForRevert(
  operations: AIWorkspaceFileOperation[],
  message: string,
  activeFilePath?: string | null
): AIWorkspaceFileOperation[] {
  const appliedOperations = [...operations].reverse().filter((operation) => operation.status === "applied");
  const normalizedActiveFilePath = activeFilePath ? normalizeOperationText(activeFilePath) : "";

  if (hasCurrentFileReference(message) && normalizedActiveFilePath) {
    return appliedOperations.filter((operation) => normalizeOperationText(operation.path) === normalizedActiveFilePath).slice(0, 1);
  }

  const matchedOperations = appliedOperations.filter((operation) => operationPathCandidates(operation.path).some((candidate) => {
    const normalizedCandidate = normalizeOperationText(candidate);
    return normalizedCandidate.length >= 2 && normalizeOperationText(message).includes(normalizedCandidate);
  }));
  if (matchedOperations.length > 0) return matchedOperations.slice(0, 1);

  return appliedOperations.slice(0, 1);
}

async function buildRevertOperation(
  workspacePath: string,
  operation: AIWorkspaceFileOperation
): Promise<AIWorkspaceFileOperation | null> {
  if (operation.kind === "update" && operation.baseContent !== undefined) {
    const file = await readMarkdownFile(workspacePath, operation.path);
    if (!file.ok) return null;

    return {
      baseContent: file.value.content,
      baseContentHash: hashContent(file.value.content),
      content: operation.baseContent,
      createdAt: new Date().toISOString(),
      id: createMessageId("revert-update"),
      kind: "update",
      path: operation.path,
      status: "pending",
      summary: "AI変更を元のMarkdown本文へ戻す"
    };
  }

  if (operation.kind === "create") {
    const file = await readMarkdownFile(workspacePath, operation.path);
    if (!file.ok) return null;

    return {
      baseContentHash: hashContent(file.value.content),
      createdAt: new Date().toISOString(),
      id: createMessageId("revert-create"),
      kind: "delete",
      path: operation.path,
      status: "pending",
      summary: "AIが作成したMarkdownを削除して元に戻す"
    };
  }

  if (operation.kind === "delete" && operation.baseContent !== undefined) {
    const existingFile = await readMarkdownFile(workspacePath, operation.path);
    if (existingFile.ok) return null;

    return {
      content: operation.baseContent,
      createdAt: new Date().toISOString(),
      id: createMessageId("revert-delete"),
      kind: "create",
      path: operation.path,
      status: "pending",
      summary: "AIが削除したMarkdownを元の本文で再作成する"
    };
  }

  return null;
}

function hasCurrentFileReference(message: string): boolean {
  return /(このファイル|現在のファイル|開いているファイル|今のファイル)/.test(message);
}

function operationPathCandidates(operationPath: string): string[] {
  const normalizedPath = operationPath.replace(/\\/g, "/");
  const fileName = path.posix.basename(normalizedPath);
  const extension = path.posix.extname(fileName);
  const stem = extension ? fileName.slice(0, -extension.length) : fileName;

  return [normalizedPath, fileName, stem];
}

function normalizeOperationText(value: string): string {
  return value
    .replace(/\\/g, "/")
    .replace(/[「」『』（）()[\]{}"'`、。，．\s]/g, "")
    .toLowerCase();
}

function buildApplyOperationsMessage(
  operations: AIWorkspaceFileOperation[],
  staleIds: Set<string>,
  failedIds: Set<string>
): string {
  const header = staleIds.size > 0
    ? "一部のAI変更案は、作成後に対象Markdownが変更されていたため反映しませんでした。現在の内容をもとに、もう一度依頼してください。"
    : failedIds.size > 0
      ? "一部のAI変更案を反映できませんでした。対象ファイルの状態を確認してから、もう一度依頼してください。"
      : "AI変更案をMarkdownへ反映しました。";

  return [header, "", ...operationResultLines(operations, staleIds, failedIds)].join("\n").trim();
}

function buildDiscardOperationsMessage(operations: AIWorkspaceFileOperation[]): string {
  return [
    "AI変更案を取りやめました。Markdownファイルには反映していません。",
    "",
    ...operations.map((operation) => `- ${operation.path}`)
  ].join("\n").trim();
}

function buildKeepPendingOperationsMessage(operations: AIWorkspaceFileOperation[]): string {
  return [
    "AI変更案はまだ反映せず、作業中の変更として残しました。",
    "",
    ...operations.map((operation) => `- ${operation.path}`)
  ].join("\n").trim();
}

function buildRevertOperationsMessage(operations: AIWorkspaceFileOperation[]): string {
  return [
    "反映済みのAI変更を元に戻す変更案を作成しました。まだMarkdownファイルには反映していません。",
    "",
    ...operations.map((operation) => `- ${operation.path}`)
  ].join("\n").trim();
}

function operationResultLines(
  operations: AIWorkspaceFileOperation[],
  staleIds: Set<string>,
  failedIds: Set<string>
): string[] {
  return operations.map((operation) => {
    if (staleIds.has(operation.id)) return `- 再作業が必要: ${operation.path}`;
    if (failedIds.has(operation.id)) return `- 失敗: ${operation.path}`;
    return `- 反映済み: ${operation.path}`;
  });
}

function blockedDirtyPaths(
  operations: AIWorkspaceFileOperation[],
  dirtyFilePaths: string[]
): string[] {
  const dirtyPathSet = new Set(dirtyFilePaths);
  const blockedPaths = new Set<string>();

  for (const operation of operations) {
    if (operation.kind !== "create" && dirtyPathSet.has(operation.path)) {
      blockedPaths.add(operation.path);
    }
  }

  return [...blockedPaths];
}

function buildAssistantFallback(
  provider: AIProvider,
  message: string,
  references: AIWorkspaceReference[],
  aiError: string | null
): string {
  if (aiError) {
    const files = references.map((reference) => `- ${reference.path}`).join("\n");
    const providerMessage = provider === "openai-api"
      ? "OpenAI APIでAI処理を完了できませんでした。"
      : "Codex App ServerでAI処理を完了できませんでした。";
    const nextStep = provider === "openai-api"
      ? "OpenAI APIキー、課金状態、利用上限、ネットワーク接続を確認してください。"
      : "Codexアプリが利用できる状態か確認してください。利用できない場合は、設定のAI接続方式をOpenAI APIへ切り替えることもできます。";

    return [
      providerMessage,
      "そのため、今回はローカルのMarkdown検索結果だけを表示しています。Markdownの作成・編集・削除案は作っていません。",
      nextStep,
      "",
      files ? `関連しそうなMarkdown:\n${files}` : "関連しそうなMarkdownは見つかりませんでした。",
      "",
      `受け取った依頼: ${message}`,
      "",
      `失敗理由: ${aiError}`
    ].join("\n");
  }

  if (references.length === 0) {
    return [
      "ワークスペース内のMarkdownを確認しましたが、この内容に直接一致する参照はまだ見つかりませんでした。",
      "Markdown変更案は作っていません。"
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
    "Markdown変更案は作っていません。"
  ].join("\n");
}

function normalizeAIProviderError(provider: AIProvider, error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (provider !== "openai-api") return message;

  const lower = message.toLowerCase();
  if (lower.includes("quota") || lower.includes("billing") || lower.includes("insufficient_quota")) {
    return "OpenAI APIの利用枠または請求設定を確認してください。APIの残高不足、利用上限、請求設定が原因の可能性があります。";
  }
  if (lower.includes("rate limit") || lower.includes("rate_limit")) {
    return "OpenAI APIの利用が一時的に集中しています。少し時間を置いてからもう一度お試しください。";
  }

  return message;
}

function throwIfAIWorkspaceAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new Error("Cowork処理を中断しました。");
  }
}

function isAIWorkspaceAbortError(error: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) return true;
  if (typeof DOMException !== "undefined" && error instanceof DOMException && error.name === "AbortError") return true;
  return error instanceof Error && error.message.includes("Cowork処理を中断しました");
}

function buildChatOnlyAssistantMessage(
  content: string,
  rejectedOperations: RejectedAIWorkspaceOperation[],
  appliedOperations: AppliedAIWorkspaceOperations
): string {
  const lines = [content.trim()];

  if (appliedOperations.applied.length > 0) {
    lines.push(
      "",
      "Markdownへ反映しました。",
      ...appliedOperations.applied.map((operation) => `- ${operation.path}`)
    );
  }

  if (appliedOperations.blockedDirtyPaths.length > 0) {
    lines.push(
      "",
      "未保存のMarkdownがあるため、次の変更は反映しませんでした。先に保存または破棄してください。",
      ...[...new Set(appliedOperations.blockedDirtyPaths)].map((path) => `- ${path}`)
    );
  }

  if (appliedOperations.stale.length > 0) {
    lines.push(
      "",
      "AIが考えている間に対象Markdownが変わったため、次の変更は反映しませんでした。",
      ...appliedOperations.stale.map((operation) => `- ${operation.path}`)
    );
  }

  if (appliedOperations.failed.length > 0) {
    lines.push(
      "",
      "次のMarkdown変更は反映できませんでした。",
      ...appliedOperations.failed.map((operation) => `- ${operation.path}`)
    );
  }

  if (rejectedOperations.length > 0) {
    lines.push(
      "",
      "安全のため採用しなかった変更があります。",
      ...rejectedOperations.map((operation) => `- ${operation.path}: ${operation.reason}`)
    );
  }

  return lines.join("\n").trim();
}

function buildOptionalUserHistory(message?: string): AIWorkspaceMessage[] {
  const content = message?.trim();
  if (!content) return [];

  return [{
    content,
    createdAt: new Date().toISOString(),
    id: createMessageId("user"),
    references: [],
    role: "user"
  }];
}

function createMessageId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createChatId(): string {
  return createMessageId("chat");
}
