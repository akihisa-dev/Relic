import path from "node:path";
import { describe, expect, it } from "vitest";

import { blockedDirtyPaths, hashContent, validateOperationPath } from "./aiWorkspaceOperations";
import type { AIWorkspaceFileOperation } from "../../shared/ipc";

describe("aiWorkspaceOperations", () => {
  const workspacePath = path.join(path.sep, "tmp", "relic-workspace");

  it("accepts Markdown paths inside the workspace and normalizes separators", () => {
    expect(validateOperationPath(workspacePath, "docs\\note.md")).toMatchObject({
      ok: true,
      value: "docs/note.md"
    });
    expect(validateOperationPath(workspacePath, path.join(workspacePath, "docs", "note.md"))).toMatchObject({
      ok: true,
      value: "docs/note.md"
    });
  });

  it("rejects unsafe operation paths before file operations run", () => {
    expect(validateOperationPath(workspacePath, "../outside.md").ok).toBe(false);
    expect(validateOperationPath(workspacePath, "notes.txt").ok).toBe(false);
    expect(validateOperationPath(workspacePath, "C:\\outside.md").ok).toBe(false);
    expect(validateOperationPath(workspacePath, "null-byte.md\0outside").ok).toBe(false);
  });

  it("blocks dirty paths for update and delete operations but not create operations", () => {
    const operations: AIWorkspaceFileOperation[] = [
      operation("create", "new.md"),
      operation("update", "dirty.md"),
      operation("delete", "dirty.md")
    ];

    expect(blockedDirtyPaths(operations, ["dirty.md", "new.md"])).toEqual(["dirty.md"]);
  });

  it("hashes content deterministically for stale operation checks", () => {
    expect(hashContent("same")).toBe(hashContent("same"));
    expect(hashContent("same")).not.toBe(hashContent("different"));
  });
});

function operation(kind: AIWorkspaceFileOperation["kind"], filePath: string): AIWorkspaceFileOperation {
  return {
    createdAt: "2026-05-31T00:00:00.000Z",
    id: `${kind}-${filePath}`,
    kind,
    path: filePath,
    status: "pending",
    summary: `${kind} ${filePath}`
  };
}
