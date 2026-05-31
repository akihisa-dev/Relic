import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, vi } from "vitest";

import { writeAIWorkspaceData, type AIWorkspaceChatData, type AIWorkspaceData } from "./aiWorkspaceData";
import { readCodexAIWorkspaceUsage, runCodexAIWorkspaceTurn } from "./codexAppServerClient";
import { readOpenAIAPIKey } from "./openAIKeyStore";
import { runOpenAIWorkspaceTurn } from "./openAIResponsesClient";
import { getAppSettingsPath } from "../settings/appSettings";

export let userDataPath = "";
export let workspacePath = "";

export function setupAIWorkspaceServiceTest(): void {
  beforeEach(async () => {
    userDataPath = await mkdtemp(path.join(os.tmpdir(), "relic-ai-user-data-"));
    workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-ai-workspace-"));
    vi.mocked(runOpenAIWorkspaceTurn).mockReset();
    vi.mocked(runCodexAIWorkspaceTurn).mockReset();
    vi.mocked(readCodexAIWorkspaceUsage).mockResolvedValue(null);
    vi.mocked(readOpenAIAPIKey).mockResolvedValue("sk-test-openai-key");
  });

  afterEach(async () => {
    await rm(userDataPath, { force: true, recursive: true });
    await rm(workspacePath, { force: true, recursive: true });
  });
}

export function context() {
  return {
    userDataPath,
    workspaceId: "workspace",
    workspacePath
  };
}

type AIWorkspaceDataTestPartial = Partial<AIWorkspaceData> & Pick<Partial<AIWorkspaceChatData>, "history" | "operations">;

export async function writeData(partial: AIWorkspaceDataTestPartial): Promise<void> {
  const now = "2026-05-30T00:00:00.000Z";
  const history = partial.history ?? [];
  const operations = partial.operations ?? [];
  const { activeChatId, index } = partial;
  const chats = partial.chats ?? [{
    createdAt: now,
    history,
    id: "chat-1",
    operations,
    title: "テストチャット",
    updatedAt: now
  }];

  await writeAIWorkspaceData(userDataPath, "workspace", {
    activeChatId: activeChatId ?? chats[0]?.id ?? null,
    chats,
    index: index ?? {
      chunks: [],
      indexedAt: null,
      skippedLargeFiles: [],
      sourceHash: null,
      unreadableFiles: []
    }
  });
}

export async function writeAISettings(settings: { aiProvider: "codex-app-server" | "openai-api"; openAIModel?: string }): Promise<void> {
  await writeFile(getAppSettingsPath(userDataPath), JSON.stringify({
    aiSettings: {
      aiProvider: settings.aiProvider,
      openAIModel: settings.openAIModel ?? "gpt-5.4-mini"
    }
  }), "utf8");
}

export function createOperation(
  kind: "create" | "update" | "delete",
  filePath: string,
  content?: string
) {
  return {
    content,
    createdAt: "2026-05-30T00:00:00.000Z",
    id: `${kind}-${filePath}`,
    kind,
    path: filePath,
    status: "pending" as const,
    summary: `${kind} ${filePath}`
  };
}

export function createChat(
  id: string,
  title: string,
  operations: ReturnType<typeof createOperation>[] = []
): AIWorkspaceChatData {
  return {
    createdAt: "2026-05-30T00:00:00.000Z",
    history: [],
    id,
    operations,
    title,
    updatedAt: "2026-05-30T00:00:00.000Z"
  };
}

export function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}
