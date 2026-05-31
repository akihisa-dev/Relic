import type { AIWorkspaceState } from "../../shared/ipc";
import { hasOpenAIAPIKey } from "./openAIKeyStore";
import { readAppSettings } from "../settings/appSettings";
import { readCodexAIWorkspaceUsage } from "./codexAppServerClient";
import type { AIWorkspaceData } from "./aiWorkspaceData";

export async function toAIWorkspaceState(data: AIWorkspaceData, userDataPath?: string): Promise<AIWorkspaceState> {
  const settings = userDataPath ? await readAppSettings(userDataPath) : null;
  const aiProvider = settings?.aiSettings.aiProvider ?? "codex-app-server";
  const chat = data.chats.find((item) => item.id === data.activeChatId) ?? data.chats[0] ?? null;
  const sortedChats = data.chats.toSorted((a, b) => b.updatedAt.localeCompare(a.updatedAt));
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
