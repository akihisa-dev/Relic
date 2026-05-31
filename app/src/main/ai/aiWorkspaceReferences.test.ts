import { describe, expect, it } from "vitest";

import { buildReferences, usableActiveFileContent, usableActiveFilePath } from "./aiWorkspaceReferences";
import type { AIWorkspaceData } from "./aiWorkspaceData";

describe("aiWorkspaceReferences", () => {
  it("deduplicates indexed references by path and keeps their first preview", () => {
    const references = buildReferences(dataWithChunks([
      ["note.md", "# Note\nfirst"],
      ["note.md", "# Note\nsecond"],
      ["other.md", "\n\nOther preview"]
    ]), "Note");

    expect(references).toEqual([
      expect.objectContaining({ path: "note.md", preview: "# Note" }),
      expect.objectContaining({ path: "other.md", preview: "Other preview" })
    ]);
  });

  it("prefers unsaved active Markdown content for current-file messages", () => {
    const references = buildReferences(
      dataWithChunks([["current.md", "# Saved"]]),
      "このファイルを整理して",
      "current.md",
      "# Unsaved\nDraft"
    );

    expect(references[0]).toEqual(expect.objectContaining({
      path: "current.md",
      preview: "# Unsaved"
    }));
  });

  it("rejects invalid or oversized active Markdown references", () => {
    expect(usableActiveFilePath("../outside.md")).toBeNull();
    expect(usableActiveFilePath("note.txt")).toBeNull();
    expect(usableActiveFilePath("note.md")).toBe("note.md");
    expect(usableActiveFileContent("x".repeat(2 * 1024 * 1024 + 1))).toBeNull();
  });
});

function dataWithChunks(chunks: Array<[string, string]>): AIWorkspaceData {
  return {
    activeChatId: null,
    chats: [],
    index: {
      chunks: chunks.map(([path, content], index) => ({
        content,
        embedding: [],
        endLine: index + 1,
        path,
        startLine: index + 1
      })),
      indexedAt: "2026-05-31T00:00:00.000Z",
      skippedLargeFiles: [],
      sourceHash: "hash",
      unreadableFiles: []
    }
  };
}
