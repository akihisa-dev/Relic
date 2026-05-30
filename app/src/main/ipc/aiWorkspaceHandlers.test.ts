import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

const electronMock = vi.hoisted(() => ({
  handle: vi.fn(),
  trashItem: vi.fn()
}));

const activeWorkspaceMock = vi.hoisted(() => ({
  getActiveWorkspaceContext: vi.fn()
}));

const aiWorkspaceServiceMock = vi.hoisted(() => ({
  applyAIWorkspaceOperations: vi.fn(),
  clearAIWorkspaceState: vi.fn(),
  discardAIWorkspaceOperations: vi.fn(),
  getAIWorkspaceState: vi.fn(),
  previewAIWorkspaceMessage: vi.fn(),
  rebuildAIWorkspaceIndex: vi.fn(),
  sendAIWorkspaceMessage: vi.fn()
}));

vi.mock("electron", () => ({
  app: { getPath: vi.fn(() => "/tmp/relic-user-data") },
  ipcMain: { handle: electronMock.handle },
  safeStorage: {
    decryptString: vi.fn(),
    encryptString: vi.fn(),
    isEncryptionAvailable: vi.fn(() => true)
  },
  shell: { trashItem: electronMock.trashItem }
}));

vi.mock("./activeWorkspace", () => ({
  getActiveWorkspaceContext: activeWorkspaceMock.getActiveWorkspaceContext,
  ipcErrorDetails: (error: unknown) => String(error)
}));

vi.mock("../ai/aiWorkspaceService", () => aiWorkspaceServiceMock);

import {
  applyAIWorkspaceOperationsChannel,
  saveAIModelChannel,
  sendAIWorkspaceMessageChannel,
  workspaceChangedChannel,
  type AIWorkspaceState
} from "../../shared/ipc";
import { registerAIWorkspaceHandlers } from "./aiWorkspaceHandlers";
import { readAppSettings } from "../settings/appSettings";

afterEach(() => {
  vi.clearAllMocks();
});

