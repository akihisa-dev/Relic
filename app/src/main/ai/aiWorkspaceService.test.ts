import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { applyAIWorkspaceOperations } from "./aiWorkspaceService";
import { writeAIWorkspaceData, type AIWorkspaceData } from "./aiWorkspaceData";

let userDataPath = "";
let workspacePath = "";

beforeEach(async () => {
  userDataPath = await mkdtemp(path.join(os.tmpdir(), "relic-ai-user-data-"));
  workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-ai-workspace-"));
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
