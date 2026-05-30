import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./openAIResponsesClient", () => ({
  runOpenAIWorkspaceTurn: vi.fn()
}));

vi.mock("./openAIKeyStore", () => ({
  hasOpenAIAPIKey: vi.fn(async () => true),
  readOpenAIAPIKey: vi.fn(async () => "sk-test-openai-key")
}));

import {
  applyAIWorkspaceOperations,
  discardAIWorkspaceOperations,
  getAIWorkspaceState,
  previewAIWorkspaceMessage,
  sendAIWorkspaceMessage
} from "./aiWorkspaceService";
import { writeAIWorkspaceData, type AIWorkspaceData } from "./aiWorkspaceData";
import { computeAIWorkspaceIndexSourceHash } from "./aiWorkspaceIndex";
import { readOpenAIAPIKey } from "./openAIKeyStore";
import { runOpenAIWorkspaceTurn } from "./openAIResponsesClient";

let userDataPath = "";
let workspacePath = "";

beforeEach(async () => {
  userDataPath = await mkdtemp(path.join(os.tmpdir(), "relic-ai-user-data-"));
  workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-ai-workspace-"));
  vi.mocked(runOpenAIWorkspaceTurn).mockReset();
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

describe("sendAIWorkspaceMessage", () => {
  it("stops before external AI when the OpenAI API key is missing", async () => {
    await writeFile(path.join(workspacePath, "README.md"), "# Auth\nLogin spec", "utf8");
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

  it("stores the target Markdown hash with update operations", async () => {
    await writeFile(path.join(workspacePath, "README.md"), "# Auth\nLogin spec", "utf8");
    vi.mocked(runOpenAIWorkspaceTurn).mockResolvedValueOnce({
      message: "READMEを更新します。",
      operations: [createOperation("update", "README.md", "# Auth\nUpdated")]
    });

    const result = await sendAIWorkspaceMessage(context(), { message: "Login spec" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.pendingOperations[0].baseContent).toBe("# Auth\nLogin spec");
      expect(result.value.pendingOperations[0].baseContentHash).toBe(hashContent("# Auth\nLogin spec"));
    }
  });

  it("keeps only safe Markdown operations returned by OpenAI API", async () => {
    await writeFile(path.join(workspacePath, "README.md"), "# Auth\nLogin spec", "utf8");
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
    if (result.ok) {
      expect(result.value.pendingOperations.map((operation) => operation.path)).toEqual(["README.md"]);
      expect(result.value.history.at(-1)?.content).toContain("Relic側で安全のため採用しなかった変更案");
      expect(result.value.history.at(-1)?.content).toContain("../outside.md");
      expect(result.value.history.at(-1)?.content).toContain("notes.txt");
      expect(result.value.history.at(-1)?.content).toContain("missing.md");
      expect(result.value.history.at(-1)?.content).toContain("同じパスのMarkdownがすでにある");
    }
  });

  it("accepts absolute operation paths only when they are inside the workspace", async () => {
    await writeFile(path.join(workspacePath, "README.md"), "# Auth\nLogin spec", "utf8");
    vi.mocked(runOpenAIWorkspaceTurn).mockResolvedValueOnce({
      message: "変更案を作成します。",
      operations: [
        createOperation("update", path.join(workspacePath, "README.md"), "# Auth\nUpdated"),
        createOperation("create", path.join(path.dirname(workspacePath), "outside.md"), "# Outside")
      ]
    });

    const result = await sendAIWorkspaceMessage(context(), { message: "Login spec" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.pendingOperations).toEqual([
        expect.objectContaining({
          path: "README.md",
          status: "pending"
        })
      ]);
      expect(result.value.history.at(-1)?.content).toContain("Relic側で安全のため採用しなかった変更案");
      expect(result.value.history.at(-1)?.content).toContain("outside.md");
    }
  });

  it("passes pending operations to OpenAI API for follow-up edits", async () => {
    await writeFile(path.join(workspacePath, "README.md"), "# Auth\nLogin spec", "utf8");
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
      pendingOperations: [expect.objectContaining({
        content: "# Auth\nDraft update",
        path: "README.md",
        status: "pending"
      })]
    }));
  });

  it("passes unsaved active Markdown content to OpenAI API for current-file messages", async () => {
    await writeFile(path.join(workspacePath, "README.md"), "# Saved\nold content", "utf8");
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

  it("replaces old pending operations for the same Markdown path with new proposals", async () => {
    await writeFile(path.join(workspacePath, "README.md"), "# Auth\nLogin spec", "utf8");
    await writeData({
      operations: [createOperation("update", "README.md", "# Auth\nDraft update")]
    });
    vi.mocked(runOpenAIWorkspaceTurn).mockResolvedValueOnce({
      message: "変更案を作り直します。",
      operations: [createOperation("update", "README.md", "# Auth\nAdjusted update")]
    });

    const result = await sendAIWorkspaceMessage(context(), { message: "さっきの案を作り直して" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.pendingOperations).toEqual([
        expect.objectContaining({
          content: "# Auth\nAdjusted update",
          path: "README.md",
          status: "pending"
        })
      ]);
      expect(result.value.operationHistory).toEqual([
        expect.objectContaining({
          content: "# Auth\nDraft update",
          path: "README.md",
          status: "replaced"
        }),
        expect.objectContaining({
          content: "# Auth\nAdjusted update",
          path: "README.md",
          status: "pending"
        })
      ]);
    }
  });

  it("creates a pending revert proposal for an applied update operation", async () => {
    await writeFile(path.join(workspacePath, "README.md"), "# Auth\nUpdated", "utf8");
    await writeData({
      operations: [{
        ...createOperation("update", "README.md", "# Auth\nUpdated"),
        baseContent: "# Auth\nOriginal",
        baseContentHash: hashContent("# Auth\nOriginal"),
        status: "applied"
      }]
    });

    const result = await sendAIWorkspaceMessage(context(), { message: "さっきの変更を戻して" });

    expect(result.ok).toBe(true);
    expect(runOpenAIWorkspaceTurn).not.toHaveBeenCalled();
    await expect(readFile(path.join(workspacePath, "README.md"), "utf8")).resolves.toBe("# Auth\nUpdated");
    if (result.ok) {
      expect(result.value.pendingOperations).toEqual([
        expect.objectContaining({
          baseContent: "# Auth\nUpdated",
          content: "# Auth\nOriginal",
          kind: "update",
          path: "README.md",
          status: "pending"
        })
      ]);
      expect(result.value.history.at(-1)?.content).toContain("元に戻す変更案を作成しました");
    }
  });

  it("creates a pending delete proposal to revert an applied create operation", async () => {
    await writeFile(path.join(workspacePath, "created.md"), "# Created", "utf8");
    await writeData({
      operations: [{
        ...createOperation("create", "created.md", "# Created"),
        status: "applied"
      }]
    });

    const result = await sendAIWorkspaceMessage(context(), { message: "created.mdを元に戻して" });

    expect(result.ok).toBe(true);
    expect(runOpenAIWorkspaceTurn).not.toHaveBeenCalled();
    await expect(readFile(path.join(workspacePath, "created.md"), "utf8")).resolves.toBe("# Created");
    if (result.ok) {
      expect(result.value.pendingOperations).toEqual([
        expect.objectContaining({
          baseContentHash: hashContent("# Created"),
          kind: "delete",
          path: "created.md",
          status: "pending"
        })
      ]);
    }
  });

  it("creates a pending create proposal to revert an applied delete operation", async () => {
    await writeData({
      operations: [{
        ...createOperation("delete", "deleted.md"),
        baseContent: "# Deleted\noriginal",
        baseContentHash: hashContent("# Deleted\noriginal"),
        status: "applied"
      }]
    });

    const result = await sendAIWorkspaceMessage(context(), { message: "deleted.mdを元に戻して" });

    expect(result.ok).toBe(true);
    expect(runOpenAIWorkspaceTurn).not.toHaveBeenCalled();
    await expect(readFile(path.join(workspacePath, "deleted.md"), "utf8")).rejects.toThrow();
    if (result.ok) {
      expect(result.value.pendingOperations).toEqual([
        expect.objectContaining({
          content: "# Deleted\noriginal",
          kind: "create",
          path: "deleted.md",
          status: "pending",
          summary: "AIが削除したMarkdownを元の本文で再作成する"
        })
      ]);
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

  it("applies only the pending operation named in a natural language message", async () => {
    await writeFile(path.join(workspacePath, "first.md"), "first", "utf8");
    await writeFile(path.join(workspacePath, "second.md"), "second", "utf8");
    await writeData({
      operations: [
        createOperation("update", "first.md", "updated first"),
        createOperation("update", "second.md", "updated second")
      ]
    });

    const result = await sendAIWorkspaceMessage(context(), { message: "first.mdだけ反映して" });

    expect(result.ok).toBe(true);
    expect(runOpenAIWorkspaceTurn).not.toHaveBeenCalled();
    await expect(readFile(path.join(workspacePath, "first.md"), "utf8")).resolves.toBe("updated first");
    await expect(readFile(path.join(workspacePath, "second.md"), "utf8")).resolves.toBe("second");
    if (result.ok) {
      expect(result.value.pendingOperations.map((operation) => operation.path)).toEqual(["second.md"]);
      expect(result.value.history.at(-2)).toEqual(expect.objectContaining({
        content: "first.mdだけ反映して",
        role: "user"
      }));
      expect(result.value.history.at(-1)?.content).toContain("- 反映済み: first.md");
    }
  });

  it("applies only the active file operation for natural language current-file messages", async () => {
    await writeFile(path.join(workspacePath, "first.md"), "first", "utf8");
    await writeFile(path.join(workspacePath, "second.md"), "second", "utf8");
    await writeData({
      operations: [
        createOperation("update", "first.md", "updated first"),
        createOperation("update", "second.md", "updated second")
      ]
    });

    const result = await sendAIWorkspaceMessage(context(), {
      activeFilePath: "second.md",
      message: "このファイルだけ反映して"
    });

    expect(result.ok).toBe(true);
    expect(runOpenAIWorkspaceTurn).not.toHaveBeenCalled();
    await expect(readFile(path.join(workspacePath, "first.md"), "utf8")).resolves.toBe("first");
    await expect(readFile(path.join(workspacePath, "second.md"), "utf8")).resolves.toBe("updated second");
    if (result.ok) {
      expect(result.value.pendingOperations.map((operation) => operation.path)).toEqual(["first.md"]);
    }
  });

  it("does not apply all pending operations when a current-file message has no active file", async () => {
    await writeFile(path.join(workspacePath, "first.md"), "first", "utf8");
    await writeFile(path.join(workspacePath, "second.md"), "second", "utf8");
    await writeData({
      operations: [
        createOperation("update", "first.md", "updated first"),
        createOperation("update", "second.md", "updated second")
      ]
    });

    const result = await sendAIWorkspaceMessage(context(), { message: "このファイルだけ反映して" });

    expect(result.ok).toBe(false);
    expect(runOpenAIWorkspaceTurn).not.toHaveBeenCalled();
    if (!result.ok) {
      expect(result.error.code).toBe("AI_WORKSPACE_NO_PENDING_OPERATIONS");
    }
    await expect(readFile(path.join(workspacePath, "first.md"), "utf8")).resolves.toBe("first");
    await expect(readFile(path.join(workspacePath, "second.md"), "utf8")).resolves.toBe("second");
  });

  it("keeps pending operations when the user says not to apply them yet", async () => {
    await writeFile(path.join(workspacePath, "draft.md"), "old", "utf8");
    await writeData({
      operations: [createOperation("update", "draft.md", "# Draft\nupdated")]
    });

    const result = await sendAIWorkspaceMessage(context(), { message: "まだ反映しない" });

    expect(result.ok).toBe(true);
    expect(runOpenAIWorkspaceTurn).not.toHaveBeenCalled();
    await expect(readFile(path.join(workspacePath, "draft.md"), "utf8")).resolves.toBe("old");
    if (result.ok) {
      expect(result.value.pendingOperations).toEqual([
        expect.objectContaining({
          path: "draft.md",
          status: "pending"
        })
      ]);
      expect(result.value.history.at(-2)).toEqual(expect.objectContaining({
        content: "まだ反映しない",
        role: "user"
      }));
      expect(result.value.history.at(-1)?.content).toContain("作業中の変更として残しました");
    }
  });

  it("discards only the pending operation named in a natural language message", async () => {
    await writeFile(path.join(workspacePath, "first.md"), "first", "utf8");
    await writeFile(path.join(workspacePath, "second.md"), "second", "utf8");
    await writeData({
      operations: [
        createOperation("update", "first.md", "updated first"),
        createOperation("update", "second.md", "updated second")
      ]
    });

    const result = await sendAIWorkspaceMessage(context(), { message: "second.mdはやめて" });

    expect(result.ok).toBe(true);
    expect(runOpenAIWorkspaceTurn).not.toHaveBeenCalled();
    await expect(readFile(path.join(workspacePath, "first.md"), "utf8")).resolves.toBe("first");
    await expect(readFile(path.join(workspacePath, "second.md"), "utf8")).resolves.toBe("second");
    if (result.ok) {
      expect(result.value.pendingOperations.map((operation) => operation.path)).toEqual(["first.md"]);
      expect(result.value.operationHistory.find((operation) => operation.path === "second.md")?.status).toBe("discarded");
      expect(result.value.history.at(-2)).toEqual(expect.objectContaining({
        content: "second.mdはやめて",
        role: "user"
      }));
      expect(result.value.history.at(-1)?.content).toContain("- second.md");
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

  it("does not require external AI when pending operations are kept for later", async () => {
    await writeData({
      operations: [createOperation("update", "draft.md", "# Draft\nupdated")]
    });

    const result = await previewAIWorkspaceMessage(context(), { message: "反映はまだしない" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.requiresExternalAI).toBe(false);
      expect(result.value.references).toEqual([]);
    }
  });

  it("does not require external AI for natural language revert commands", async () => {
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
      sourceHash: null,
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

function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}