describe("registerAIWorkspaceHandlers", () => {
  it("notifies workspace changes when a chat message applies a pending operation", async () => {
    const sender = { send: vi.fn() };
    const beforeState = createAIWorkspaceState("pending");
    const afterState = createAIWorkspaceState("applied");
    activeWorkspaceMock.getActiveWorkspaceContext.mockResolvedValue({
      ok: true,
      value: {
        activeWorkspace: { id: "workspace-1", path: "/tmp/notes" },
        userDataPath: "/tmp/relic-user-data"
      }
    });
    aiWorkspaceServiceMock.getAIWorkspaceState.mockResolvedValue({ ok: true, value: beforeState });
    aiWorkspaceServiceMock.sendAIWorkspaceMessage.mockResolvedValue({ ok: true, value: afterState });

    registerAIWorkspaceHandlers();
    const handler = electronMock.handle.mock.calls.find(([channel]) => channel === sendAIWorkspaceMessageChannel)?.[1];
    if (!handler) throw new Error("sendAIWorkspaceMessage handler was not registered");

    const result = await handler({ sender }, { message: "それ反映して" });

    expect(result).toEqual({ ok: true, value: afterState });
    expect(sender.send).toHaveBeenCalledWith(workspaceChangedChannel, expect.objectContaining({
      workspaceId: "workspace-1",
      workspacePath: "/tmp/notes"
    }));
  });

  it("does not notify workspace changes when chat only creates pending proposals", async () => {
    const sender = { send: vi.fn() };
    const beforeState = createAIWorkspaceState("pending");
    const afterState = createAIWorkspaceState("pending");
    activeWorkspaceMock.getActiveWorkspaceContext.mockResolvedValue({
      ok: true,
      value: {
        activeWorkspace: { id: "workspace-1", path: "/tmp/notes" },
        userDataPath: "/tmp/relic-user-data"
      }
    });
    aiWorkspaceServiceMock.getAIWorkspaceState.mockResolvedValue({ ok: true, value: beforeState });
    aiWorkspaceServiceMock.sendAIWorkspaceMessage.mockResolvedValue({ ok: true, value: afterState });

    registerAIWorkspaceHandlers();
    const handler = electronMock.handle.mock.calls.find(([channel]) => channel === sendAIWorkspaceMessageChannel)?.[1];
    if (!handler) throw new Error("sendAIWorkspaceMessage handler was not registered");

    await handler({ sender }, { message: "認証を整理して" });

    expect(sender.send).not.toHaveBeenCalled();
  });

  it("notifies workspace changes when applying operations changes Markdown", async () => {
    const sender = { send: vi.fn() };
    const beforeState = createAIWorkspaceState("pending");
    const afterState = createAIWorkspaceState("applied");
    activeWorkspaceMock.getActiveWorkspaceContext.mockResolvedValue({
      ok: true,
      value: {
        activeWorkspace: { id: "workspace-1", path: "/tmp/notes" },
        userDataPath: "/tmp/relic-user-data"
      }
    });
    aiWorkspaceServiceMock.getAIWorkspaceState.mockResolvedValue({ ok: true, value: beforeState });
    aiWorkspaceServiceMock.applyAIWorkspaceOperations.mockResolvedValue({ ok: true, value: afterState });

    registerAIWorkspaceHandlers();
    const handler = electronMock.handle.mock.calls.find(([channel]) => channel === applyAIWorkspaceOperationsChannel)?.[1];
    if (!handler) throw new Error("applyAIWorkspaceOperations handler was not registered");

    const result = await handler({ sender }, {});

    expect(result).toEqual({ ok: true, value: afterState });
    expect(sender.send).toHaveBeenCalledWith(workspaceChangedChannel, expect.objectContaining({
      workspaceId: "workspace-1",
      workspacePath: "/tmp/notes"
    }));
  });

  it("does not notify workspace changes when applying operations leaves proposals stale", async () => {
    const sender = { send: vi.fn() };
    const beforeState = createAIWorkspaceState("pending");
    const afterState = createAIWorkspaceState("stale");
    activeWorkspaceMock.getActiveWorkspaceContext.mockResolvedValue({
      ok: true,
      value: {
        activeWorkspace: { id: "workspace-1", path: "/tmp/notes" },
        userDataPath: "/tmp/relic-user-data"
      }
    });
    aiWorkspaceServiceMock.getAIWorkspaceState.mockResolvedValue({ ok: true, value: beforeState });
    aiWorkspaceServiceMock.applyAIWorkspaceOperations.mockResolvedValue({ ok: true, value: afterState });

    registerAIWorkspaceHandlers();
    const handler = electronMock.handle.mock.calls.find(([channel]) => channel === applyAIWorkspaceOperationsChannel)?.[1];
    if (!handler) throw new Error("applyAIWorkspaceOperations handler was not registered");

    await handler({ sender }, {});

    expect(sender.send).not.toHaveBeenCalled();
  });

  it("saves the selected OpenAI model in app settings", async () => {
    const userDataPath = await mkdtemp(path.join(os.tmpdir(), "relic-ai-settings-"));
    vi.mocked((await import("electron")).app.getPath).mockReturnValue(userDataPath);

    try {
      registerAIWorkspaceHandlers();
      const handler = electronMock.handle.mock.calls.find(([channel]) => channel === saveAIModelChannel)?.[1];
      if (!handler) throw new Error("saveAIModel handler was not registered");

      const result = await handler({}, { model: "gpt-5.5" });

      expect(result).toEqual({
        ok: true,
        value: expect.objectContaining({ model: "gpt-5.5" })
      });
      await expect(readAppSettings(userDataPath)).resolves.toMatchObject({
        aiSettings: { openAIModel: "gpt-5.5" }
      });
    } finally {
      vi.mocked((await import("electron")).app.getPath).mockReturnValue("/tmp/relic-user-data");
      await rm(userDataPath, { force: true, recursive: true });
    }
  });
});

function createAIWorkspaceState(status: "pending" | "applied" | "stale"): AIWorkspaceState {
  return {
    openAIAPIKeyConfigured: true,
    history: [],
    index: {
      chunkCount: 0,
      indexedAt: null,
      indexedFileCount: 0,
      skippedLargeFiles: [],
      unreadableFiles: []
    },
    operationHistory: [{
      content: "# Updated",
      createdAt: "2026-05-30T00:00:00.000Z",
      id: "operation-1",
      kind: "update",
      path: "README.md",
      status,
      summary: "READMEを更新"
    }],
    pendingOperations: status === "pending" ? [{
      content: "# Updated",
      createdAt: "2026-05-30T00:00:00.000Z",
      id: "operation-1",
      kind: "update",
      path: "README.md",
      status,
      summary: "READMEを更新"
    }] : []
  };
}
