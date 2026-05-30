import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { emptyAIWorkspaceData, readAIWorkspaceData, writeAIWorkspaceData } from "./aiWorkspaceData";

let userDataPath = "";

beforeEach(async () => {
  userDataPath = await mkdtemp(path.join(os.tmpdir(), "relic-ai-data-"));
});

afterEach(async () => {
  await rm(userDataPath, { force: true, recursive: true });
});

describe("AI Workspace data storage", () => {
  it("keeps workspace ids inside the AI workspace app data directory", async () => {
    const data = {
      ...emptyAIWorkspaceData(),
      history: [{
        content: "hello",
        createdAt: "2026-05-30T00:00:00.000Z",
        id: "message-1",
        references: [],
        role: "user" as const
      }]
    };

    await writeAIWorkspaceData(userDataPath, "../outside", data);

    await expect(readFile(path.join(userDataPath, "outside.json"), "utf8")).rejects.toThrow();
    await expect(readFile(path.join(userDataPath, "ai-workspaces", "..%2Foutside.json"), "utf8")).resolves.toContain("hello");
    await expect(readAIWorkspaceData(userDataPath, "../outside")).resolves.toEqual(data);
  });

  it("keeps readable AI messages when saved references or message operations are partially invalid", async () => {
    await mkdir(path.join(userDataPath, "ai-workspaces"), { recursive: true });
    await writeFile(path.join(userDataPath, "ai-workspaces", "workspace.json"), JSON.stringify({
      history: [{
        content: "AI response",
        createdAt: "2026-05-30T00:00:00.000Z",
        id: "message-1",
        operations: [
          {
            content: "# Auth",
            createdAt: "2026-05-30T00:00:00.000Z",
            id: "operation-1",
            kind: "update",
            path: "docs/auth.md",
            status: "pending",
            summary: "認証資料を更新"
          },
          { id: "broken-operation" }
        ],
        references: [
          { line: 1, path: "docs/auth.md", preview: "# Auth" },
          { path: 123, preview: "# Broken" }
        ],
        role: "assistant"
      }],
      index: {},
      operations: []
    }), "utf8");

    const data = await readAIWorkspaceData(userDataPath, "workspace");

    expect(data.history).toEqual([{
      content: "AI response",
      createdAt: "2026-05-30T00:00:00.000Z",
      id: "message-1",
      operations: [{
        content: "# Auth",
        createdAt: "2026-05-30T00:00:00.000Z",
        id: "operation-1",
        kind: "update",
        path: "docs/auth.md",
        status: "pending",
        summary: "認証資料を更新"
      }],
      references: [{ line: 1, path: "docs/auth.md", preview: "# Auth" }],
      role: "assistant"
    }]);
  });
});
