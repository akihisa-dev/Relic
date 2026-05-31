import type {
  AIWorkspaceMessage,
  AIWorkspaceState,
  ApplyAIWorkspaceOperationsInput,
  ClearAIWorkspaceDataInput,
  CreateAIWorkspaceChatInput,
  DeleteAIWorkspaceChatInput,
  DiscardAIWorkspaceOperationsInput,
  PreviewAIWorkspaceMessageInput,
  AIWorkspaceMessagePreview,
  SelectAIWorkspaceChatInput,
  SendAIWorkspaceMessageInput
} from "../../shared/ipc";
import { fail, ok, type RelicResult } from "../../shared/result";
import { readAppSettings } from "../settings/appSettings";
import { type TrashItem } from "../files/trash";
import { buildAIWorkspaceIndex, collectAIWorkspaceMarkdownPaths, computeAIWorkspaceIndexSourceHash } from "./aiWorkspaceIndex";
import {
  clearAIWorkspaceData,
  emptyAIWorkspaceData,
  readAIWorkspaceData,
  repairAIWorkspaceData,
  writeAIWorkspaceData,
  type AIWorkspaceChatData,
  type AIWorkspaceData
} from "./aiWorkspaceData";
import { readOpenAIAPIKey } from "./openAIKeyStore";
import { runCodexAIWorkspaceTurn } from "./codexAppServerClient";
import { runOpenAIWorkspaceTurn } from "./openAIResponsesClient";
import {
  activeChat,
  buildOptionalUserHistory,
  createChatId,
  createMessageId,
  ensureActiveChat,
  titleForChatAfterUserMessage,
  upsertChat
} from "./aiWorkspaceChatModel";
import { isAIWorkspaceAbortError, throwIfAIWorkspaceAborted } from "./aiWorkspaceAbort";
import {
  applyOperation,
  applyPreparedOperations,
  blockedDirtyPaths,
  prepareOperations
} from "./aiWorkspaceOperations";
import { buildReferences, readReferenceContents } from "./aiWorkspaceReferences";
import {
  buildApplyOperationsMessage,
  buildAssistantFallback,
  buildChatOnlyAssistantMessage,
  buildDiscardOperationsMessage,
  normalizeAIProviderError
} from "./aiWorkspaceMessages";
import { toAIWorkspaceState } from "./aiWorkspaceStateMapper";
import type { AIWorkspaceContext, AIWorkspaceTurnResult } from "./aiWorkspaceServiceTypes";

export type { AIWorkspaceContext } from "./aiWorkspaceServiceTypes";

export async function getAIWorkspaceState(context: AIWorkspaceContext): Promise<RelicResult<AIWorkspaceState>> {
  try {
    const data = await ensureIndexed(context);

    return ok(await toAIWorkspaceState(data, context.userDataPath));
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

    return ok(await toAIWorkspaceState(nextData, context.userDataPath));
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

    return ok(await toAIWorkspaceState(nextData, context.userDataPath));
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

    return ok(await toAIWorkspaceState(nextData, context.userDataPath));
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

    return ok(await toAIWorkspaceState(nextData, context.userDataPath));
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
    const dataWithUserMessage: AIWorkspaceData = {
      ...data,
      activeChatId: userOnlyChat.id,
      chats: upsertChat(data.chats, userOnlyChat)
    };
    userOnlyData = dataWithUserMessage;
    await writeAIWorkspaceData(context.userDataPath, context.workspaceId, dataWithUserMessage);
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
      ...dataWithUserMessage,
      activeChatId: userOnlyChat.id,
      chats: upsertChat(dataWithUserMessage.chats, {
        ...userOnlyChat,
        history: [...userOnlyChat.history, assistantMessage],
        updatedAt: assistantMessage.createdAt
      }),
      index: appliedOperations.applied.length > 0 ? await buildAIWorkspaceIndex(context.workspacePath) : dataWithUserMessage.index
    };
    await writeAIWorkspaceData(context.userDataPath, context.workspaceId, nextData);

    return ok(await toAIWorkspaceState(nextData, context.userDataPath));
  } catch (error) {
    if (isAIWorkspaceAbortError(error, options.signal)) {
      if (userOnlyData) {
        return ok(await toAIWorkspaceState(userOnlyData, context.userDataPath));
      }

      return fail("AI_WORKSPACE_MESSAGE_CANCELLED", "AIの応答生成を中断しました。");
    }

    return fail("AI_WORKSPACE_MESSAGE_FAILED", "Coworkで処理できませんでした。", String(error));
  }
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

  return ok(await toAIWorkspaceState(nextData, context.userDataPath));
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

  return ok(await toAIWorkspaceState(nextData, context.userDataPath));
}

export async function clearAIWorkspaceState(
  context: AIWorkspaceContext,
  input: ClearAIWorkspaceDataInput
): Promise<RelicResult<AIWorkspaceState>> {
  const includeHistory = input.includeHistory ?? true;
  const includeIndex = input.includeIndex ?? true;

  if (includeHistory && includeIndex) {
    await clearAIWorkspaceData(context.userDataPath, context.workspaceId);
    return ok(await toAIWorkspaceState(emptyAIWorkspaceData(), context.userDataPath));
  }

  const data = await readAIWorkspaceData(context.userDataPath, context.workspaceId);
  const nextData: AIWorkspaceData = {
    activeChatId: includeHistory ? null : data.activeChatId,
    chats: includeHistory ? [] : data.chats,
    index: includeIndex ? emptyAIWorkspaceData().index : data.index
  };
  await writeAIWorkspaceData(context.userDataPath, context.workspaceId, nextData);

  return ok(await toAIWorkspaceState(nextData, context.userDataPath));
}

async function ensureIndexed(context: AIWorkspaceContext): Promise<AIWorkspaceData> {
  const [data, currentSourceHash, currentMarkdownPaths] = await Promise.all([
    readAIWorkspaceData(context.userDataPath, context.workspaceId),
    computeAIWorkspaceIndexSourceHash(context.workspacePath),
    collectAIWorkspaceMarkdownPaths(context.workspacePath)
  ]);
  const repairedData = repairAIWorkspaceData(data, currentMarkdownPaths);

  if (repairedData.index.indexedAt && repairedData.index.sourceHash === currentSourceHash) {
    if (!isSameAIWorkspaceData(data, repairedData)) {
      await writeAIWorkspaceData(context.userDataPath, context.workspaceId, repairedData);
    }
    return repairedData;
  }

  const nextData = {
    ...repairedData,
    index: await buildAIWorkspaceIndex(context.workspacePath)
  };
  await writeAIWorkspaceData(context.userDataPath, context.workspaceId, nextData);

  return nextData;
}

function isSameAIWorkspaceData(left: AIWorkspaceData, right: AIWorkspaceData): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
