import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./openAIResponsesClient", () => ({
  runOpenAIWorkspaceTurn: vi.fn()
}));

vi.mock("./codexAppServerClient", () => ({
  readCodexAIWorkspaceUsage: vi.fn(async () => null),
  runCodexAIWorkspaceTurn: vi.fn()
}));

vi.mock("./openAIKeyStore", () => ({
  hasOpenAIAPIKey: vi.fn(async () => true),
  readOpenAIAPIKey: vi.fn(async () => "sk-test-openai-key")
}));

import {
  applyAIWorkspaceOperations,
  deleteAIWorkspaceChat,
  discardAIWorkspaceOperations,
  getAIWorkspaceState,
  previewAIWorkspaceMessage,
  sendAIWorkspaceMessage
} from "./aiWorkspaceService";
import { writeAIWorkspaceData, type AIWorkspaceChatData, type AIWorkspaceData } from "./aiWorkspaceData";
import { computeAIWorkspaceIndexSourceHash } from "./aiWorkspaceIndex";
import { readCodexAIWorkspaceUsage, runCodexAIWorkspaceTurn } from "./codexAppServerClient";
import { readOpenAIAPIKey } from "./openAIKeyStore";
import { runOpenAIWorkspaceTurn } from "./openAIResponsesClient";
import { getAppSettingsPath } from "../settings/appSettings";

let userDataPath = "";
let workspacePath = "";

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

