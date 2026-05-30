import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./codexAppServerClient", () => ({
  runCodexAIWorkspaceTurn: vi.fn()
}));

import {
  applyAIWorkspaceOperations,
  discardAIWorkspaceOperations,
  previewAIWorkspaceMessage,
  sendAIWorkspaceMessage
} from "./aiWorkspaceService";
import { writeAIWorkspaceData, type AIWorkspaceData } from "./aiWorkspaceData";
import { runCodexAIWorkspaceTurn } from "./codexAppServerClient";

let userDataPath = "";
let workspacePath = "";

beforeEach(async () => {
  userDataPath = await mkdtemp(path.join(os.tmpdir(), "relic-ai-user-data-"));
  workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-ai-workspace-"));
  vi.mocked(runCodexAIWorkspaceTurn).mockReset();
});

afterEach(async () => {
  await rm(userDataPath, { force: true, recursive: true });
  await rm(workspacePath, { force: true, recursive: true });
});

describe("applyAIWorkspaceOperations", () => {
  it("creates and updates Markdown files from pending operations", async () => {
    await writeFile(path.join(workspacePath, "existing.md"), "old", "utf8");
    await writeData({
      operations: [
        createOperation("create", "docs/new.md", "# New\ncontent"),
        createOperation("update", "existing.md", "# Existing\nupdated")
      ]
    });

    const result = await applyAIWorkspaceOperations(context(), {});

    expect(result.ok).toBe(true);
    await expect(readFile(path.join(workspacePath, "docs", "new.md"), "utf8")).resolves.toBe("# New\ncontent");
    await expect(readFile(path.join(workspacePath, "existing.md"), "utf8")).resolves.toBe("# Existing\nupdated");
    if (result.ok) {
      expect(result.value.pendingOperations).toEqual([]);
    }
  });

  it("moves Markdown files to trash for delete operations", async () => {
    await writeFile(path.join(workspacePath, "old.md"), "old", "utf8");
    await writeData({
      operations: [createOperation("delete", "old.md")]
    });
    const trashItem = vi.fn(async () => undefined);

    const result = await applyAIWorkspaceOperations(context(), {}, trashItem);

    expect(result.ok).toBe(true);
    expect(trashItem).toHaveBeenCalledWith(path.join(workspacePath, "old.md"));
  });

  it("does not apply updates to Markdown files with unsaved editor changes", async () => {
    await writeFile(path.join(workspacePath, "draft.md"), "old", "utf8");
    await writeData({
      operations: [createOperation("update", "draft.md", "# Draft\nupdated")]
    });

    const result = await applyAIWorkspaceOperations(context(), { dirtyFilePaths: ["draft.md"] });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("AI_WORKSPACE_DIRTY_FILE_BLOCKED");
    }
    await expect(readFile(path.join(workspacePath, "draft.md"), "utf8")).resolves.toBe("old");
  });
});

describe("discardAIWorkspaceOperations", () => {
  it("discards pending operations without changing Markdown files", async () => {
    await writeFile(path.join(workspacePath, "draft.md"), "old", "utf8");
    await writeData({
      operations: [createOperation("update", "draft.md", "# Draft\nupdated")]
    });

    const result = await discardAIWorkspaceOperations(context(), {});

    expect(result.ok).toBe(true);
    await expect(readFile(path.join(workspacePath, "draft.md"), "utf8")).resolves.toBe("old");
    if (result.ok) {
      expect(result.value.pendingOperations).toEqual([]);
    }
  });
});

describe("sendAIWorkspaceMessage", () => {
  it("shows a clear fallback message when Codex App Server fails", async () => {
    await writeFile(path.join(workspacePath, "README.md"), "# 認証\nログイン仕様", "utf8");
    vi.mocked(runCodexAIWorkspaceTurn).mockRejectedValueOnce(new Error("connection failed"));

    const result = await sendAIWorkspaceMessage(context(), { message: "認証について整理して" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const lastMessage = result.value.history.at(-1);
      expect(lastMessage?.content).toContain("Codex App ServerでAI処理を完了できませんでした。");
      expect(lastMessage?.content).toContain("失敗理由: connection failed");
      expect(result.value.pendingOperations).toEqual([]);
    }
  });
});

describe("previewAIWorkspaceMessage", () => {
  it("returns Markdown references before calling Codex App Server", async () => {
    await writeFile(path.join(workspacePath, "README.md"), "# Auth\nLogin spec", "utf8");

    const result = await previewAIWorkspaceMessage(context(), { message: "Login spec" });

    expect(result.ok).toBe(true);
    expect(runCodexAIWorkspaceTurn).not.toHaveBeenCalled();
    if (result.ok) {
      expect(result.value.requiresExternalAI).toBe(true);
      expect(result.value.references).toEqual([
        expect.objectContaining({ path: "README.md", preview: "# Auth" })
      ]);
    }
  });

  it("does not require external AI for natural language apply commands", async () => {
    await writeData({
      operations: [createOperation("update", "draft.md", "# Draft\nupdated")]
    });

    const result = await previewAIWorkspaceMessage(context(), { message: "それ反映して" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.requiresExternalAI).toBe(false);
      expect(result.value.references).toEqual([]);
    }
  });
});

function context() {
  return {
    userDataPath,
    workspaceId: "workspace",
    workspacePath
  };
}

async function writeData(partial: Partial<AIWorkspaceData>): Promise<void> {
  await writeAIWorkspaceData(userDataPath, "workspace", {
    history: [],
    index: {
      chunks: [],
      indexedAt: null,
      skippedLargeFiles: [],
      unreadableFiles: []
    },
    operations: [],
    ...partial
  });
}

function createOperation(
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
