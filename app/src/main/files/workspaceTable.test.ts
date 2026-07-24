import { describe, expect, it } from "vitest";

import { defaultWorkspaceTablePreferences } from "../../shared/ipc";
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
    const result = await readWorkspaceTable("/workspace", {
      ...defaultWorkspaceTablePreferences,
      selectedProperties: ["status", "removed", "active"]
    }, { fileIndex: fileIndex() });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.availableProperties).toEqual(["active", "count", "date", "empty", "items", "meta", "status", "tags"]);
    expect(result.value.preferences.selectedProperties).toEqual(["status", "active"]);
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
        tags: { displayText: "one ・ two", kind: "array", text: "[one, two]" }
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

  it("固定プロパティへ元の値を保った表示用要約を付ける", () => {
    expect(tableValueFor(["灰冠卿", "黒槍のエルド"], "aliases")).toEqual({
      displayText: "灰冠卿 ・ 黒槍のエルド",
      kind: "array",
      text: "[灰冠卿, 黒槍のエルド]"
    });
    expect(tableValueFor("../assets/黒鉄の軍旗.png", "card")).toEqual({
      displayText: "黒鉄の軍旗.png",
      kind: "string",
      text: "../assets/黒鉄の軍旗.png"
    });
    expect(tableValueFor({ calendar: "基準暦", start: 338, end: 375 }, "chronicle")).toEqual({
      displayText: "基準暦 · 338–375",
      kind: "object",
      text: "{calendar: 基準暦, start: 338, end: 375}"
    });
  });
});
