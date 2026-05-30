import { mkdtemp, readFile, rm } from "node:fs/promises";
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
});
