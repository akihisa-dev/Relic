import { describe, expect, it } from "vitest";

import type { WorkspaceFileIndex } from "./workspaceFileIndex";
import { readWorkspaceTable, tableValueFor } from "./workspaceTable";

function fileIndex(): WorkspaceFileIndex {
  return {
    entries: [],
    records: [
      {
        kind: "markdown",
        lines: ["---", "status: draft", "count: 2", "active: false", "empty:", "items: []", "tags: [one, two]", "meta: { owner: me }", "date: 2026-07-17", "---", "# One"],
        mtimeMs: 1,
        name: "one",
        path: "notes/one.md",
        readStatus: "ok",
        searchable: true,
        size: 120
      },
      {
        kind: "markdown",
        lines: ["---", "broken: [", "---", "# Broken"],
        mtimeMs: 2,
        name: "broken",
        path: "broken.md",
        readStatus: "ok",
        searchable: true,
        size: 30
      },
      {
        kind: "markdown",
        lines: ["# Plain"],
        mtimeMs: 3,
        name: "plain",
        path: "plain.md",
        readStatus: "ok",
        searchable: true,
        size: 8
      },
      {
        kind: "markdown",
        lines: [],
        mtimeMs: 4,
        name: "unreadable",
        path: "unreadable.md",
        readStatus: "unreadable",
        searchable: false,
        size: 0
      }
    ],
    stats: {
      cacheHitCount: 0,
      cachedContentHitCount: 0,
      cacheMissCount: 0,
      readFileCount: 0,
      readHeadCount: 0,
      statCount: 0,
      targetPathCount: 4,
      unreadableCount: 1
    }
  };
}

describe("workspaceTable", () => {
  it("共有索引から全Markdownとトップレベルプロパティを構造化する", async () => {
    const result = await readWorkspaceTable("/workspace", ["status", "removed", "active"], { fileIndex: fileIndex() });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.availableProperties).toEqual(["active", "count", "date", "empty", "items", "meta", "status", "tags"]);
    expect(result.value.selectedProperties).toEqual(["active", "status"]);
    expect(result.value.rows).toHaveLength(4);
    expect(result.value.rows[0]).toMatchObject({
      frontmatterStatus: "valid",
      name: "one",
      path: "notes/one.md",
      properties: {
        active: { booleanValue: false, kind: "boolean", text: "false" },
        count: { kind: "number", numberValue: 2, text: "2" },
        empty: { kind: "null", text: "null" },
        items: { kind: "empty-array", text: "[]" },
        meta: { kind: "object", text: "{owner: me}" },
        status: { kind: "string", text: "draft" },
        tags: { kind: "array", text: "[one, two]" }
      }
    });
    expect(result.value.rows[1].frontmatterStatus).toBe("invalid");
    expect(result.value.rows[2].frontmatterStatus).toBe("none");
    expect(result.value.rows[3].frontmatterStatus).toBe("invalid");
  });

  it("空文字と日付を未設定とは異なる値として表現する", () => {
    expect(tableValueFor("")).toEqual({ kind: "empty-string", text: "\"\"" });
    expect(tableValueFor(new Date("2026-07-17T00:00:00.000Z"))).toEqual({ kind: "date", text: "2026-07-17" });
  });
});
