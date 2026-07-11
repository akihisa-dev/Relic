import { describe, expect, it } from "vitest";

import { parseCachedWorkspaceFileIndex, workspaceFileIndexCacheVersion } from "./workspaceFileIndexCache";

describe("workspaceFileIndexCache", () => {
  it("現行versionの有効なレコードを解析する", () => {
    const records = parseCachedWorkspaceFileIndex(JSON.stringify({
      records: [{
        contentHash: "hash",
        kind: "markdown",
        lines: ["# Note"],
        mtimeMs: 1,
        name: "note",
        path: "note.md",
        readStatus: "ok",
        searchable: true,
        size: 6
      }],
      version: workspaceFileIndexCacheVersion
    }));

    expect(records).toMatchObject([{ kind: "markdown", path: "note.md", lines: ["# Note"] }]);
  });

  it("旧versionと壊れたJSONを拒否する", () => {
    expect(parseCachedWorkspaceFileIndex(JSON.stringify({ records: [], version: 1 }))).toBeNull();
    expect(parseCachedWorkspaceFileIndex("{" )).toBeNull();
  });

  it("不正なレコードだけを除外する", () => {
    const records = parseCachedWorkspaceFileIndex(JSON.stringify({
      records: [{ kind: "markdown", path: "missing-fields.md" }],
      version: workspaceFileIndexCacheVersion
    }));

    expect(records).toEqual([]);
  });
});