describe("getAIWorkspaceState", () => {
  it("indexes Markdown files when AI Workspace state is loaded", async () => {
    await writeFile(path.join(workspacePath, "README.md"), "# Workspace\n概要", "utf8");

    const result = await getAIWorkspaceState(context());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.index.indexedAt).not.toBeNull();
      expect(result.value.index.indexedFileCount).toBe(1);
      expect(result.value.index.chunkCount).toBe(1);
    }
  });

  it("includes Codex usage when Codex App Server is selected", async () => {
    vi.mocked(readCodexAIWorkspaceUsage).mockResolvedValueOnce({
      planType: "prolite",
      primary: {
        remainingPercent: 76,
        resetsAt: "2026-05-31T05:05:35.000Z",
        usedPercent: 24,
        windowDurationMins: 300
      },
      readAt: "2026-05-31T04:30:00.000Z",
      secondary: {
        remainingPercent: 97,
        resetsAt: "2026-06-07T01:37:56.000Z",
        usedPercent: 3,
        windowDurationMins: 10080
      }
    });

    const result = await getAIWorkspaceState(context());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.codexUsage?.primary?.remainingPercent).toBe(76);
      expect(result.value.codexUsage?.secondary?.windowDurationMins).toBe(10080);
    }
  });
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

  it("marks an operation as stale when the target Markdown changed after the proposal", async () => {
    await writeFile(path.join(workspacePath, "draft.md"), "new user content", "utf8");
    await writeData({
      operations: [{
        ...createOperation("update", "draft.md", "# Draft\nAI update"),
        baseContentHash: hashContent("old content")
      }]
    });

    const result = await applyAIWorkspaceOperations(context(), {});

    expect(result.ok).toBe(true);
    await expect(readFile(path.join(workspacePath, "draft.md"), "utf8")).resolves.toBe("new user content");
    if (result.ok) {
      expect(result.value.operationHistory[0].status).toBe("stale");
      expect(result.value.history.at(-1)?.content).toContain("作成後に対象Markdownが変更されていたため");
      expect(result.value.history.at(-1)?.content).toContain("- 再作業が必要: draft.md");
    }
  });

  it("applies only selected pending operations", async () => {
    await writeFile(path.join(workspacePath, "first.md"), "first", "utf8");
    await writeFile(path.join(workspacePath, "second.md"), "second", "utf8");
    await writeData({
      operations: [
        createOperation("update", "first.md", "updated first"),
        createOperation("update", "second.md", "updated second")
      ]
    });

    const result = await applyAIWorkspaceOperations(context(), { operationIds: ["update-first.md"] });

    expect(result.ok).toBe(true);
    await expect(readFile(path.join(workspacePath, "first.md"), "utf8")).resolves.toBe("updated first");
    await expect(readFile(path.join(workspacePath, "second.md"), "utf8")).resolves.toBe("second");
    if (result.ok) {
      expect(result.value.pendingOperations.map((operation) => operation.path)).toEqual(["second.md"]);
      expect(result.value.history.at(-1)?.content).toContain("- 反映済み: first.md");
    }
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

describe("deleteAIWorkspaceChat", () => {
  it("deletes only the selected chat and keeps Markdown files untouched", async () => {
    await writeFile(path.join(workspacePath, "README.md"), "# Workspace", "utf8");
    await writeData({
      activeChatId: "chat-1",
      chats: [
        createChat("chat-1", "消すチャット", [createOperation("update", "README.md", "# Updated")]),
        createChat("chat-2", "残すチャット", [])
      ]
    });

    const result = await deleteAIWorkspaceChat(context(), { chatId: "chat-1" });

    expect(result.ok).toBe(true);
    await expect(readFile(path.join(workspacePath, "README.md"), "utf8")).resolves.toBe("# Workspace");
    if (result.ok) {
      expect(result.value.activeChatId).toBe("chat-2");
      expect(result.value.chats?.map((chat) => chat.id)).toEqual(["chat-2"]);
      expect(result.value.history).toEqual([]);
      expect(result.value.operationHistory).toEqual([]);
    }
  });

  it("keeps the active chat when deleting another chat", async () => {
    await writeData({
      activeChatId: "chat-1",
      chats: [
        createChat("chat-1", "作業中", []),
        createChat("chat-2", "削除対象", [])
      ]
    });

    const result = await deleteAIWorkspaceChat(context(), { chatId: "chat-2" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.activeChatId).toBe("chat-1");
      expect(result.value.chats?.map((chat) => chat.id)).toEqual(["chat-1"]);
    }
  });
});

describe("sendAIWorkspaceMessage", () => {
  it("stops before external AI when the OpenAI API key is missing", async () => {
    await writeFile(path.join(workspacePath, "README.md"), "# Auth\nLogin spec", "utf8");
    await writeAISettings({ aiProvider: "openai-api" });
    vi.mocked(readOpenAIAPIKey).mockResolvedValueOnce(null);

    const result = await sendAIWorkspaceMessage(context(), { message: "Login spec" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("AI_WORKSPACE_OPENAI_KEY_MISSING");
    }
    expect(runOpenAIWorkspaceTurn).not.toHaveBeenCalled();
  });

  it("shows a clear fallback message when OpenAI API fails", async () => {
    await writeFile(path.join(workspacePath, "README.md"), "# 認証\nログイン仕様", "utf8");
    await writeAISettings({ aiProvider: "openai-api" });
    vi.mocked(runOpenAIWorkspaceTurn).mockRejectedValueOnce(new Error("connection failed"));

    const result = await sendAIWorkspaceMessage(context(), { message: "認証について整理して" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const lastMessage = result.value.history.at(-1);
      expect(lastMessage?.content).toContain("OpenAI APIでAI処理を完了できませんでした。");
      expect(lastMessage?.content).toContain("失敗理由: connection failed");
      expect(result.value.pendingOperations).toEqual([]);
    }
  });

  it("routes external AI messages to Codex App Server by default", async () => {
    await writeFile(path.join(workspacePath, "README.md"), "# Auth\nLogin spec", "utf8");
    vi.mocked(runCodexAIWorkspaceTurn).mockResolvedValueOnce({
      message: "Codexで処理しました。",
      operations: []
    });

    const result = await sendAIWorkspaceMessage(context(), { message: "Login spec" });

    expect(result.ok).toBe(true);
    expect(runCodexAIWorkspaceTurn).toHaveBeenCalledWith(expect.objectContaining({
      message: "Login spec",
      workspacePath
    }));
    expect(runOpenAIWorkspaceTurn).not.toHaveBeenCalled();
  });

  it("keeps the user message when AI generation is aborted after send", async () => {
    await writeFile(path.join(workspacePath, "README.md"), "# Auth\nLogin spec", "utf8");
    const abortController = new AbortController();
    vi.mocked(runCodexAIWorkspaceTurn).mockImplementationOnce(async (input) => {
      await new Promise((_resolve, reject) => {
        input.signal?.addEventListener("abort", () => reject(new Error("AI Workspace処理を中断しました。")), { once: true });
      });
      throw new Error("unreachable");
    });

    const resultPromise = sendAIWorkspaceMessage(context(), { message: "Login spec" }, undefined, {
      signal: abortController.signal
    });
    await vi.waitFor(() => {
      expect(runCodexAIWorkspaceTurn).toHaveBeenCalled();
    });
    abortController.abort();
    const result = await resultPromise;

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.history).toHaveLength(1);
      expect(result.value.history[0]).toMatchObject({ content: "Login spec", role: "user" });
    }
  });

  it("shows a clear fallback message when Codex App Server fails", async () => {
    await writeFile(path.join(workspacePath, "README.md"), "# 認証\nログイン仕様", "utf8");
    vi.mocked(runCodexAIWorkspaceTurn).mockRejectedValueOnce(new Error("Codex App Serverを起動できませんでした: ENOENT"));

    const result = await sendAIWorkspaceMessage(context(), { message: "認証について整理して" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const lastMessage = result.value.history.at(-1);
      expect(lastMessage?.content).toContain("Codex App ServerでAI処理を完了できませんでした。");
      expect(lastMessage?.content).toContain("設定のAI接続方式をOpenAI APIへ切り替えることもできます。");
      expect(result.value.pendingOperations).toEqual([]);
    }
  });

  it("translates OpenAI quota and billing errors into Japanese", async () => {
    await writeFile(path.join(workspacePath, "README.md"), "# 認証\nログイン仕様", "utf8");
    await writeAISettings({ aiProvider: "openai-api" });
    vi.mocked(runOpenAIWorkspaceTurn).mockRejectedValueOnce(new Error("insufficient_quota billing hard limit reached"));

    const result = await sendAIWorkspaceMessage(context(), { message: "認証について整理して" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.history.at(-1)?.content).toContain("OpenAI APIの利用枠または請求設定を確認してください。");
    }
  });

  it("applies safe Markdown operations returned by Codex immediately", async () => {
    await writeFile(path.join(workspacePath, "README.md"), "# Auth\nLogin spec", "utf8");
    vi.mocked(runCodexAIWorkspaceTurn).mockResolvedValueOnce({
      message: "READMEを更新します。",
      operations: [createOperation("update", "README.md", "# Auth\nUpdated")]
    });

    const result = await sendAIWorkspaceMessage(context(), { message: "Login spec" });

    expect(result.ok).toBe(true);
    expect(runCodexAIWorkspaceTurn).toHaveBeenCalledWith(expect.objectContaining({
      workspacePath
    }));
    await expect(readFile(path.join(workspacePath, "README.md"), "utf8")).resolves.toBe("# Auth\nUpdated");
    if (result.ok) {
      expect(result.value.pendingOperations).toEqual([]);
      expect(result.value.operationHistory).toEqual([]);
      expect(result.value.history.at(-1)?.content).toContain("Markdownへ反映しました。");
      expect(result.value.history.at(-1)?.content).toContain("- README.md");
    }
  });

  it("uses the selected OpenAI model from app settings", async () => {
    await writeFile(getAppSettingsPath(userDataPath), JSON.stringify({
      aiSettings: { aiProvider: "openai-api", openAIModel: "gpt-5.5" }
    }), "utf8");
    vi.mocked(runOpenAIWorkspaceTurn).mockResolvedValueOnce({
      message: "選択モデルで処理します。",
      operations: []
    });

    const result = await sendAIWorkspaceMessage(context(), { message: "モデル設定を使って" });

    expect(result.ok).toBe(true);
    expect(runOpenAIWorkspaceTurn).toHaveBeenCalledWith(expect.objectContaining({
      model: "gpt-5.5"
    }));
  });

  it("applies only safe Markdown operations returned by OpenAI API", async () => {
    await writeFile(path.join(workspacePath, "README.md"), "# Auth\nLogin spec", "utf8");
    await writeAISettings({ aiProvider: "openai-api" });
    vi.mocked(runOpenAIWorkspaceTurn).mockResolvedValueOnce({
      message: "変更案を作成します。",
      operations: [
        createOperation("update", "README.md", "# Auth\nUpdated"),
        createOperation("create", "README.md", "# Duplicate"),
        createOperation("create", "../outside.md", "# Outside"),
        createOperation("create", "notes.txt", "text"),
        createOperation("delete", "missing.md")
      ]
    });

    const result = await sendAIWorkspaceMessage(context(), { message: "Login spec" });

    expect(result.ok).toBe(true);
    await expect(readFile(path.join(workspacePath, "README.md"), "utf8")).resolves.toBe("# Auth\nUpdated");
    if (result.ok) {
      expect(result.value.pendingOperations).toEqual([]);
      expect(result.value.operationHistory).toEqual([]);
      expect(result.value.history.at(-1)?.content).toContain("Markdownへ反映しました。");
      expect(result.value.history.at(-1)?.content).toContain("安全のため採用しなかった変更があります。");
      expect(result.value.history.at(-1)?.content).toContain("../outside.md");
      expect(result.value.history.at(-1)?.content).toContain("notes.txt");
      expect(result.value.history.at(-1)?.content).toContain("missing.md");
      expect(result.value.history.at(-1)?.content).toContain("同じパスのMarkdownがすでにある");
    }
  });

  it("accepts absolute operation paths only when they are inside the workspace", async () => {
    await writeFile(path.join(workspacePath, "README.md"), "# Auth\nLogin spec", "utf8");
    await writeAISettings({ aiProvider: "openai-api" });
    vi.mocked(runOpenAIWorkspaceTurn).mockResolvedValueOnce({
      message: "変更案を作成します。",
      operations: [
        createOperation("update", path.join(workspacePath, "README.md"), "# Auth\nUpdated"),
        createOperation("create", path.join(path.dirname(workspacePath), "outside.md"), "# Outside")
      ]
    });

    const result = await sendAIWorkspaceMessage(context(), { message: "Login spec" });

    expect(result.ok).toBe(true);
    await expect(readFile(path.join(workspacePath, "README.md"), "utf8")).resolves.toBe("# Auth\nUpdated");
    await expect(readFile(path.join(path.dirname(workspacePath), "outside.md"), "utf8")).rejects.toThrow();
    if (result.ok) {
      expect(result.value.pendingOperations).toEqual([]);
      expect(result.value.history.at(-1)?.content).toContain("Markdownへ反映しました。");
      expect(result.value.history.at(-1)?.content).toContain("安全のため採用しなかった変更があります。");
      expect(result.value.history.at(-1)?.content).toContain("outside.md");
    }
  });

  it("does not pass old saved operation data to OpenAI API for follow-up chat", async () => {
    await writeFile(path.join(workspacePath, "README.md"), "# Auth\nLogin spec", "utf8");
    await writeAISettings({ aiProvider: "openai-api" });
    await writeData({
      operations: [createOperation("update", "README.md", "# Auth\nDraft update")]
    });
    vi.mocked(runOpenAIWorkspaceTurn).mockResolvedValueOnce({
      message: "変更案を調整します。",
      operations: [createOperation("update", "README.md", "# Auth\nAdjusted update")]
    });

    const result = await sendAIWorkspaceMessage(context(), { message: "さっきの案をもう少し短くして" });

    expect(result.ok).toBe(true);
    expect(runOpenAIWorkspaceTurn).toHaveBeenCalledWith(expect.objectContaining({
      pendingOperations: []
    }));
    await expect(readFile(path.join(workspacePath, "README.md"), "utf8")).resolves.toBe("# Auth\nAdjusted update");
  });

  it("passes unsaved active Markdown content to OpenAI API for current-file messages", async () => {
    await writeFile(path.join(workspacePath, "README.md"), "# Saved\nold content", "utf8");
    await writeAISettings({ aiProvider: "openai-api" });
    vi.mocked(runOpenAIWorkspaceTurn).mockResolvedValueOnce({
      message: "現在の本文を整理します。",
      operations: []
    });

    const result = await sendAIWorkspaceMessage(context(), {
      activeFileContent: "# Unsaved\nnew draft",
      activeFilePath: "README.md",
      message: "このファイルを整理して"
    });

    expect(result.ok).toBe(true);
    expect(runOpenAIWorkspaceTurn).toHaveBeenCalledWith(expect.objectContaining({
      referenceContents: [expect.objectContaining({
        content: "# Unsaved\nnew draft",
        path: "README.md"
      })],
      references: [expect.objectContaining({
        path: "README.md",
        preview: "# Unsaved"
      })]
    }));
  });

  it("passes full referenced Markdown content without silently truncating it", async () => {
    const fullContent = `# Long Note\n${"x".repeat(20_000)}\n末尾の内容`;
    await writeFile(path.join(workspacePath, "long.md"), fullContent, "utf8");
    await writeAISettings({ aiProvider: "openai-api" });
    vi.mocked(runOpenAIWorkspaceTurn).mockResolvedValueOnce({
      message: "長いノートを確認します。",
      operations: []
    });

    const result = await sendAIWorkspaceMessage(context(), { message: "末尾の内容を確認して" });

    expect(result.ok).toBe(true);
    expect(runOpenAIWorkspaceTurn).toHaveBeenCalledWith(expect.objectContaining({
      referenceContents: [expect.objectContaining({
        content: fullContent,
        path: "long.md"
      })]
    }));
  });

  it("does not overwrite Markdown files with unsaved editor changes", async () => {
    await writeFile(path.join(workspacePath, "README.md"), "# Auth\nLogin spec", "utf8");
    await writeAISettings({ aiProvider: "openai-api" });
    vi.mocked(runOpenAIWorkspaceTurn).mockResolvedValueOnce({
      message: "READMEを更新します。",
      operations: [createOperation("update", "README.md", "# Auth\nUpdated")]
    });

    const result = await sendAIWorkspaceMessage(context(), {
      dirtyFilePaths: ["README.md"],
      message: "Login spec"
    });

    expect(result.ok).toBe(true);
    await expect(readFile(path.join(workspacePath, "README.md"), "utf8")).resolves.toBe("# Auth\nLogin spec");
    if (result.ok) {
      expect(result.value.pendingOperations).toEqual([]);
      expect(result.value.history.at(-1)?.content).toContain("未保存のMarkdownがあるため");
      expect(result.value.history.at(-1)?.content).toContain("- README.md");
    }
  });

  it("does not delete a created Markdown when a revert proposal became stale", async () => {
    await writeFile(path.join(workspacePath, "created.md"), "# Edited after proposal", "utf8");
    await writeData({
      operations: [{
        ...createOperation("delete", "created.md"),
        baseContentHash: hashContent("# Created"),
        summary: "AIが作成したMarkdownを削除して元に戻す"
      }]
    });
    const trashItem = vi.fn(async () => undefined);

    const result = await applyAIWorkspaceOperations(context(), {}, trashItem);

    expect(result.ok).toBe(true);
    expect(trashItem).not.toHaveBeenCalled();
    await expect(readFile(path.join(workspacePath, "created.md"), "utf8")).resolves.toBe("# Edited after proposal");
    if (result.ok) {
      expect(result.value.operationHistory[0].status).toBe("stale");
      expect(result.value.history.at(-1)?.content).toContain("- 再作業が必要: created.md");
    }
  });

});

describe("previewAIWorkspaceMessage", () => {
  it("returns Markdown references for Japanese messages before calling OpenAI API", async () => {
    await writeFile(path.join(workspacePath, "README.md"), "# 認証\nログイン仕様", "utf8");

    const result = await previewAIWorkspaceMessage(context(), { message: "認証について整理して" });

    expect(result.ok).toBe(true);
    expect(runOpenAIWorkspaceTurn).not.toHaveBeenCalled();
    if (result.ok) {
      expect(result.value.requiresExternalAI).toBe(true);
      expect(result.value.references).toEqual([
        expect.objectContaining({ path: "README.md", preview: "# 認証" })
      ]);
    }
  });

  it("includes the active Markdown file for current-file messages", async () => {
    await writeFile(path.join(workspacePath, "current.md"), "# Current\n開いているファイル", "utf8");
    await writeFile(path.join(workspacePath, "other.md"), "# Other\n別ファイル", "utf8");

    const result = await previewAIWorkspaceMessage(context(), {
      activeFilePath: "current.md",
      message: "このファイルを整理して"
    });

    expect(result.ok).toBe(true);
    expect(runOpenAIWorkspaceTurn).not.toHaveBeenCalled();
    if (result.ok) {
      expect(result.value.requiresExternalAI).toBe(true);
      expect(result.value.references[0]).toEqual(expect.objectContaining({
        path: "current.md",
        preview: "# Current"
      }));
    }
  });

  it("uses small active Markdown content even when the current file is missing from the index", async () => {
    await writeData({
      index: {
        chunks: [],
        indexedAt: new Date().toISOString(),
        skippedLargeFiles: [],
        sourceHash: await computeAIWorkspaceIndexSourceHash(workspacePath),
        unreadableFiles: []
      }
    });

    const result = await previewAIWorkspaceMessage(context(), {
      activeFileContent: "# Unsaved\nnew draft",
      activeFilePath: "missing.md",
      message: "このファイルを整理して"
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.references[0]).toEqual(expect.objectContaining({
        path: "missing.md",
        preview: "# Unsaved"
      }));
    }
  });

  it("does not send oversized active Markdown content as a partial current-file reference", async () => {
    await writeData({
      index: {
        chunks: [],
        indexedAt: new Date().toISOString(),
        skippedLargeFiles: [],
        sourceHash: await computeAIWorkspaceIndexSourceHash(workspacePath),
        unreadableFiles: []
      }
    });

    const result = await previewAIWorkspaceMessage(context(), {
      activeFileContent: "x".repeat(2 * 1024 * 1024 + 1),
      activeFilePath: "large.md",
      message: "このファイルを整理して"
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.references).toEqual([]);
    }
  });

  it("does not include invalid active file paths as current-file references", async () => {
    await writeData({
      index: {
        chunks: [],
        indexedAt: new Date().toISOString(),
        skippedLargeFiles: [],
        sourceHash: await computeAIWorkspaceIndexSourceHash(workspacePath),
        unreadableFiles: []
      }
    });

    const result = await previewAIWorkspaceMessage(context(), {
      activeFileContent: "# Outside\nshould not be referenced",
      activeFilePath: "../outside.md",
      message: "このファイルを整理して"
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.references).toEqual([]);
    }
  });

  it("rebuilds a stale AI index before previewing Markdown references", async () => {
    await writeFile(path.join(workspacePath, "README.md"), "# New Topic\nfresh content", "utf8");
    await writeData({
      index: {
        chunks: [{
          content: "# Old Topic",
          embedding: [],
          endLine: 1,
          path: "README.md",
          startLine: 1
        }],
        indexedAt: "2026-05-30T00:00:00.000Z",
        skippedLargeFiles: [],
        sourceHash: "stale",
        unreadableFiles: []
      }
    });

    const result = await previewAIWorkspaceMessage(context(), { message: "fresh content" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.references).toEqual([
        expect.objectContaining({ path: "README.md", preview: "# New Topic" })
      ]);
    }
  });

  it("treats natural language apply commands as ordinary AI conversation", async () => {
    await writeData({
      operations: [createOperation("update", "draft.md", "# Draft\nupdated")]
    });

    const result = await previewAIWorkspaceMessage(context(), { message: "それ反映して" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.requiresExternalAI).toBe(true);
      expect(result.value.references).toEqual([]);
    }
  });

  it("treats hold-later commands as ordinary AI conversation", async () => {
    await writeData({
      operations: [createOperation("update", "draft.md", "# Draft\nupdated")]
    });

    const result = await previewAIWorkspaceMessage(context(), { message: "反映はまだしない" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.requiresExternalAI).toBe(true);
      expect(result.value.references).toEqual([]);
    }
  });

  it("treats natural language revert commands as ordinary AI conversation", async () => {
    await writeData({
      operations: [{
        ...createOperation("update", "draft.md", "# Draft\nupdated"),
        baseContent: "# Draft\nold",
        status: "applied"
      }]
    });

    const result = await previewAIWorkspaceMessage(context(), { message: "さっきの変更を戻して" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.requiresExternalAI).toBe(true);
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

type AIWorkspaceDataTestPartial = Partial<AIWorkspaceData> & Pick<Partial<AIWorkspaceChatData>, "history" | "operations">;

async function writeData(partial: AIWorkspaceDataTestPartial): Promise<void> {
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

async function writeAISettings(settings: { aiProvider: "codex-app-server" | "openai-api"; openAIModel?: string }): Promise<void> {
  await writeFile(getAppSettingsPath(userDataPath), JSON.stringify({
    aiSettings: {
      aiProvider: settings.aiProvider,
      openAIModel: settings.openAIModel ?? "gpt-5.4-mini"
    }
  }), "utf8");
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

function createChat(
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

function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}
