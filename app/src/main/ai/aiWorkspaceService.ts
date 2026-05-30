import { existsSync } from "node:fs";

import type {
  AIWorkspaceMessage,
  AIWorkspaceReference,
  AIWorkspaceState,
  ClearAIWorkspaceDataInput,
  SendAIWorkspaceMessageInput
} from "../../shared/ipc";
import { fail, ok, type RelicResult } from "../../shared/result";
import { buildAIWorkspaceIndex, searchAIWorkspaceChunks } from "./aiWorkspaceIndex";
import {
  clearAIWorkspaceData,
  emptyAIWorkspaceData,
  readAIWorkspaceData,
  writeAIWorkspaceData,
  type AIWorkspaceData
} from "./aiWorkspaceData";

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
  input: SendAIWorkspaceMessageInput
): Promise<RelicResult<AIWorkspaceState>> {
  const message = input.message.trim();

  if (!message) {
    return fail("AI_WORKSPACE_MESSAGE_EMPTY", "AIに送る内容を入力してください。");
  }

  try {
    const data = await ensureIndexed(context);
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
    const assistantMessage: AIWorkspaceMessage = {
      content: buildAssistantPlaceholder(message, references),
      createdAt: new Date().toISOString(),
      id: createMessageId("assistant"),
      references,
      role: "assistant"
    };
    const nextData = {
      ...data,
      history: [...data.history, userMessage, assistantMessage]
    };
    await writeAIWorkspaceData(context.userDataPath, context.workspaceId, nextData);

    return ok(toState(nextData));
  } catch (error) {
    return fail("AI_WORKSPACE_MESSAGE_FAILED", "AI Workspaceで処理できませんでした。", String(error));
  }
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
    index: includeIndex ? emptyAIWorkspaceData().index : data.index
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
    }
  };
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
