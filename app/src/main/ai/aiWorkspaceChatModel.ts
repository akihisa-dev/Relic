import type { AIWorkspaceMessage } from "../../shared/ipc";
import type { AIWorkspaceChatData, AIWorkspaceData } from "./aiWorkspaceData";

export function activeChat(data: AIWorkspaceData): AIWorkspaceChatData {
  return data.chats.find((chat) => chat.id === data.activeChatId) ?? data.chats[0] ?? emptyChat();
}

export function ensureActiveChat(data: AIWorkspaceData, firstMessage: string): AIWorkspaceChatData {
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

export function emptyChat(): AIWorkspaceChatData {
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

export function upsertChat(chats: AIWorkspaceChatData[], chat: AIWorkspaceChatData): AIWorkspaceChatData[] {
  const exists = chats.some((item) => item.id === chat.id);
  if (!exists) return [chat, ...chats];

  return chats.map((item) => item.id === chat.id ? chat : item);
}

export function titleForChatAfterUserMessage(chat: AIWorkspaceChatData, message: string): string {
  if (chat.title && chat.title !== "新しいチャット") return chat.title;
  return titleFromMessage(message);
}

export function titleFromMessage(message: string): string {
  const normalized = message.replace(/\s+/g, " ").trim();
  if (!normalized) return "新しいチャット";
  return normalized.length > 28 ? `${normalized.slice(0, 28)}…` : normalized;
}

export function buildOptionalUserHistory(message?: string): AIWorkspaceMessage[] {
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

export function createMessageId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createChatId(): string {
  return createMessageId("chat");
}
